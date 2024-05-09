import { app, ipcMain } from "electron";
import { dialog } from "electron";
import * as path from "path";
import { DATA_FORMAT_NOT_SUPPORTED, readOnlyExtensions } from "./utils";
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

export function fileInvocation(win: Electron.BrowserWindow) {
  ipcMain.handle(
    InvokeEvent.DeleteFile,
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      configuration,
      folderName,
      fileName
    ) => {
      configuration = JSON.parse(configuration);
      await deleteFile(configuration, folderName, fileName);
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
    }
  );
  ipcMain.handle(
    InvokeEvent.CreateDirectory,
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      configuration,
      currentDirectoryPath,
      directoryName
    ) => {
      configuration = JSON.parse(configuration);
      await addDirectory(configuration, currentDirectoryPath, directoryName);
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
    }
  );
  ipcMain.handle(
    InvokeEvent.DeleteDirectory,
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      configuration,
      directoryPath
    ) => {
      configuration = JSON.parse(configuration);
      try {
        await deleteDirectory(configuration, directoryPath);
        ipcEvent.sender.send(InvokeEvent.TryFetch, "");
      } catch (error: any) {
        ipcEvent.sender.send(
          InvokeEvent.FileProcessing,
          Status.Error,
          error.details.message
        );
      }
    }
  );

  ipcMain.handle(
    InvokeEvent.UploadFromPC,
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
      ipcEvent.sender.send(InvokeEvent.TryFetch, "");
      ipcEvent.sender.send(
        InvokeEvent.FileProcessing,
        Status.Success,
        `The file ${path.basename(selectedPath)} is uploaded successfully`
      );
    }
  );
  ipcMain.handle(
    InvokeEvent.GetFile,
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      configuration,
      folderName
    ) => {
      configuration = JSON.parse(configuration);
      const res = await listFiles(configuration, folderName);
      ipcEvent.sender.send(InvokeEvent.GetFileResponse, res);
    }
  );
  ipcMain.handle(
    InvokeEvent.OpenFile,
    async (
      ipcEvent: Electron.IpcMainInvokeEvent,
      file,
      configuration,
      directories
    ) => {
      let isEditable = true;
      configuration = JSON.parse(configuration);
      if (!file.name.endsWith(".txt")) {
        ipcEvent.sender.send(
          InvokeEvent.FileProcessing,
          Status.Error,
          `The file ${file.name} is not supported`
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
          InvokeEvent.FileProcessing,
          Status.Error,
          `The file ${fileName} is not supported`
        );
        return;
      }
      const base64Data = decrypted.split(",")[1];

      openFile(tempPath, newPath, base64Data);
      const actualExt = file.name
        .split(".")
        [file.name.split(".").length - 2].toLowerCase();
      isEditable = !readOnlyExtensions.includes(actualExt);

      let paths = [newPath];
      let intervalId: NodeJS.Timeout;
      intervalId = setInterval(async () => {
        let isFileOpen = await isFileOpened(paths);
        if (!isFileOpen) {
          if (isEditable) {
            await encryptAndSaveFile(newPath, newPath + ".txt");
            await uploadFile(
              file.name,
              newPath + ".txt",
              configuration,
              directories
            );
            removeFileFromTempPath(newPath + ".txt");
          }

          removeFileFromTempPath(newPath);
          clearInterval(intervalId!);
          ipcEvent.sender.send(
            InvokeEvent.FileProcessing,
            Status.Success,
            `The file ${fileName} is processed successfully`
          );
        }
      }, 5000);
    }
  );
}
