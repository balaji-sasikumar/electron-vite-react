import { app, ipcMain, shell } from "electron";
import { createRequire } from "node:module";
import { dialog } from "electron";
const Opened = createRequire(import.meta.url)("@ronomon/opened");
import * as fs from "fs";
import { exec } from "child_process";
import mime from "mime";
import { AES, enc } from "crypto-ts";
const key = "Balaji123456";
export function update(win: Electron.BrowserWindow) {
  ipcMain.handle(
    "open-dialog",
    async (ipcEvent: Electron.IpcMainInvokeEvent) => {
      let filePaths = await dialog.showOpenDialog({
        properties: ["openDirectory", "openFile"],
      });
      if (filePaths.canceled) {
        return "canceled";
      }
      let selectedPath = filePaths.filePaths[0];
      console.log("Selected path:", selectedPath);
      let tempPath = app.getPath("temp");
      // let tempPath = selectedPath
      //   .replace("Downloads", "Downloads/tmp")
      //   .split("/")
      //   .slice(0, -1)
      //   .join("/");
      let fileName = selectedPath.split("/").pop()?.split(".txt")[0];
      let newPath = tempPath + fileName;
      fs.readFile(selectedPath, (err, data) => {
        if (err) {
          console.error("Error reading file:", err);
          return;
        }
        let decrypted = AES.decrypt(data.toString(), key).toString(enc.Utf8);

        const base64Data = decrypted.split(",")[1];
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
        // fs.mkdir(tempPath, { recursive: true }, (err) => {
        //   if (err) {
        //     console.error("Error creating directory:", err);
        //     return;
        //   }

        // });
      });
      let paths = [newPath];

      let intervalId: NodeJS.Timeout;
      intervalId = setInterval(async () => {
        let isFileOpen = await isFileOpened(paths);
        if (!isFileOpen) {
          fs.readFile(newPath, (err, data) => {
            if (err) {
              console.error("Error reading file:", err);
              return;
            }
            const base64Data = Buffer.from(data).toString("base64");
            const dataURL = `data:${mime.getType(
              selectedPath
            )};base64,${base64Data}`;
            const encrypted = AES.encrypt(dataURL, key).toString();
            fs.writeFile(selectedPath, encrypted, (err) => {
              if (err) {
                console.error("Error writing file:", err);
                return;
              }
            });
            clearInterval(intervalId!);
            ipcEvent.sender.send(
              "main-process-message",
              `The file ${selectedPath} is closed on ${new Date()}`
            );
          });
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
          console.log(hashTable);
          resolve(hashTable[paths[0]]);
        }
      );
    } else {
      exec(`lsof -F n -- "${paths[0]}"`, (error, stdout, stderr) => {
        if (error || stderr) {
          resolve(false);
        }
        console.log(stdout);
        resolve(stdout.length > 0);
      });
    }
  });
}
