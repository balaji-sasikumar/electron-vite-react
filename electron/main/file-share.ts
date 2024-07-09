import { createRequire } from "node:module";
const Opened = createRequire(import.meta.url)("@ronomon/opened");
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { exec } from "child_process";
import mime from "mime";
import { AES, enc } from "crypto-ts";
import { shell } from "electron";
import {
  ShareDirectoryClient,
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
interface DirectoryItem {
  label: string;
  id?: string;
  children?: DirectoryItem[];
}
export class FileShare {
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

  decryptFile = (encryptedData: string, key: string) => {
    const encryptedChunks = encryptedData.split(chunkSeparator);
    const decryptedChunks = [];

    for (const encChunk of encryptedChunks) {
      const decChunk = this.decryptionAES(encChunk, key);
      if (decChunk === DATA_FORMAT_NOT_SUPPORTED) {
        return DATA_FORMAT_NOT_SUPPORTED;
      }
      decryptedChunks.push(decChunk);
    }
    const decryptedContent = decryptedChunks.join("");
    return decryptedContent;
  };

  encryptAndSaveFile = async (
    fromPath: string,
    toPath: string,
    key: string
  ) => {
    try {
      const base64Data = this.convertFileToBase64(fromPath);
      const dataURL = `data:${mime.getType(toPath)};base64,${base64Data}`;
      const encrypted = this.encryptFile(dataURL, key);
      fs.mkdirSync(path.dirname(toPath), { recursive: true });
      fs.writeFileSync(toPath, encrypted);
    } catch (err) {
      console.error("Error writing file:", err);
    }
  };

  openFile = async (newPath: string, base64Data: string) => {
    const directoryPath = path.dirname(newPath);
    fs.mkdirSync(directoryPath, { recursive: true });
    fs.writeFileSync(newPath, base64Data, { encoding: "base64" });
    await shell.openPath(newPath).catch((err) => {
      console.error("Error opening file:", err);
    });
  };

  listFiles = async (configuration: Configuration, directoryName: string) => {
    const { accountName: account, accountKey, shareName } = configuration;
    const credential = new StorageSharedKeyCredential(account, accountKey);
    const serviceClient = new ShareServiceClient(
      `https://${account}.file.core.windows.net`,
      credential
    );
    const shareClient = serviceClient
      .getShareClient(shareName)
      .getDirectoryClient(directoryName);
    let iter = shareClient.listFilesAndDirectories({
      includeTimestamps: true,
    });
    const fileList = [];
    for await (const item of iter) {
      fileList.push(item);
    }
    return fileList;
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
      console.log(directoryPath, "Directory path");
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
        console.log(`Directory ${pathSegment} not found`);
        break;
      }
    }
    return rootContents;
  };

  downloadFile = async (
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
    const downloadResponse = await fileClient.download();
    const isCompressed = file.name.endsWith(".gz");
    if (isCompressed) {
      const decompressedContent = await this.decompressStream(
        downloadResponse.readableStreamBody!
      );
      return decompressedContent.toString();
    }

    const downloadedContent = await this.streamToBuffer(
      downloadResponse.readableStreamBody
    );
    return (downloadedContent as Buffer).toString();
  };

  uploadFile = async (
    fileName: any,
    filePath: string,
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
    fileName = fileName.endsWith(".gz") ? fileName : `${fileName}.gz`;
    const fileClient = directoryClient.getFileClient(fileName);
    const compressedFilePath = `${filePath}.gz`;
    await this.compressFile(filePath, compressedFilePath);
    await fileClient.uploadFile(compressedFilePath);
    this.removeFileFromTempPath(compressedFilePath);
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
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Error removing file:", err);
    }
  };

  getSharedStoragePath = (directoryPath: string, fileName: string) => {
    return path.join(directoryPath, tempFolder, fileName);
  };

  private convertFileToBase64 = (filePath: string): string => {
    const data = fs.readFileSync(filePath);
    return Buffer.from(data).toString("base64");
  };

  private encryptFile = (fileDataUrl: string, key: string) => {
    const encryptedChunks = [];
    const totalChunks = Math.ceil(fileDataUrl.length / chunkSize);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = start + chunkSize;
      const chunk = fileDataUrl.substring(start, end);

      const encChunk = this.encryptionAES(chunk, key);
      encryptedChunks.push(encChunk);
    }

    const joinedEncryptedData = encryptedChunks.join(chunkSeparator);
    return joinedEncryptedData;
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

  private async decompressStream(
    readableStream: NodeJS.ReadableStream
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const gunzip = zlib.createGunzip();

      readableStream.pipe(gunzip);

      gunzip.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      gunzip.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      gunzip.on("error", (error: Error) => {
        reject(error);
      });
    });
  }

  private async streamToBuffer(
    readableStream: NodeJS.ReadableStream | undefined
  ) {
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] | Buffer[] = [];
      readableStream?.on("data", (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream?.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream?.on("error", reject);
    });
  }

  private getProperty = async (
    shareClient: ShareDirectoryClient,
    file: any
  ) => {
    let property;
    if (file.kind === "file") {
      const fileClient = shareClient.getFileClient(file.name);
      property = await fileClient.getProperties();
    } else {
      const directoryClient = shareClient.getDirectoryClient(file.name);
      property = await directoryClient.getProperties();
    }
    return property;
  };

  public static getInstance = () => {
    return new FileShare();
  };
}
