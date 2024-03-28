import { app, ipcMain } from "electron";
import { createRequire } from "node:module";
import type {
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from "electron-updater";

const { autoUpdater } = createRequire(import.meta.url)("electron-updater");
import { dialog } from "electron";
import { spawn } from "child_process";
const Opened = createRequire(import.meta.url)("@ronomon/opened");
export function update(win: Electron.BrowserWindow) {
  // When set to false, the update download will be triggered through the API
  autoUpdater.autoDownload = false;
  autoUpdater.disableWebInstaller = false;
  autoUpdater.allowDowngrade = false;

  // start check
  autoUpdater.on("checking-for-update", function () {});
  // update available
  autoUpdater.on("update-available", (arg: UpdateInfo) => {
    win.webContents.send("update-can-available", {
      update: true,
      version: app.getVersion(),
      newVersion: arg?.version,
    });
  });
  // update not available
  autoUpdater.on("update-not-available", (arg: UpdateInfo) => {
    win.webContents.send("update-can-available", {
      update: false,
      version: app.getVersion(),
      newVersion: arg?.version,
    });
  });

  // Checking for updates
  ipcMain.handle("check-update", async () => {
    if (!app.isPackaged) {
      const error = new Error(
        "The update feature is only available after the package."
      );
      return { message: error.message, error };
    }

    try {
      return await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      return { message: "Network error", error };
    }
  });

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
      let spawnRef;
      if (process.platform === "darwin") {
        spawnRef = spawn("open", [selectedPath]);
      } else {
        spawnRef = spawn("start", [selectedPath]);
      }
      let paths = [selectedPath];

      let intervalId: NodeJS.Timeout;
      intervalId = setInterval(async () => {
        let isFileOpen = await isFileOpened(paths);
        if (!isFileOpen) {
          clearInterval(intervalId!);
          ipcEvent.sender.send(
            "main-process-message",
            `The file ${selectedPath} is closed.`
          );
        }
      }, 5000);
    }
  );

  // Start downloading and feedback on progress
  ipcMain.handle("start-download", (event: Electron.IpcMainInvokeEvent) => {
    startDownload(
      (error, progressInfo) => {
        if (error) {
          // feedback download error message
          event.sender.send("update-error", { message: error.message, error });
        } else {
          // feedback update progress message
          event.sender.send("download-progress", progressInfo);
        }
      },
      () => {
        // feedback update downloaded message
        event.sender.send("update-downloaded");
      }
    );
  });

  // Install now
  ipcMain.handle("quit-and-install", () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

function startDownload(
  callback: (error: Error | null, info: ProgressInfo | null) => void,
  complete: (event: UpdateDownloadedEvent) => void
) {
  autoUpdater.on("download-progress", (info: ProgressInfo) =>
    callback(null, info)
  );
  autoUpdater.on("error", (error: Error) => callback(error, null));
  autoUpdater.on("update-downloaded", complete);
  autoUpdater.downloadUpdate();
}

async function isFileOpened(paths: string[]): Promise<boolean> {
  return new Promise((resolve, reject) => {
    Opened.files(
      paths,
      function (error: any, hashTable: { [x: string]: boolean }) {
        if (error) {
          reject(error);
        }
        resolve(hashTable[paths[0]]);
      }
    );
  });
}
