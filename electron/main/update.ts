import { app, ipcMain, shell } from "electron";
import { createRequire } from "node:module";
import { dialog } from "electron";
const Opened = createRequire(import.meta.url)("@ronomon/opened");
import * as fs from "fs";
import { exec } from "child_process";
import mime from "mime";
import { AES, enc } from "crypto-ts";
import * as path from "path";

const key = "Balaji123456";
const chunkSize = 10 * 1024 * 1024;
const chunkSeparator = "###"; // Unique separator
const bytesInMb = 1048576;
const DATA_FORMAT_NOT_SUPPORTED = "Data format not supported";

export function update(win: Electron.BrowserWindow) {
  ipcMain.handle(
    "convert-file",
    async (ipcEvent: Electron.IpcMainInvokeEvent) => {
      let filePaths = await dialog.showOpenDialog({
        properties: ["openFile"],
      });
      if (filePaths.canceled) {
        return "canceled";
      }
      let selectedPath = filePaths.filePaths[0];
      encryptAndSaveFile(selectedPath, selectedPath + ".txt");
      ipcEvent.sender.send(
        "file-processing",
        `The file ${selectedPath} is converted successfully`,
        `${new Date().toLocaleString()}`
      );
    }
  );

  ipcMain.handle(
    "open-dialog",
    async (ipcEvent: Electron.IpcMainInvokeEvent) => {
      let filePaths = await dialog.showOpenDialog({
        properties: ["openFile"],
      });
      if (filePaths.canceled) {
        return "canceled";
      }
      let selectedPath = filePaths.filePaths[0];
      let tempPath = app.getPath("temp");

      if (!selectedPath.endsWith(".txt")) {
        ipcEvent.sender.send(
          "file-processing",
          `The file ${selectedPath} is not supported`,
          `${new Date().toLocaleString()}`
        );
        return;
      }
      let fileName = path.basename(selectedPath).split(".txt")[0];
      let newPath = tempPath + fileName;

      fs.readFile(selectedPath, (err, data) => {
        if (err) {
          console.error("Error reading file:", err);
          return;
        }
        let decrypted = decryptFile(data.toString());

        if (decrypted === DATA_FORMAT_NOT_SUPPORTED) {
          ipcEvent.sender.send(
            "file-processing",
            `The file ${selectedPath} is not supported`,
            `${new Date().toLocaleString()}`
          );
          return;
        }

        const base64Data = decrypted.split(",")[1];

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
      });
      let paths = [newPath];

      let intervalId: NodeJS.Timeout;
      intervalId = setInterval(async () => {
        let isFileOpen = await isFileOpened(paths);
        if (!isFileOpen) {
          encryptAndSaveFile(newPath, selectedPath);
          clearInterval(intervalId!);
          ipcEvent.sender.send(
            "file-processing",
            `The file ${selectedPath} is processed successfully`,
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
  const base64Data = await convertFileToBase64(fromPath);
  const dataURL = `data:${mime.getType(toPath)};base64,${base64Data}`;
  const encrypted = encryptFile(dataURL);
  fs.writeFile(toPath, encrypted, (err) => {
    if (err) {
      console.error("Error writing file:", err);
      return;
    }
  });
}
