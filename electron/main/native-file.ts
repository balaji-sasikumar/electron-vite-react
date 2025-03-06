import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
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
      if (os.platform() === "win32") {
        path.join("Z:", newPath);
      }
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
      await this.mountFileShare(configuration);

      let directoryPath = path.resolve(directoryName);
      if (os.platform() === "win32") {
        directoryPath = path.join("Z:", directoryName);
      }

      const dirEntries = await fs.promises.readdir(directoryPath, {
        withFileTypes: true,
      });

      const fileList = await Promise.all(
        dirEntries
          .filter((entry) => !prefix || entry.name.startsWith(prefix)) // Filter based on prefix
          .map(async (entry) => {
            const fullPath = path.join(directoryPath, entry.name);
            const stats = await fs.promises.stat(fullPath);

            return {
              kind: entry.isDirectory() ? "directory" : "file",
              name: entry.name,
              fileId: stats.ino.toString(),
              properties: {
                contentLength: entry.isFile() ? stats.size : undefined,
                creationTime: stats.birthtime,
                lastAccessTime: stats.atime,
                lastWriteTime: stats.mtime,
                changeTime: stats.ctime,
                lastModified: stats.mtime,
              },
              attributes: undefined,
              permissionKey: undefined,
            };
          })
      );

      return [fileList, ""];
    } catch (error) {
      console.error(
        `Error listing files in directory: ${directoryName}`,
        error
      );
      return [[], ""];
    }
  };

  getDirectoryTree = async (folderPath: string): Promise<DirectoryItem[]> => {
    let level = 0;
    folderPath = path.join("Z:", folderPath);
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
    try {
      let basePath =
        os.platform() === "win32" ? "Z:" : path.join(__dirname, "mnt");

      const oldPath = path.join(basePath, currentDirectoryPath);
      const newPath = path.join(
        basePath,
        path.dirname(currentDirectoryPath),
        newDirectoryName
      );

      await fs.promises.rename(oldPath, newPath);

      console.log(`Folder renamed: ${oldPath} → ${newPath}`);
    } catch (error) {
      console.error("Error renaming folder:", error);
    }
  };

  renameFile = async (
    currentFilePath: string,
    currentFileName: string,
    newFileName: string
  ) => {
    try {
      let basePath =
        os.platform() === "win32" ? "Z:" : path.join(__dirname, "mnt");

      const oldPath = path.join(basePath, currentFilePath, currentFileName);
      const newPath = path.join(basePath, currentFilePath, newFileName);

      await fs.promises.rename(oldPath, newPath);

      console.log(`File renamed: ${oldPath} → ${newPath}`);
    } catch (error) {
      console.error("Error renaming file:", error);
    }
  };

  uploadFile = async (
    fileName: string,
    filePath: string,
    configuration: Configuration,
    directoryName: string
  ) => {
    try {
      let destinationPath = path.resolve(directoryName, fileName);
      if (os.platform() === "win32") {
        destinationPath = path.join("Z:", directoryName, fileName);
      }

      await fs.promises.copyFile(filePath, destinationPath);

      console.log(`File uploaded: ${filePath} → ${destinationPath}`);
    } catch (error) {
      console.error(`Error uploading file: ${fileName}`, error);
    }
  };

  addDirectory = async (
    configuration: Configuration,
    currentDirectoryPath: string,
    directoryName: string
  ) => {
    try {
      let directoryPath = path.resolve(currentDirectoryPath, directoryName);
      if (os.platform() === "win32") {
        directoryPath = path.join("Z:", currentDirectoryPath, directoryName);
      }

      await fs.promises.mkdir(directoryPath, { recursive: true });
      console.log(`Directory created: ${directoryPath}`);
    } catch (error) {
      console.error(`Error creating directory: ${directoryName}`, error);
    }
  };

  deleteDirectory = async (
    configuration: Configuration,
    directoryPath: string
  ) => {
    try {
      let resolvedPath = path.resolve(directoryPath);
      if (os.platform() === "win32") {
        resolvedPath = path.join("Z:", directoryPath);
      }

      await fs.promises.rm(resolvedPath, { recursive: true, force: true });

      console.log(`Directory deleted: ${resolvedPath}`);
    } catch (error) {
      console.error(`Error deleting directory: ${directoryPath}`, error);
    }
  };

  deleteFile = async (
    configuration: Configuration,
    directoryName: string,
    fileName: string
  ) => {
    try {
      let filePath = path.resolve(directoryName, fileName);
      if (os.platform() === "win32") {
        filePath = path.join("Z:", directoryName, fileName);
      }

      await fs.promises.unlink(filePath);

      console.log(`File deleted: ${filePath}`);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.error(`File not found: ${fileName}`);
      } else {
        console.error(`Error deleting file: ${fileName}`, error);
      }
    }
  };

  checkFileExists = async (
    fileName: string,
    configuration: Configuration,
    directoryName: string
  ) => {
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
