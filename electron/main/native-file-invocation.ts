import { ipcMain } from "electron";
import { dialog } from "electron";
import * as path from "path";
import { supportedExtensions } from "./utils";
import { InvokeEvent } from "../../src/enums/invoke-event.enum";
import { Status } from "../../src/enums/status.enum";
import { File } from "electron/interfaces/file.interface";
import { NativeFile } from "./native-file";
export class NativeFileInvocationHandler {
  fileShare = NativeFile.getInstance();

  private constructor() {}

  deleteFileHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    folderName: string,
    fileName: string
  ) => {
    try {
      await this.fileShare.deleteFile(folderName, fileName);
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
    } catch (error: any) {
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Error,
        error?.details?.message ||
          error.message ||
          "An error occurred while deleting the file"
      );
    }
  };

  createDirectoryHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    currentDirectoryPath: string,
    directoryName: string
  ) => {
    try {
      await this.fileShare.addDirectory(currentDirectoryPath, directoryName);
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
      ipcEvent.sender.send(InvokeEvent.CreatedState, directoryName);
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Success,
        `The directory ${directoryName} is created successfully`
      );
    } catch (error: any) {
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Error,
        error?.details?.message ||
          "An error occurred while creating the directory"
      );
    }
  };

  deleteDirectoryHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    directoryPath: string
  ) => {
    try {
      await this.fileShare.deleteDirectory(directoryPath);
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
    } catch (error: any) {
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Error,
        error?.details?.message ||
          "An error occurred while deleting the directory"
      );
    }
  };

  uploadHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    directories: string
  ) => {
    try {
      let filePaths = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Extension", extensions: supportedExtensions }],
      });

      if (filePaths.canceled) return "canceled";

      let selectedPath = filePaths.filePaths[0];

      this.loadingHandler(ipcEvent, true);

      let isAlreadyExists = await this.fileShare.checkFileExists(
        path.basename(selectedPath),
        directories
      );
      if (isAlreadyExists) {
        throw new Error(
          `The file ${path.basename(
            selectedPath
          )} already exists in the directory`
        );
      }

      await this.fileShare.uploadFile(
        path.basename(selectedPath),
        selectedPath,
        directories
      );

      ipcEvent.sender.send(
        InvokeEvent.CreatedState,
        path.basename(selectedPath)
      );
      this.loadingHandler(ipcEvent, false);
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Success,
        `The file ${path.basename(selectedPath)} is uploaded successfully`
      );
    } catch (error: any) {
      this.loadingHandler(ipcEvent, false);
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Error,
        error?.details?.message ||
          error.message ||
          "An error occurred while uploading the file"
      );
    }
  };

  getFilesHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    configuration: any,
    folderName: string,
    prefix?: string
  ) => {
    try {
      if (!configuration) {
        ipcEvent.sender.send(InvokeEvent.GetFileResponse, []);
        return;
      }
      const [res, currentDirectory] = await this.fileShare.listFiles(
        configuration,
        folderName,
        prefix
      );
      ipcEvent.sender.send(InvokeEvent.SetCurrentDirectory, currentDirectory);
      ipcEvent.sender.send(InvokeEvent.GetFileResponse, res);
    } catch (error: any) {
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Error,
        error?.details?.message || "An error occurred while fetching the files"
      );
    }
  };

  openFileInvocation = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    file: File,
    directories: string
  ) => {
    let viewPath = path.join(directories, file.name);

    try {
      this.loadingHandler(ipcEvent, true);
      await this.fileShare.openFile(viewPath);
      this.loadingHandler(ipcEvent, false);
    } catch (error: any) {
      this.loadingHandler(ipcEvent, false);
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Error,
        error?.details?.message ||
          error.message ||
          "An error occurred while opening the file"
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
    folderPath: string
  ) => {
    try {
      const res = await this.fileShare.getDirectoryTree(folderPath);
      ipcEvent.sender.send(InvokeEvent.GetDirectoryTreeResponse, res);
    } catch {
      ipcEvent.sender.send(InvokeEvent.GetDirectoryTreeResponse, []);
    }
  };

  renameFolderHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    folderPath: string,
    newFolderName: string
  ) => {
    try {
      await this.fileShare.renameFolder(folderPath, newFolderName);
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
    } catch (error: any) {
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Error,
        error?.details?.message ||
          error.message ||
          "An error occurred while renaming the directory"
      );
    }
  };

  renameFileHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    folderPath: string,
    fileName: string,
    newFileName: string
  ) => {
    try {
      await this.fileShare.renameFile(folderPath, fileName, newFileName);
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
    } catch (error: any) {
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Error,
        error?.details?.message ||
          error.message ||
          "An error occurred while renaming the file"
      );
    }
  };

  public static getInstance() {
    return new NativeFileInvocationHandler();
  }
}

export function nativeFileInvocation(win: Electron.BrowserWindow) {
  const fileInvocationHandler = NativeFileInvocationHandler.getInstance();

  const handlerRecord: Record<string, any> = {
    [InvokeEvent.DeleteFile]: fileInvocationHandler.deleteFileHandler,
    [InvokeEvent.CreateDirectory]: fileInvocationHandler.createDirectoryHandler,
    [InvokeEvent.DeleteDirectory]: fileInvocationHandler.deleteDirectoryHandler,
    [InvokeEvent.UploadFromPC]: fileInvocationHandler.uploadHandler,
    [InvokeEvent.GetFiles]: fileInvocationHandler.getFilesHandler,
    [InvokeEvent.OpenFile]: fileInvocationHandler.openFileInvocation,
    [InvokeEvent.Loading]: fileInvocationHandler.loadingHandler,
    [InvokeEvent.GetDirectoryTree]:
      fileInvocationHandler.getDirectoryTreeHandler,
    [InvokeEvent.RenameFolder]: fileInvocationHandler.renameFolderHandler,
    [InvokeEvent.RenameFile]: fileInvocationHandler.renameFileHandler,
  };

  for (const [key, value] of Object.entries(handlerRecord)) {
    ipcMain.handle(key, value);
  }
}
