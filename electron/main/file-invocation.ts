import { ipcMain } from "electron";
import { dialog } from "electron";
import * as path from "path";
import {
  DATA_FORMAT_NOT_SUPPORTED,
  editableExtensions,
  supportedExtensions,
} from "./utils";
import { InvokeEvent } from "../../src/enums/invoke-event.enum";
import { FileShare } from "./file-share";
import { Status } from "../../src/enums/status.enum";
import { Configuration } from "electron/interfaces/configuration.interface";
let onlineStatus: boolean;

export class FileInvocationHandler {
  fileShare = FileShare.getInstance();
  openFilesMap = new Map<string, string>();
  private constructor() {}

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
      let toPath = this.fileShare.getSharedStoragePath(
        configuration.tempPath,
        path.basename(selectedPath) + ".txt"
      );

      this.loadingHandler(ipcEvent, true);
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
      this.loadingHandler(ipcEvent, false);
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
      ipcEvent.sender.send(
        InvokeEvent.FileProcessing,
        Status.Success,
        `The file ${path.basename(selectedPath)} is uploaded successfully`
      );
    } catch (error: any) {
      this.loadingHandler(ipcEvent, false);
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
      this.loadingHandler(ipcEvent, true);
      configuration = JSON.parse(configuration);
      if (!file.name.endsWith(".txt") && !file.name.endsWith(".gz")) {
        ipcEvent.sender.send(
          InvokeEvent.FileProcessing,
          Status.Error,
          `The file ${file.name} is not supported for opening`
        );
        this.loadingHandler(ipcEvent, false);
        return;
      }
      let viewPath = this.fileShare.getSharedStoragePath(
        configuration.tempPath,
        file.name.split(".txt")[0]
      );
      if (this.openFilesMap.has(file.name)) {
        this.loadingHandler(ipcEvent, false);
        ipcEvent.sender.send(
          InvokeEvent.FileProcessing,
          Status.Error,
          `The file ${path.basename(viewPath)} is already opened`
        );
        return;
      }
      this.openFilesMap.set(file.name, "Opening");

      let fileData = await this.fileShare.downloadFile(
        file,
        configuration,
        directories
      );

      let key = configuration.privateKey;
      let decrypted = this.fileShare.decryptFile(fileData.toString(), key);

      if (decrypted === DATA_FORMAT_NOT_SUPPORTED) {
        this.loadingHandler(ipcEvent, false);
        ipcEvent.sender.send(
          InvokeEvent.FileProcessing,
          Status.Error,
          `The file ${path.basename(viewPath)} is not in the correct format`
        );
        this.openFilesMap.delete(file.name);
        return;
      }
      const base64Data = decrypted.split(",")[1];
      await this.fileShare.openFile(viewPath, base64Data);

      this.loadingHandler(ipcEvent, false);
      const actualExt = file.name.split(".")[1].toLowerCase();
      let isEditable = editableExtensions.includes(actualExt);

      let paths = [viewPath];
      let intervalId: NodeJS.Timeout;

      intervalId = setInterval(async () => {
        let isFileOpen = await this.fileShare
          .isFileOpened(paths)
          .catch(() => false);
        this.openFilesMap.set(file.name, "Opened");

        if (!isFileOpen) {
          if (isEditable) {
            await this.saveAndUpload(
              ipcEvent,
              file,
              viewPath,
              configuration,
              directories
            );
          }
          this.fileShare.removeFileFromTempPath(viewPath);
          clearInterval(intervalId);
          ipcEvent.sender.send(InvokeEvent.TryFetch, "");
          this.loadingHandler(ipcEvent, false);
          this.openFilesMap.delete(file.name);
        }
      }, 5000);
    } catch (error: any) {
      console.log(error);
      this.loadingHandler(ipcEvent, false);
      this.openFilesMap.delete(file.name);
      ipcEvent.sender.send(
        InvokeEvent.FileProcessing,
        Status.Error,
        error?.details?.message || "An error occurred while opening the file"
      );
    }
  };
  loadingHandler = (
    ipcEvent: Electron.IpcMainInvokeEvent,
    loading: boolean
  ) => {
    ipcEvent.sender.send(InvokeEvent.Loading, loading);
  };
  getDirectoryTreeHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    configuration: any,
    folderPath: string
  ) => {
    configuration = JSON.parse(configuration);
    const res = await this.fileShare.getDirectoryTree(
      configuration,
      folderPath
    );
    ipcEvent.sender.send(InvokeEvent.GetDirectoryTreeResponse, res);
  };

  private saveAndUpload = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    file: { name: any },
    filePath: string,
    configuration: Configuration,
    directories: string
  ) => {
    this.loadingHandler(ipcEvent, true);
    if (!onlineStatus) {
      this.loadingHandler(ipcEvent, false);
      ipcEvent.sender.send(
        InvokeEvent.FileProcessing,
        Status.Error,
        `File ${file.name} cannot be saved in offline mode`
      );
      return;
    }
    // filePath is the path of the file that is being opened
    const encryptedPath = filePath + ".txt";

    await this.fileShare.encryptAndSaveFile(
      filePath,
      encryptedPath,
      configuration.privateKey as string
    );
    await this.fileShare.uploadFile(
      file.name,
      encryptedPath,
      configuration,
      directories
    );
    this.fileShare.removeFileFromTempPath(encryptedPath);
    this.loadingHandler(ipcEvent, false);
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
  ipcMain.handle(
    InvokeEvent.GetDirectoryTree,
    fileInvocationHandler.getDirectoryTreeHandler
  );
}
