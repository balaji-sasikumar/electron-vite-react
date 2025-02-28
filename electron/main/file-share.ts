import { createRequire } from "node:module";
const Opened = createRequire(import.meta.url)("@ronomon/opened");
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import mime from "mime";
import { AES, enc } from "crypto-ts";
import { shell } from "electron";
import {
  ShareServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-file-share";
import {
  chunkSeparator,
  DATA_FORMAT_NOT_SUPPORTED,
  chunkSize,
  tempFolder,
} from "./utils";
import * as zlib from "zlib";
import { Configuration } from "electron/interfaces/configuration.interface";
import { DirectoryItem } from "electron/interfaces/directoryItem.interface";
import { config } from "../config";

export class FileShare {
  withEncryption = config.withEncryption;
  private constructor() {}
  isFileOpened = async (paths: string[]): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (process.platform === "win32") {
        Opened.files(
          paths,
          (error: any, hashTable: { [x: string]: boolean }) => {
            if (error) {
              reject(error);
            }
            resolve(hashTable?.[paths?.[0]]);
          }
        );
      } else {
        exec(`lsof -F n -- "${paths[0]}"`, (error, stdout, stderr) => {
          if (error || stderr) {
            resolve(false);
          }
          resolve(stdout.length > 0);
        });
      }
    });
  };

  decryptAndSaveFile = async (
    fromPath: string,
    toPath: string,
    key: string,
    isNewFormat: boolean
  ) => {
    try {
      return new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(fromPath, {
          highWaterMark: chunkSize,
        });
        fs.mkdirSync(path.dirname(toPath), { recursive: true });

        const writeStream = fs.createWriteStream(
          isNewFormat ? toPath : `${toPath}.tmp`
        );

        let leftover = "";
        let isFirstChunk = true;
        let tempFilePath = `${toPath}.tmp`;

        readStream.on("data", (chunk) => {
          let data = leftover + chunk.toString(); // Ensure proper chunk handling
          let encChunks = data.split(chunkSeparator);
          leftover = encChunks.pop()!; // Store leftover chunk part for next iteration

          encChunks.forEach((encChunk) => {
            const decChunk = this.decryptionAES(encChunk, key);
            if (decChunk === DATA_FORMAT_NOT_SUPPORTED) {
              reject(DATA_FORMAT_NOT_SUPPORTED);
              return;
            }

            let chunkToWrite = decChunk;

            // For the first chunk, remove the 'data:mimetype;base64,' part
            if (isFirstChunk) {
              const base64Index = decChunk.indexOf(",");
              if (base64Index !== -1) {
                chunkToWrite = decChunk.substring(base64Index + 1);
              }
              isFirstChunk = false;
            }

            if (isNewFormat) {
              // Write base64-decoded chunk directly to the file
              writeStream.write(Buffer.from(chunkToWrite, "base64"));
            } else {
              // For old format, write decrypted data directly to the temporary file
              writeStream.write(chunkToWrite, "utf-8");
            }
          });
        });

        readStream.on("end", () => {
          if (leftover) {
            const decChunk = this.decryptionAES(leftover, key);
            if (decChunk === DATA_FORMAT_NOT_SUPPORTED) {
              reject(DATA_FORMAT_NOT_SUPPORTED);
              return;
            }
            let chunkToWrite = decChunk;
            if (isFirstChunk) {
              const base64Index = decChunk.indexOf(",");
              if (base64Index !== -1) {
                chunkToWrite = decChunk.substring(base64Index + 1);
              }
            }

            if (isNewFormat) {
              writeStream.write(Buffer.from(chunkToWrite, "base64"));
            } else {
              writeStream.write(chunkToWrite, "utf-8");
            }
          }

          writeStream.end(() => {
            if (!isNewFormat) {
              const content = fs.readFileSync(tempFilePath, {
                encoding: "utf-8",
              });
              fs.writeFileSync(toPath, content, { encoding: "base64" });
              this.removeFileFromTempPath(tempFilePath);
            }
            resolve();
          });
        });

        readStream.on("error", reject);
        writeStream.on("error", reject);
      });
    } catch (err) {
      console.error("Error writing file:", err);
    }
  };

  encryptAndSaveFile = async (
    fromPath: string,
    toPath: string,
    key: string
  ) => {
    try {
      return new Promise<void>((resolve, reject) => {
        try {
          const readStream = fs.createReadStream(fromPath, {
            highWaterMark: chunkSize,
          });
          fs.mkdirSync(path.dirname(toPath), { recursive: true });
          const writeStream = fs.createWriteStream(toPath);
          let firstChunk = true;
          let encChunk, chunkToEncrypt: string;
          readStream.on("data", (chunk: any) => {
            readStream.pause();
            if (firstChunk) {
              chunkToEncrypt = `data:${mime.getType(
                fromPath
              )};base64,${chunk.toString("base64")}`;
              firstChunk = false;
            } else {
              chunkToEncrypt = chunk.toString("base64");
            }
            encChunk = this.encryptionAES(chunkToEncrypt, key);
            writeStream.write(encChunk + chunkSeparator, () => {
              readStream.resume();
            });
          });

          readStream.on("end", () => {
            // console.log(fs.statSync(toPath).size, "size");
            writeStream.end();
            resolve();
          });

          readStream.on("error", (error) => {
            reject(error);
          });

          writeStream.on("error", (error) => {
            reject(error);
          });
        } catch (error) {
          reject(error);
        }
      });
    } catch (err) {
      console.error("Error writing file:", err);
    }
  };

  openFile = async (newPath: string) => {
    await shell.openPath(newPath).catch((err) => {
      console.error("Error opening file:", err);
    });
  };

  listFiles = async (
    configuration: Configuration,
    directoryName: string,
    prefix?: string
  ) => {
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient
      .getShareClient(shareName)
      .getDirectoryClient(directoryName);
    let directoryProperties = await shareClient.getProperties();

    let iter = shareClient.listFilesAndDirectories({
      includeTimestamps: true,
      prefix: prefix,
    });
    const fileList = [];
    for await (const item of iter) {
      fileList.push(item);
    }
    return [fileList, directoryProperties.fileId];
  };

  getDirectoryTree = async (
    configuration: Configuration,
    folderPath: string
  ): Promise<DirectoryItem[]> => {
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient.getShareClient(shareName);
    let level = 0;

    const fetchDirectoryContents = async (
      directoryPath: string
    ): Promise<DirectoryItem[]> => {
      const directoryClient = shareClient.getDirectoryClient(directoryPath);
      const iter = directoryClient.listFilesAndDirectories({
        includeTimestamps: true,
      });
      const items: DirectoryItem[] = [];

      for await (const item of iter) {
        if (item.kind === "directory") {
          items.push({
            label: item.name,
            id: item.fileId,
            children: [],
            level: level,
          });
        }
      }
      level++;
      return items;
    };

    const paths = folderPath.split("/");
    let rootContents: DirectoryItem[] = await fetchDirectoryContents("");
    let currentLevel = rootContents;
    let path = "";
    for (let pathSegment of paths) {
      const parentDir = currentLevel.find((dir) => dir.label === pathSegment);
      path = path ? `${path}/${pathSegment}` : pathSegment;
      if (parentDir) {
        parentDir.children = await fetchDirectoryContents(path);
        currentLevel = parentDir.children;
      } else {
        break;
      }
    }
    return rootContents;
  };

  renameFolder = async (
    configuration: Configuration,
    currentDirectoryPath: string,
    newDirectoryName: string
  ) => {
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient.getShareClient(shareName);
    const directoryClient =
      shareClient.getDirectoryClient(currentDirectoryPath);
    await directoryClient.rename(newDirectoryName);
  };

  renameFile = async (
    configuration: Configuration,
    currentDirectoryPath: string,
    currentFileName: string,
    newFileName: string
  ) => {
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient.getShareClient(shareName);
    const directoryClient =
      shareClient.getDirectoryClient(currentDirectoryPath);
    const fileClient = directoryClient.getFileClient(currentFileName);
    await fileClient.rename(newFileName);
  };

  downloadFile = async (
    file: any,
    configuration: Configuration,
    directoryName: string,
    localPath: string
  ) => {
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient.getShareClient(shareName);
    const directoryClient = shareClient.getDirectoryClient(directoryName);
    const fileClient = directoryClient.getFileClient(file.name);
    const downloadResponse = await fileClient.download();
    const readStream = downloadResponse.readableStreamBody!;

    const directoryPath = path.dirname(localPath);
    fs.mkdirSync(directoryPath, { recursive: true });

    const writeStream = fs.createWriteStream(localPath);
    const isCompressed = file.name.endsWith(".gz");

    return new Promise<void>((resolve, reject) => {
      // Buffer the first few bytes to check for gzip magic number (1F 8B)
      const magicNumberBuffer = Buffer.alloc(2);
      readStream.once("data", (chunk) => {
        magicNumberBuffer[0] = chunk[0];
        magicNumberBuffer[1] = chunk[1];

        // Reset the stream by unshifting the first chunk back
        readStream.unshift(chunk);

        const isGzip =
          magicNumberBuffer[0] === 0x1f && magicNumberBuffer[1] === 0x8b;

        if (isCompressed && isGzip && this.withEncryption) {
          const decompressStream = zlib.createGunzip();
          readStream.pipe(decompressStream).pipe(writeStream);
        } else if (!isCompressed || !this.withEncryption) {
          readStream.pipe(writeStream);
        } else {
          reject(new Error("File is not a valid gzip file."));
        }
      });

      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
      readStream.on("error", reject); // Ensure to handle readStream errors as well
    });
  };

  getMetadata = async (
    file: any,
    configuration: Configuration,
    directoryName: string
  ) => {
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient.getShareClient(shareName);
    const directoryClient = shareClient.getDirectoryClient(directoryName);
    const fileClient = directoryClient.getFileClient(file.name);
    const properties = await fileClient.getProperties();
    return properties.metadata;
  };

  uploadFile = async (
    fileName: string,
    filePath: string,
    configuration: Configuration,
    directoryName: string
  ) => {
    let compress = this.withEncryption;
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient.getShareClient(shareName);
    const directoryClient = shareClient.getDirectoryClient(directoryName);

    let uploadFilePath = filePath;

    if (compress) {
      const compressedFilePath = `${filePath}.gz`;
      await this.compressFile(filePath, compressedFilePath);
      uploadFilePath = compressedFilePath;
      fileName = fileName.endsWith(".gz") ? fileName : `${fileName}.gz`;
    }

    const fileClient = directoryClient.getFileClient(fileName);
    await fileClient.uploadFile(uploadFilePath, {
      metadata: {
        stream: "true",
      },
    });

    if (compress) {
      this.removeFileFromTempPath(uploadFilePath);
    }
  };

  deleteFile = async (
    configuration: Configuration,
    directoryName: string,
    fileName: string
  ) => {
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient.getShareClient(shareName);
    const directoryClient = shareClient.getDirectoryClient(directoryName);
    const fileClient = directoryClient.getFileClient(fileName);
    await fileClient.delete();
  };

  addDirectory = async (
    configuration: Configuration,
    currentDirectoryPath: string,
    directoryName: string
  ) => {
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient.getShareClient(shareName);
    const directoryClient =
      shareClient.getDirectoryClient(currentDirectoryPath);
    await directoryClient.createSubdirectory(directoryName);
  };

  deleteDirectory = async (
    configuration: Configuration,
    directoryPath: string
  ) => {
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient.getShareClient(shareName);
    const directoryClient = shareClient.getDirectoryClient(directoryPath);
    await directoryClient.delete();
  };

  removeFileFromTempPath = (filePath: string) => {
    fs.unlinkSync(filePath);
  };

  getSharedStoragePath = (
    directoryPath: string,
    directories: string = "",
    fileName: string
  ) => {
    return path.join(directoryPath, tempFolder, directories, fileName);
  };

  checkFileExists = async (
    fileName: any,
    configuration: Configuration,
    directoryName: string
  ) => {
    console.log("Checking file exists", fileName);
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient.getShareClient(shareName);
    const directoryClient = shareClient.getDirectoryClient(directoryName);
    const fileClient = directoryClient.getFileClient(fileName);
    const fileExists = await fileClient.exists();
    if (fileExists) {
      return true;
    }
    return false;
  };

  private encryptionAES(msg: string, key: string) {
    if (msg && key) {
      return AES.encrypt(msg, key).toString();
    } else {
      return msg;
    }
  }

  private decryptionAES(msg: string, key: string) {
    try {
      if (msg && key) {
        const bytes = AES.decrypt(msg, key);
        const plaintext = bytes.toString(enc.Utf8);
        return plaintext || DATA_FORMAT_NOT_SUPPORTED;
      } else if (!msg && key) {
        return msg;
      } else {
        return DATA_FORMAT_NOT_SUPPORTED;
      }
    } catch (exception: any) {
      return exception.message === "Malformed UTF-8 data"
        ? DATA_FORMAT_NOT_SUPPORTED
        : "";
    }
  }

  private async compressFile(
    inputFilePath: string,
    outputFilePath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(inputFilePath);
      const writeStream = fs.createWriteStream(outputFilePath);
      const gzip = zlib.createGzip();

      readStream.pipe(gzip).pipe(writeStream);

      writeStream.on("finish", () => {
        resolve();
      });

      writeStream.on("error", (err) => {
        reject(err);
      });
    });
  }

  public static getInstance = () => {
    return new FileShare();
  };
}
