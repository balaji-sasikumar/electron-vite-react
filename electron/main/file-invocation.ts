import { ipcMain } from "electron";
import { dialog } from "electron";
import * as path from "path";
import * as os from "os";
import { createRequire } from "node:module";
const chokidar = createRequire(import.meta.url)("chokidar");
import {
  DATA_FORMAT_NOT_SUPPORTED,
  editableExtensions,
  supportedExtensions,
} from "./utils";
import { InvokeEvent } from "../../src/enums/invoke-event.enum";
import {
  addDirectory,
  decryptFile,
  deleteDirectory,
  deleteFile,
  downloadFile,
  encryptAndSaveFile,
  isFileOpened,
  listFiles,
  openFile,
  removeFileFromTempPath,
  uploadFile,
} from "./file-share";
import { Status } from "../../src/enums/status.enum";
let onlineStatus: boolean;
const deleteFileHandler = async (
  ipcEvent: Electron.IpcMainInvokeEvent,
  configuration: any,
  folderName: string,
  fileName: string
) => {
  try {
    configuration = JSON.parse(configuration);
    await deleteFile(configuration, folderName, fileName);
    ipcEvent.sender.send(InvokeEvent.TryFetch, "");
  } catch (error: any) {
    ipcEvent.sender.send(
      InvokeEvent.FileProcessing,
      Status.Error,
      error?.details?.message || "An error occurred while deleting the file"
    );
  }
};
const createDirectoryHandler = async (
  ipcEvent: Electron.IpcMainInvokeEvent,
  configuration: any,
  currentDirectoryPath: string,
  directoryName: string
) => {
  try {
    configuration = JSON.parse(configuration);
    await addDirectory(configuration, currentDirectoryPath, directoryName);
    ipcEvent.sender.send(InvokeEvent.TryFetch, "");
  } catch (error: any) {
    ipcEvent.sender.send(
      InvokeEvent.FileProcessing,
      Status.Error,
      error?.details?.message ||
        "An error occurred while creating the directory"
    );
  }
};
const deleteDirectoryHandler = async (
  ipcEvent: Electron.IpcMainInvokeEvent,
  configuration: any,
  directoryPath: string
) => {
  try {
    configuration = JSON.parse(configuration);
    await deleteDirectory(configuration, directoryPath);
    ipcEvent.sender.send(InvokeEvent.TryFetch, "");
  } catch (error: any) {
    ipcEvent.sender.send(
      InvokeEvent.FileProcessing,
      Status.Error,
      error?.details?.message ||
        "An error occurred while deleting the directory"
    );
  }
};
const uploadHandler = async (
  ipcEvent: Electron.IpcMainInvokeEvent,
  configuration: any,
  directories: string
) => {
  try {
    let filePaths = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Extension",
          extensions: supportedExtensions,
        },
      ],
    });
    if (filePaths.canceled) {
      return "canceled";
    }
    configuration = JSON.parse(configuration);

    let selectedPath = filePaths.filePaths[0];
    let tempPath = os.tmpdir();
    let toPath = path.join(tempPath, path.basename(selectedPath) + ".txt");

    ipcEvent.sender.send(InvokeEvent.Loading, true);
    await encryptAndSaveFile(selectedPath, toPath, configuration.privateKey);
    await uploadFile(
      path.basename(selectedPath) + ".txt.gz",
      toPath,
      configuration,
      directories
    );
    removeFileFromTempPath(toPath);
    ipcEvent.sender.send(InvokeEvent.Loading, false);
    ipcEvent.sender.send(InvokeEvent.TryFetch, "");
    ipcEvent.sender.send(
      InvokeEvent.FileProcessing,
      Status.Success,
      `The file ${path.basename(selectedPath)} is uploaded successfully`
    );
  } catch (error: any) {
    ipcEvent.sender.send(InvokeEvent.Loading, false);
    ipcEvent.sender.send(
      InvokeEvent.FileProcessing,
      Status.Error,
      error?.details?.message || "An error occurred while uploading the file"
    );
  }
};
const getFilesHandler = async (
  ipcEvent: Electron.IpcMainInvokeEvent,
  configuration: any,
  folderName: string
) => {
  configuration = JSON.parse(configuration);
  const res = await listFiles(configuration, folderName);
  ipcEvent.sender.send(InvokeEvent.GetFileResponse, res);
};
const openFileInvocation = async (
  ipcEvent: Electron.IpcMainInvokeEvent,
  file: { name: string },
  configuration: any,
  directories: string
) => {
  try {
    ipcEvent.sender.send(InvokeEvent.Loading, true);
    let isEditable = true;
    configuration = JSON.parse(configuration);
    if (!file.name.endsWith(".txt") && !file.name.endsWith(".gz")) {
      ipcEvent.sender.send(
        InvokeEvent.FileProcessing,
        Status.Error,
        `The file ${file.name} is not supported`
      );
      ipcEvent.sender.send(InvokeEvent.Loading, false);
      return;
    }
    let fileData = await downloadFile(file, configuration, directories);

    let tempPath = os.tmpdir();
    let fileName = file.name.split(".txt")[0];
    let newPath = path.join(tempPath, fileName);
    let key = configuration.privateKey;
    let decrypted = decryptFile(fileData.toString(), key);

    if (decrypted === DATA_FORMAT_NOT_SUPPORTED) {
      ipcEvent.sender.send(InvokeEvent.Loading, false);
      ipcEvent.sender.send(
        InvokeEvent.FileProcessing,
        Status.Error,
        `The file ${fileName} is not supported`
      );
      return;
    }
    const base64Data = decrypted.split(",")[1];
    openFile(tempPath, newPath, base64Data);

    ipcEvent.sender.send(InvokeEvent.Loading, false);
    const actualExt = file.name.split(".")[1].toLowerCase();
    isEditable = editableExtensions.includes(actualExt);

    let paths = [newPath];
    let intervalId: NodeJS.Timeout;
    try {
      let isAlreadyOpened = await isFileOpened(paths).catch(() => false);
      if (isAlreadyOpened) {
        ipcEvent.sender.send(InvokeEvent.Loading, false);
        ipcEvent.sender.send(
          InvokeEvent.FileProcessing,
          Status.Error,
          `The file ${file.name} is already opened`
        );
        return;
      }
    } catch (error) {}
    let skipInitialChange = true;
    const watcher = chokidar
      .watch(newPath, { awaitWriteFinish: true })
      .on("all", async (event: any, path: any) => {
        console.log(event, path);
        if (skipInitialChange) {
          skipInitialChange = false;
          return;
        }
        if (isEditable && event === "change") {
          ipcEvent.sender.send(InvokeEvent.Loading, true);
          if (!onlineStatus) {
            ipcEvent.sender.send(InvokeEvent.Loading, false);
            ipcEvent.sender.send(
              InvokeEvent.FileProcessing,
              Status.Error,
              `File ${file.name} cannot be edited in offline mode`
            );
            return;
          }
          const encryptedPath = newPath + ".txt";

          await encryptAndSaveFile(newPath, encryptedPath, key);
          await uploadFile(
            file.name,
            encryptedPath,
            configuration,
            directories
          );
          removeFileFromTempPath(encryptedPath);
          ipcEvent.sender.send(InvokeEvent.Loading, false);
        }
      });
    intervalId = setInterval(async () => {
      let isFileOpen = await isFileOpened(paths).catch(() => false);
      if (!isFileOpen) {
        removeFileFromTempPath(newPath);
        clearInterval(intervalId);
        watcher.close();
        ipcEvent.sender.send(InvokeEvent.Loading, false);
      }
    }, 5000);
  } catch (error: any) {
    ipcEvent.sender.send(InvokeEvent.Loading, false);
    ipcEvent.sender.send(
      InvokeEvent.FileProcessing,
      Status.Error,
      error?.details?.message || "An error occurred while opening the file"
    );
  }
};
const loadingHandler = async (
  ipcEvent: Electron.IpcMainInvokeEvent,
  loading: any
) => {
  ipcEvent.sender.send(InvokeEvent.Loading, loading);
};
export function fileInvocation(win: Electron.BrowserWindow) {
  ipcMain.on("online-status", (event, status) => {
    onlineStatus = status;
  });
  ipcMain.handle(InvokeEvent.DeleteFile, deleteFileHandler);
  ipcMain.handle(InvokeEvent.CreateDirectory, createDirectoryHandler);
  ipcMain.handle(InvokeEvent.DeleteDirectory, deleteDirectoryHandler);
  ipcMain.handle(InvokeEvent.UploadFromPC, uploadHandler);
  ipcMain.handle(InvokeEvent.GetFiles, getFilesHandler);
  ipcMain.handle(InvokeEvent.OpenFile, openFileInvocation);
  ipcMain.handle(InvokeEvent.Loading, loadingHandler);
}
