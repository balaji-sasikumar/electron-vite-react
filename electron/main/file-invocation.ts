import { ipcMain } from "electron";
import { dialog } from "electron";
import * as path from "path";
import { createRequire } from "node:module";
const chokidar = createRequire(import.meta.url)("chokidar");
import {
  DATA_FORMAT_NOT_SUPPORTED,
  editableExtensions,
  supportedExtensions,
} from "./utils";
import { InvokeEvent } from "../../src/enums/invoke-event.enum";
import { FileShare } from "./file-share";
import { Status } from "../../src/enums/status.enum";
let onlineStatus: boolean;

export class FileInvocationHandler {
  fileShare = FileShare.getInstance();

  deleteFileHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    configuration: any,
    folderName: string,
    fileName: string
  ) => {
    try {
      configuration = JSON.parse(configuration);
      await this.fileShare.deleteFile(configuration, folderName, fileName);
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
    } catch (error: any) {
      ipcEvent.sender.send(
        InvokeEvent.FileProcessing,
        Status.Error,
        error?.details?.message || "An error occurred while deleting the file"
      );
    }
  };
  createDirectoryHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    configuration: any,
    currentDirectoryPath: string,
    directoryName: string
  ) => {
    try {
      configuration = JSON.parse(configuration);
      await this.fileShare.addDirectory(
        configuration,
        currentDirectoryPath,
        directoryName
      );
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
  deleteDirectoryHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    configuration: any,
    directoryPath: string
  ) => {
    try {
      configuration = JSON.parse(configuration);
      await this.fileShare.deleteDirectory(configuration, directoryPath);
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
  uploadHandler = async (
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
      let toPath = this.fileShare.getTempPath(
        path.basename(selectedPath) + ".txt"
      );

      ipcEvent.sender.send(InvokeEvent.Loading, true);
      await this.fileShare.encryptAndSaveFile(
        selectedPath,
        toPath,
        configuration.privateKey
      );
      await this.fileShare.uploadFile(
        path.basename(selectedPath) + ".txt.gz",
        toPath,
        configuration,
        directories
      );
      this.fileShare.removeFileFromTempPath(toPath);
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
  getFilesHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    configuration: any,
    folderName: string
  ) => {
    configuration = JSON.parse(configuration);
    const res = await this.fileShare.listFiles(configuration, folderName);
    ipcEvent.sender.send(InvokeEvent.GetFileResponse, res);
  };
  openFileInvocation = async (
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
      let fileData = await this.fileShare.downloadFile(
        file,
        configuration,
        directories
      );

      let newPath = this.fileShare.getTempPath(file.name.split(".txt")[0]);

      let key = configuration.privateKey;
      try {
        let isAlreadyOpened = await this.fileShare
          .isFileOpened([newPath])
          .catch(() => false);
        if (isAlreadyOpened) {
          ipcEvent.sender.send(InvokeEvent.Loading, false);
          ipcEvent.sender.send(
            InvokeEvent.FileProcessing,
            Status.Error,
            `The file ${path.basename(newPath)} is already opened`
          );
          return;
        }
      } catch (error) {}
      let decrypted = this.fileShare.decryptFile(fileData.toString(), key);

      if (decrypted === DATA_FORMAT_NOT_SUPPORTED) {
        ipcEvent.sender.send(InvokeEvent.Loading, false);
        ipcEvent.sender.send(
          InvokeEvent.FileProcessing,
          Status.Error,
          `The file ${path.basename(newPath)} is not supported`
        );
        return;
      }
      const base64Data = decrypted.split(",")[1];
      this.fileShare.openFile(newPath, base64Data);

      ipcEvent.sender.send(InvokeEvent.Loading, false);
      const actualExt = file.name.split(".")[1].toLowerCase();
      isEditable = editableExtensions.includes(actualExt);

      let paths = [newPath];
      let intervalId: NodeJS.Timeout;

      let skipInitialChange = true;
      const watcher = chokidar
        .watch(newPath, { awaitWriteFinish: true })
        .on("change", async (path: any) => {
          console.log(path);
          if (skipInitialChange) {
            skipInitialChange = false;
            return;
          }
          if (isEditable) {
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

            await this.fileShare.encryptAndSaveFile(
              newPath,
              encryptedPath,
              key
            );
            await this.fileShare.uploadFile(
              file.name,
              encryptedPath,
              configuration,
              directories
            );
            this.fileShare.removeFileFromTempPath(encryptedPath);
            ipcEvent.sender.send(InvokeEvent.Loading, false);
          }
        });
      intervalId = setInterval(async () => {
        let isFileOpen = await this.fileShare
          .isFileOpened(paths)
          .catch(() => false);
        if (!isFileOpen) {
          this.fileShare.removeFileFromTempPath(newPath);
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
  loadingHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    loading: any
  ) => {
    ipcEvent.sender.send(InvokeEvent.Loading, loading);
  };
  public static getInstance() {
    return new FileInvocationHandler();
  }
}

export function fileInvocation(win: Electron.BrowserWindow) {
  const fileInvocationHandler: FileInvocationHandler =
    FileInvocationHandler.getInstance();

  ipcMain.on("online-status", (event, status) => {
    onlineStatus = status;
  });
  ipcMain.handle(
    InvokeEvent.DeleteFile,
    fileInvocationHandler.deleteFileHandler
  );
  ipcMain.handle(
    InvokeEvent.CreateDirectory,
    fileInvocationHandler.createDirectoryHandler
  );
  ipcMain.handle(
    InvokeEvent.DeleteDirectory,
    fileInvocationHandler.deleteDirectoryHandler
  );
  ipcMain.handle(InvokeEvent.UploadFromPC, fileInvocationHandler.uploadHandler);
  ipcMain.handle(InvokeEvent.GetFiles, fileInvocationHandler.getFilesHandler);
  ipcMain.handle(
    InvokeEvent.OpenFile,
    fileInvocationHandler.openFileInvocation
  );
  ipcMain.handle(InvokeEvent.Loading, fileInvocationHandler.loadingHandler);
}
