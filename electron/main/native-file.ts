import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import mime from "mime";
import { shell } from "electron";
import { Configuration } from "electron/interfaces/configuration.interface";
import { tempFolder } from "./utils";

interface DirectoryItem {
  label: string;
  id: string;
  children: DirectoryItem[];
  level: number;
}

export class NativeFile {
  private constructor() {}

  openFile = async (newPath: string) => {
    await shell.openPath(newPath).catch((err) => {
      console.error("Error opening file:", err);
    });
  };

  mountFileShare = async (configuration: Configuration) => {
    const { accountName, accountKey, shareName } = configuration;
    const platform = os.platform();

    let command = "";
    let mountPath = path.join(__dirname, "mnt", shareName);

    if (platform === "linux") {
      command = `sudo mount -t cifs //${accountName}.file.core.windows.net/${shareName} ${mountPath} -o vers=3.0,username=${accountName},password=${accountKey},dir_mode=0777,file_mode=0777,serverino`;
    } else if (platform === "darwin") {
      mountPath = `/Volumes/${shareName}`;
      command = `sudo mkdir -p ${mountPath} && mount_smbfs //'${accountName}:${accountKey}@${accountName}.file.core.windows.net/${shareName}' ${mountPath}`;
    } else if (platform === "win32") {
      command = `net use Z: \\\\${accountName}.file.core.windows.net\\${shareName} ${accountKey} /USER:${accountName}`;
    } else {
      console.error("Unsupported OS for mounting Azure File Share");
      return;
    }

    // Execute the mount command
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Mount error: ${error.message}`);
        return;
      }
      console.log(`Mount output: ${stdout}`);
      if (stderr) console.error(`Mount stderr: ${stderr}`);
    });
  };

  listFiles = async (
    configuration: Configuration,
    directoryName: string,
    prefix?: string
  ) => {
    try {
      this.mountFileShare(configuration);
      const directoryPath = path.resolve(directoryName);
      const dirEntries = await fs.promises.readdir(directoryPath, {
        withFileTypes: true,
      });

      const fileList = dirEntries
        .filter(
          (entry) =>
            entry.isFile() && (!prefix || entry.name.startsWith(prefix))
        )
        .map((entry) => entry.name);

      const directoryStats = await fs.promises.stat(directoryPath);
      const directoryId = directoryStats.ino.toString();

      return [fileList, directoryId];
    } catch (error) {
      console.error(
        `Error listing files in directory: ${directoryName}`,
        error
      );
      return [[], null];
    }
  };

  getDirectoryTree = async (folderPath: string): Promise<DirectoryItem[]> => {
    let level = 0;

    const fetchDirectoryContents = async (
      directoryPath: string,
      currentLevel: number
    ): Promise<DirectoryItem[]> => {
      try {
        const items: DirectoryItem[] = [];
        const dirEntries = await fs.promises.readdir(directoryPath, {
          withFileTypes: true,
        });

        for (const entry of dirEntries) {
          if (entry.isDirectory()) {
            items.push({
              label: entry.name,
              id: path.join(directoryPath, entry.name),
              children: [],
              level: currentLevel,
            });
          }
        }
        return items;
      } catch (error) {
        console.error(`Error reading directory: ${directoryPath}`, error);
        return [];
      }
    };

    const paths = folderPath.split(path.sep);
    let rootContents: DirectoryItem[] = await fetchDirectoryContents(
      folderPath,
      level
    );
    let currentLevel = rootContents;
    let currentPath = folderPath;

    for (const pathSegment of paths) {
      const parentDir = currentLevel.find((dir) => dir.label === pathSegment);
      currentPath = path.join(currentPath, pathSegment);
      if (parentDir) {
        parentDir.children = await fetchDirectoryContents(
          currentPath,
          level + 1
        );
        currentLevel = parentDir.children;
      } else {
        break;
      }
    }

    return rootContents;
  };

  renameFolder = async (
    currentDirectoryPath: string,
    newDirectoryName: string
  ) => {
    await fs.promises.rename(currentDirectoryPath, newDirectoryName);
  };

  renameFile = async (
    currentFilePath: string,
    currentFileName: string,
    newFileName: string
  ) => {
    await fs.promises.rename(
      path.join(path.dirname(currentFilePath), currentFileName),
      path.join(path.dirname(currentFilePath), newFileName)
    );
  };

  uploadFile = async (
    fileName: string,
    filePath: string,
    destinationPath: string
  ) => {
    const destinationFilePath = path.join(
      destinationPath,
      path.basename(filePath)
    );

    await fs.promises.copyFile(filePath, destinationFilePath).catch((err) => {
      console.error("Error uploading file:", err);
    });
  };

  checkFileExists = async (fileName: string, directoryName: string) => {
    return fs.existsSync(path.join(directoryName, fileName));
  };

  getSharedStoragePath = (
    directoryPath: string,
    directories: string = "",
    fileName: string
  ) => {
    return path.join(directoryPath, tempFolder, directories, fileName);
  };

  public static getInstance() {
    return new NativeFile();
  }
}
