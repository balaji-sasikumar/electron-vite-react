import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { app } from "electron";

// Define paths to the directories
const appDataPath = app.getPath("appData");
const automaticDestinationsPath = path.join(
  appDataPath,
  "Microsoft",
  "Windows",
  "Recent",
  "AutomaticDestinations"
);
const customDestinationsPath = path.join(
  appDataPath,
  "Microsoft",
  "Windows",
  "Recent",
  "CustomDestinations"
);
const recentPath = path.join(appDataPath, "Microsoft", "Windows", "Recent");

// Function to delete files in a directory
function deleteFilesInDirectory(directory: any) {
  fs.readdir(directory, (err: any, files: any[]) => {
    if (err) {
      console.error(`Failed to read directory ${directory}:`, err);
      return;
    }
    files.forEach((file) => {
      const filePath = path.join(directory, file);
      fs.unlink(filePath, (err: any) => {
        if (err) {
          console.error(`Failed to delete file ${filePath}:`, err);
        } else {
          console.log(`Deleted file: ${filePath}`);
        }
      });
    });
  });
}

export function executeScript() {
  // Delete files in specified directories
  deleteFilesInDirectory(automaticDestinationsPath);
  deleteFilesInDirectory(customDestinationsPath);
  deleteFilesInDirectory(recentPath);

  // Kill and restart explorer.exe
  exec("taskkill /f /im explorer.exe", (err: any, stdout: any, stderr: any) => {
    if (err) {
      console.error("Error killing explorer.exe:", stderr);
    } else {
      console.log("Explorer.exe killed");
      exec("start explorer.exe", (err: any, stdout: any, stderr: any) => {
        if (err) {
          console.error("Error starting explorer.exe:", stderr);
        } else {
          console.log("Explorer.exe restarted");
        }
      });
    }
  });
}
