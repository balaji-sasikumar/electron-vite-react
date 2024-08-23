import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  nativeTheme,
} from "electron";
import { release } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileInvocation } from "./file-invocation";
import { exec } from "child_process";
import { logError } from "./logger";
import * as fs from "fs";
import * as path from "path";

globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = dirname(__filename);

process.env.DIST_ELECTRON = join(__dirname, "../");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, "../public")
  : process.env.DIST;

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null;
// Here, you can also use other preload
const preload = join(__dirname, "../preload/index.mjs");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");
let tempPath = "";

nativeTheme.themeSource = "light";
async function createWindow() {
  win = new BrowserWindow({
    title: "Main window",
    icon: join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  });
  win.maximize();
  win.removeMenu();
  if (url) {
    // electron-vite-vue#298
    win.loadURL(url);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
  ipcMain.handle("send-temp-path", (_, arg) => {
    console.log(`Received temp path: ${arg}`);
    tempPath = path.join(arg, "windows-temp");
  });
  win.on("close", (e) => {
    console.log(`Temp path -> On close: ${tempPath}`);
    const tempDirectoryIsEmpty = tempPath ? isDirectoryEmpty(tempPath) : true;
    if (!tempDirectoryIsEmpty) {
      e.preventDefault();
      dialog.showMessageBox({
        type: "info",
        title: "Files Exist",
        message:
          "There are files present in tempPath. Please Save them before closing the application.",
      });
    } else {
      if (process.platform === "win32") {
        e.preventDefault();
        dialog.showMessageBox({
          type: "info",
          title: "Cleanup in Progress",
          message: "Clearing recent files data. Please wait...",
        });
        executeBatchScript();
        setTimeout(() => {
          win?.destroy();
          app.quit();
        }, 3000);
      }
    }
  });
  win.on("blur", () => {
    win?.webContents.send("app-state-changed", "blur");
  });
  win.on("focus", () => {
    win?.webContents.send("app-state-changed", "focus");
  });

  fileInvocation(win);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

function executeBatchScript() {
  let scriptPath = join(__dirname, "clear-recent.bat");
  console.log(`Executing script: ${scriptPath}`);
  exec(scriptPath, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Script stderr: ${stderr}`);
      return;
    }
    console.log(`Script stdout: ${stdout}`);
  });
}

function isDirectoryEmpty(directory: any) {
  try {
    const files = fs.readdirSync(directory);

    // Filter out any .DS_Store files
    const filteredFiles = files.filter((file) => file !== ".DS_Store");

    // Recursively check for files in the directory or its subdirectories
    for (const file of filteredFiles) {
      const fullPath = path.join(directory, file);
      const stat = fs.lstatSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively check subdirectories
        if (!isDirectoryEmpty(fullPath)) {
          return false; // Found non-empty subdirectory, stop recursion
        }
      } else {
        return false; // Found a file, stop recursion
      }
    }

    // If no files were found, the directory is empty
    return true;
  } catch (error) {
    return true;
  }
}
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  logError(`Uncaught Exception -- ${JSON.stringify(error)}`);
  app.quit();
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
  logError(`Unhandled Exception -- ${JSON.stringify(error)}`);
  app.quit();
});
