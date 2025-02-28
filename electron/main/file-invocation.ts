import { ipcMain } from "electron";
import { dialog } from "electron";
import * as path from "path";
import { editableExtensions, supportedExtensions } from "./utils";
import { InvokeEvent } from "../../src/enums/invoke-event.enum";
import { FileShare } from "./file-share";
import { Status } from "../../src/enums/status.enum";
import { Configuration } from "electron/interfaces/configuration.interface";
import { File } from "electron/interfaces/file.interface";
import { config } from "../config";
import { createRequire } from "node:module";
const chokidar = createRequire(import.meta.url)("chokidar");

let onlineStatus: boolean;
export class FileInvocationHandler {
  fileShare = FileShare.getInstance();
  openFilesMap = new Map<string, string>();
  openFoldersMap = new Map<string, number>();
  withEncryption = config.withEncryption;
  private constructor() {}

  deleteFileHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    configuration: any,
    folderName: string,
    fileName: string
  ) => {
    try {
      if (this.openFilesMap.has(folderName + "/" + fileName)) {
        throw new Error("Please close the file before deleting");
      }

      configuration = JSON.parse(configuration);
      await this.fileShare.deleteFile(configuration, folderName, fileName);
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
    configuration: any,
    directoryPath: string
  ) => {
    try {
      configuration = JSON.parse(configuration);
      await this.fileShare.deleteDirectory(configuration, directoryPath);
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

      this.loadingHandler(ipcEvent, true);

      let isAlreadyExists = await this.fileShare.checkFileExists(
        this.withEncryption
          ? path.basename(selectedPath) + ".txt.gz"
          : path.basename(selectedPath),
        configuration,
        directories
      );
      if (isAlreadyExists) {
        throw new Error(
          `The file ${path.basename(
            selectedPath
          )} already exists in the directory`
        );
      }

      if (this.withEncryption) {
        let toPath = this.fileShare.getSharedStoragePath(
          configuration.tempPath,
          directories,
          path.basename(selectedPath) + ".txt"
        );

        await this.fileShare.encryptAndSaveFile(
          selectedPath,
          toPath,
          configuration.privateKey
        );

        let uploadFilePath = path.basename(selectedPath) + ".txt.gz";
        await this.fileShare.uploadFile(
          uploadFilePath,
          toPath,
          configuration,
          directories
        );
        this.fileShare.removeFileFromTempPath(toPath);

        ipcEvent.sender.send(InvokeEvent.CreatedState, uploadFilePath);
      } else {
        await this.fileShare.uploadFile(
          path.basename(selectedPath),
          selectedPath,
          configuration,
          directories
        );

        ipcEvent.sender.send(
          InvokeEvent.CreatedState,
          path.basename(selectedPath)
        );
      }

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
      configuration = JSON.parse(configuration);
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
    configuration: any,
    directories: string
  ) => {
    let downloadedLocation: string = "",
      viewPath: string = "",
      directoryParts = directories.split("/"),
      isUploading = false;

    const modifyFoldersMap = (directoryParts: string[], value: number) => {
      for (let i = 0; i < directoryParts.length; i++) {
        let currentPath = directoryParts.slice(0, i + 1).join("/");
        this.openFoldersMap.set(
          currentPath,
          (this.openFoldersMap.get(currentPath) ?? 0) + value
        );
      }
    };

    try {
      this.loadingHandler(ipcEvent, true);
      configuration = JSON.parse(configuration);

      if (
        !file.name.endsWith(".txt") &&
        !this.withEncryption &&
        file.name.endsWith(".gz")
      ) {
        throw new Error(`The file ${file.name} is not supported for opening`);
      }

      viewPath = this.fileShare.getSharedStoragePath(
        configuration.tempPath,
        directories,
        this.withEncryption ? file.name.split(".txt")[0] : file.name
      );

      if (this.openFilesMap.has(directories + "/" + file.name)) {
        ipcEvent.sender.send(
          InvokeEvent.FileProcessingMessage,
          Status.Error,
          `The file ${path.basename(viewPath)} is already opened`
        );
        this.loadingHandler(ipcEvent, false);
        return;
      }

      this.openFilesMap.set(directories + "/" + file.name, "Opening");
      modifyFoldersMap(directoryParts, 1);

      let metadata = await this.fileShare.getMetadata(
        file,
        configuration,
        directories
      );
      let isNewFormat = Boolean(metadata?.stream) ?? false;
      downloadedLocation = path.join(
        path.dirname(viewPath),
        file.name.replace(".gz", "")
      );

      await this.fileShare.downloadFile(
        file,
        configuration,
        directories,
        viewPath
      );

      if (this.withEncryption) {
        let key = configuration.privateKey;
        await this.fileShare
          .decryptAndSaveFile(downloadedLocation, viewPath, key, isNewFormat)
          .catch((_error) => {
            throw new Error(
              `The file ${path.basename(viewPath)} is not in the correct format`
            );
          });
        this.fileShare.removeFileFromTempPath(downloadedLocation);
      }

      await this.fileShare.openFile(viewPath);
      this.loadingHandler(ipcEvent, false);
      const actualExt = file.name.split(".")[1].toLowerCase();
      let isEditable = editableExtensions.includes(actualExt);
      let paths = [viewPath];

      /** ------------------------- Watch for File Changes & Sync ------------------------ */

      const watcher = chokidar
        .watch(viewPath, {
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100,
          },
        })
        .on("change", async () => {
          console.log(`File ${viewPath} changed. Uploading...`);
          if (isEditable || !isNewFormat) {
            if (!isNewFormat) {
              ipcEvent.sender.send(
                InvokeEvent.FileProcessingMessage,
                Status.Info,
                "The file is not in the new format. We are converting it to the new format.",
                true
              );
            }

            // Set upload state
            isUploading = true;
            await this.saveAndUpload(
              ipcEvent,
              file,
              viewPath,
              configuration,
              directories
            );
            isUploading = false;
          }
        });

      /** ------------------------- Monitor File Closing & Cleanup ------------------------ */

      const intervalId = setInterval(async () => {
        let isFileOpen = await this.fileShare
          .isFileOpened(paths)
          .catch(() => false);

        if (!isFileOpen) {
          if (isUploading) {
            console.log(
              `File ${viewPath} closed, but upload is in progress. Waiting...`
            );
            return; // Skip cleanup if still uploading
          }

          clearInterval(intervalId);
          watcher.close();
          console.log(`File ${viewPath} closed. Cleaning up...`);

          this.fileShare.removeFileFromTempPath(viewPath);
          ipcEvent.sender.send(InvokeEvent.TryFetch, "");
          this.loadingHandler(ipcEvent, false);
          this.openFilesMap.delete(directories + "/" + file.name);
          modifyFoldersMap(directoryParts, -1);
        }
      }, 5000);
    } catch (error: any) {
      console.error("Error:", error);
      this.loadingHandler(ipcEvent, false);
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Error,
        error?.details?.message ||
          error.message ||
          "An error occurred while opening the file"
      );
      this.openFilesMap.delete(directories + "/" + file.name);
      modifyFoldersMap(directoryParts, -1);
      downloadedLocation &&
        this.fileShare.removeFileFromTempPath(downloadedLocation);
      viewPath && this.fileShare.removeFileFromTempPath(viewPath);
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
    try {
      configuration = JSON.parse(configuration);
      const res = await this.fileShare.getDirectoryTree(
        configuration,
        folderPath
      );
      ipcEvent.sender.send(InvokeEvent.GetDirectoryTreeResponse, res);
    } catch (error: any) {
      ipcEvent.sender.send(InvokeEvent.GetDirectoryTreeResponse, []);
    }
  };
  renameFolderHandler = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    configuration: any,
    folderPath: string,
    newFolderName: string
  ) => {
    try {
      if ((this.openFoldersMap.get(folderPath) ?? 0) > 0) {
        throw new Error("Please close all files before renaming the directory");
      }
      configuration = JSON.parse(configuration);
      await this.fileShare.renameFolder(
        configuration,
        folderPath,
        newFolderName
      );
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
    configuration: any,
    folderPath: string,
    fileName: string,
    newFileName: string
  ) => {
    try {
      if (this.openFilesMap.has(folderPath + "/" + fileName)) {
        throw new Error("Please close the file before renaming");
      }
      configuration = JSON.parse(configuration);
      await this.fileShare.renameFile(
        configuration,
        folderPath,
        fileName,
        newFileName
      );
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

  private saveAndUpload = async (
    ipcEvent: Electron.IpcMainInvokeEvent,
    file: { name: any },
    filePath: string,
    configuration: Configuration,
    directories: string
  ) => {
    try {
      this.loadingHandler(ipcEvent, true);

      if (!onlineStatus) {
        this.loadingHandler(ipcEvent, false);
        throw new Error(`File ${file.name} cannot be saved in offline mode`);
      }

      let uploadPath = filePath;

      if (this.withEncryption) {
        uploadPath = filePath + ".txt";
        await this.fileShare.encryptAndSaveFile(
          filePath,
          uploadPath,
          configuration.privateKey as string
        );
      }

      await this.fileShare.uploadFile(
        file.name,
        uploadPath,
        configuration,
        directories
      );

      if (this.withEncryption) {
        this.fileShare.removeFileFromTempPath(uploadPath);
      }

      this.loadingHandler(ipcEvent, false);
    } catch (error: any) {
      ipcEvent.sender.send(
        InvokeEvent.FileProcessingMessage,
        Status.Error,
        error?.details?.message ||
          error.message ||
          "An error occurred while saving the file"
      );
    }
  };

  public static getInstance() {
    return new FileInvocationHandler();
  }
}

export function fileInvocation(win: Electron.BrowserWindow) {
  const fileInvocationHandler: FileInvocationHandler =
    FileInvocationHandler.getInstance();

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

  ipcMain.on("online-status", (event, status) => {
    onlineStatus = status;
  });

  for (const [key, value] of Object.entries(handlerRecord)) {
    ipcMain.handle(key, value);
  }
}
