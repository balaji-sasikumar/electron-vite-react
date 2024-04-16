import { app, ipcMain, shell } from "electron";
import { createRequire } from "node:module";
import { dialog } from "electron";
const Opened = createRequire(import.meta.url)("@ronomon/opened");
import * as fs from "fs";
import { exec } from "child_process";
import mime from "mime";
import { AES, enc } from "crypto-ts";
import * as path from "path";
import {
  ShareServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-file-share";

import {
  key,
  chunkSeparator,
  DATA_FORMAT_NOT_SUPPORTED,
  chunkSize,
} from "./utils";

export function update(win: Electron.BrowserWindow) {
  ipcMain.handle(
    "delete-file",
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      configuration,
      folderName,
      fileName
    ) => {
      configuration = JSON.parse(configuration);
      await deleteFile(configuration, folderName, fileName);
      ipcEvent.sender.send(
        "file-processing",
        `The file ${fileName} is deleted successfully`,
        `${new Date().toLocaleString()}`
      );
    }
  );
  ipcMain.handle(
    "create-directory",
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      configuration,
      currentDirectoryPath,
      directoryName
    ) => {
      configuration = JSON.parse(configuration);
      await addDirectory(configuration, currentDirectoryPath, directoryName);
    }
  );
  ipcMain.handle(
    "delete-directory",
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      configuration,
      directoryPath
    ) => {
      configuration = JSON.parse(configuration);
      try {
        await deleteDirectory(configuration, directoryPath);
      } catch (error: any) {
        ipcEvent.sender.send(
          "file-processing",
          error.details.message,
          `${new Date().toLocaleString()}`
        );
      }
    }
  );

  ipcMain.handle(
    "upload-from-pc",
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      configuration,
      directories
    ) => {
      let filePaths = await dialog.showOpenDialog({
        properties: ["openFile"],
      });
      if (filePaths.canceled) {
        return "canceled";
      }
      configuration = JSON.parse(configuration);

      let selectedPath = filePaths.filePaths[0];
      let tempPath = app.getPath("temp");
      let toPath = tempPath + path.basename(selectedPath) + ".txt";

      await encryptAndSaveFile(selectedPath, toPath);
      await uploadFile(
        path.basename(selectedPath) + ".txt",
        toPath,
        configuration,
        directories
      );
      removeFileFromTempPath(toPath);
      ipcEvent.sender.send(
        "file-processing",
        `The file ${path.basename(selectedPath)} is uploaded successfully`,
        `${new Date().toLocaleString()}`
      );
    }
  );
  ipcMain.handle(
    "get-file",
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      configuration,
      folderName
    ) => {
      configuration = JSON.parse(configuration);
      const res = await listFiles(configuration, folderName);
      ipcEvent.sender.send("get-fileshare-data", res);
      return res;
    }
  );
  ipcMain.handle(
    "open-file",
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      file,
      configuration,
      directories
    ) => {
      configuration = JSON.parse(configuration);
      if (!file.name.endsWith(".txt")) {
        ipcEvent.sender.send(
          "file-processing",
          `The file ${file.name} is not supported`,
          `${new Date().toLocaleString()}`
        );
        return;
      }
      let fileData = await downloadFile(file, configuration, directories);
      let tempPath = app.getPath("temp");
      let fileName = file.name.split(".txt")[0];
      let newPath = tempPath + fileName;

      let decrypted = decryptFile(fileData.toString());

      if (decrypted === DATA_FORMAT_NOT_SUPPORTED) {
        ipcEvent.sender.send(
          "file-processing",
          `The file ${fileName} is not supported`,
          `${new Date().toLocaleString()}`
        );
        return;
      }
      const base64Data = decrypted.split(",")[1];

      openFile(tempPath, newPath, base64Data);
      let paths = [newPath];
      let intervalId: NodeJS.Timeout;
      intervalId = setInterval(async () => {
        let isFileOpen = await isFileOpened(paths);
        if (!isFileOpen) {
          await encryptAndSaveFile(newPath, newPath + ".txt");
          await uploadFile(
            file.name,
            newPath + ".txt",
            configuration,
            directories
          );
          removeFileFromTempPath(newPath);
          removeFileFromTempPath(newPath + ".txt");
          clearInterval(intervalId!);
          ipcEvent.sender.send(
            "file-processing",
            `The file ${fileName} is processed successfully`,
            `${new Date().toLocaleString()}`
          );
        }
      }, 5000);
    }
  );
}

async function isFileOpened(paths: string[]): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (process.platform === "win32") {
      Opened.files(
        paths,
        function (error: any, hashTable: { [x: string]: boolean }) {
          if (error) {
            reject(error);
          }
          resolve(hashTable[paths[0]]);
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
}

async function convertFileToBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) =>
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(Buffer.from(data).toString("base64"));
    })
  );
}

function encryptFile(fileDataUrl: string) {
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
}
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

function decryptFile(encryptedData: string) {
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
}
async function encryptAndSaveFile(fromPath: string, toPath: string) {
  return new Promise<void>(async (resolve, reject) => {
    const base64Data = await convertFileToBase64(fromPath);
    const dataURL = `data:${mime.getType(toPath)};base64,${base64Data}`;
    const encrypted = encryptFile(dataURL);
    fs.writeFile(toPath, encrypted, (err) => {
      if (err) {
        console.error("Error writing file:", err);
        reject(err);
        return;
      }
      resolve();
    });
  });
}
function openFile(tempPath: string, newPath: string, base64Data: string) {
  fs.mkdir(tempPath, { recursive: true }, (err) => {
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
}

const listFiles = async (
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

const downloadFile = async (
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

const uploadFile = async (
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
  const fileClient = directoryClient.getFileClient(fileName);
  const content = fs.readFileSync(filePath);
  await fileClient.create(content.length);
  await fileClient.uploadRange(content, 0, content.length);
};

const deleteFile = async (
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

const addDirectory = async (
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

const deleteDirectory = async (
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

const removeFileFromTempPath = (filePath: string) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
      return;
    }
    console.log("File deleted successfully");
  });
};
