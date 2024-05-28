import { createRequire } from "node:module";
const Opened = createRequire(import.meta.url)("@ronomon/opened");
import * as fs from "fs";
import { exec } from "child_process";
import mime from "mime";
import { AES, enc } from "crypto-ts";
import { shell } from "electron";
import {
  ShareServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-file-share";
import { chunkSeparator, DATA_FORMAT_NOT_SUPPORTED, chunkSize } from "./utils";
import * as zlib from "zlib";

export const isFileOpened = async (paths: string[]): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (process.platform === "win32") {
      Opened.files(
        paths,
        function (error: any, hashTable: { [x: string]: boolean }) {
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

const convertFileToBase64 = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) =>
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(Buffer.from(data).toString("base64"));
    })
  );
};

const encryptFile = (fileDataUrl: string, key: string) => {
  const encryptedChunks = [];
  const totalChunks = Math.ceil(fileDataUrl.length / chunkSize);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = start + chunkSize;
    const chunk = fileDataUrl.substring(start, end);

    const encChunk = encryptionAES(chunk, key);
    encryptedChunks.push(encChunk);
  }

  const joinedEncryptedData = encryptedChunks.join(chunkSeparator);
  return joinedEncryptedData;
};
function encryptionAES(msg: string, key: string) {
  if (msg && key) {
    return AES.encrypt(msg, key).toString();
  } else {
    return msg;
  }
}

function decryptionAES(msg: string, key: string) {
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

export const decryptFile = (encryptedData: string, key: string) => {
  const encryptedChunks = encryptedData.split(chunkSeparator);
  const decryptedChunks = [];

  for (const encChunk of encryptedChunks) {
    const decChunk = decryptionAES(encChunk, key);
    if (decChunk === DATA_FORMAT_NOT_SUPPORTED) {
      return DATA_FORMAT_NOT_SUPPORTED;
    }
    decryptedChunks.push(decChunk);
  }
  const decryptedContent = decryptedChunks.join("");
  return decryptedContent;
};
export const encryptAndSaveFile = async (
  fromPath: string,
  toPath: string,
  key: string
) => {
  return new Promise<void>(async (resolve, reject) => {
    const base64Data = await convertFileToBase64(fromPath);
    const dataURL = `data:${mime.getType(toPath)};base64,${base64Data}`;
    const encrypted = encryptFile(dataURL, key);
    fs.writeFile(toPath, encrypted, (err) => {
      if (err) {
        console.error("Error writing file:", err);
        reject(err);
        return;
      }
      resolve();
    });
  });
};
export const openFile = (
  tempPath: string,
  newPath: string,
  base64Data: string
) => {
  fs.mkdir(tempPath, { recursive: true }, (err) => {
    console.log("Creating directory:", tempPath, newPath);
    if (err) {
      console.error("Error creating directory:", err);
      return;
    }
    fs.writeFile(newPath, base64Data, { encoding: "base64" }, (err) => {
      if (err) {
        console.error("Error writing file:", err);
        return;
      }
      shell
        .openPath(newPath)
        .then(() => {
          console.log("File opened successfully");
        })
        .catch((err) => {
          console.error("Error opening file:", err);
        });
    });
  });
};

export const listFiles = async (
  configuration: { accountName: string; accountKey: string; shareName: string },
  directoryName: string
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
  let iter = shareClient.listFilesAndDirectories();
  const fileList = [];
  for await (const item of iter) {
    fileList.push(item);
  }
  return fileList;
};

export const downloadFile = async (
  file: any,
  configuration: { accountName: string; accountKey: string; shareName: string },
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
    const decompressedContent = await decompressStream(
      downloadResponse.readableStreamBody!
    );
    return decompressedContent.toString();
  }

  const downloadedContent = await streamToBuffer(
    downloadResponse.readableStreamBody
  );
  return (downloadedContent as Buffer).toString();
};

async function streamToBuffer(
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

export const uploadFile = async (
  fileName: any,
  filePath: string,
  configuration: {
    accountName: string;
    accountKey: string;
    shareName: string;
  },
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
  await compressFile(filePath, compressedFilePath);
  await fileClient.uploadFile(compressedFilePath);
  fs.unlinkSync(compressedFilePath);
};

export const deleteFile = async (
  configuration: { accountName: string; accountKey: string; shareName: string },
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

export const addDirectory = async (
  configuration: { accountName: string; accountKey: string; shareName: string },
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
  const directoryClient = shareClient.getDirectoryClient(currentDirectoryPath);
  await directoryClient.createSubdirectory(directoryName);
};

export const deleteDirectory = async (
  configuration: { accountName: string; accountKey: string; shareName: string },
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

export const removeFileFromTempPath = (filePath: string) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
      return;
    }
    console.log("File removed from temp successfully");
  });
};

async function compressFile(
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

async function decompressStream(
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
