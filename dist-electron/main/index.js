import { app as t, ipcMain as l, dialog as _, BrowserWindow as p, shell as v } from "electron";
import { release as E } from "node:os";
import { dirname as I, join as r } from "node:path";
import { fileURLToPath as T } from "node:url";
import { createRequire as u } from "node:module";
import { spawn as b, exec as g } from "child_process";
const { autoUpdater: a } = u(import.meta.url)("electron-updater"), R = u(import.meta.url)("@ronomon/opened");
function D(n) {
  a.autoDownload = !1, a.disableWebInstaller = !1, a.allowDowngrade = !1, a.on("checking-for-update", function() {
  }), a.on("update-available", (e) => {
    n.webContents.send("update-can-available", {
      update: !0,
      version: t.getVersion(),
      newVersion: e == null ? void 0 : e.version
    });
  }), a.on("update-not-available", (e) => {
    n.webContents.send("update-can-available", {
      update: !1,
      version: t.getVersion(),
      newVersion: e == null ? void 0 : e.version
    });
  }), l.handle("check-update", async () => {
    if (!t.isPackaged) {
      const e = new Error(
        "The update feature is only available after the package."
      );
      return { message: e.message, error: e };
    }
    try {
      return await a.checkForUpdatesAndNotify();
    } catch (e) {
      return { message: "Network error", error: e };
    }
  }), l.handle(
    "open-dialog",
    async (e) => {
      let o = await _.showOpenDialog({
        properties: ["openDirectory", "openFile"]
      });
      if (o.canceled)
        return "canceled";
      let i = o.filePaths[0];
      process.platform === "darwin" ? b("open", [i]) : g(`start ${i}`);
      let d = [i], f;
      f = setInterval(async () => {
        await L(d) || (clearInterval(f), e.sender.send(
          "main-process-message",
          `The file ${i} is closed.`
        ));
      }, 5e3);
    }
  ), l.handle("start-download", (e) => {
    V(
      (o, i) => {
        o ? e.sender.send("update-error", { message: o.message, error: o }) : e.sender.send("download-progress", i);
      },
      () => {
        e.sender.send("update-downloaded");
      }
    );
  }), l.handle("quit-and-install", () => {
    a.quitAndInstall(!1, !0);
  });
}
function V(n, e) {
  a.on(
    "download-progress",
    (o) => n(null, o)
  ), a.on("error", (o) => n(o, null)), a.on("update-downloaded", e), a.downloadUpdate();
}
async function L(n) {
  return new Promise((e, o) => {
    R.files(
      n,
      function(i, d) {
        i && o(i), e(d[n[0]]);
      }
    );
  });
}
globalThis.__filename = T(import.meta.url);
globalThis.__dirname = I(__filename);
process.env.DIST_ELECTRON = r(__dirname, "../");
process.env.DIST = r(process.env.DIST_ELECTRON, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? r(process.env.DIST_ELECTRON, "../public") : process.env.DIST;
E().startsWith("6.1") && t.disableHardwareAcceleration();
process.platform === "win32" && t.setAppUserModelId(t.getName());
t.requestSingleInstanceLock() || (t.quit(), process.exit(0));
let s = null;
const w = r(__dirname, "../preload/index.mjs"), c = process.env.VITE_DEV_SERVER_URL, m = r(process.env.DIST, "index.html");
async function h() {
  s = new p({
    title: "Main window",
    icon: r(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload: w
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,
      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    }
  }), c ? (s.loadURL(c), s.webContents.openDevTools()) : s.loadFile(m), s.webContents.on("did-finish-load", () => {
    s == null || s.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), s.webContents.setWindowOpenHandler(({ url: n }) => (n.startsWith("https:") && v.openExternal(n), { action: "deny" })), D(s);
}
t.whenReady().then(h);
t.on("window-all-closed", () => {
  s = null, process.platform !== "darwin" && t.quit();
});
t.on("second-instance", () => {
  s && (s.isMinimized() && s.restore(), s.focus());
});
t.on("activate", () => {
  const n = p.getAllWindows();
  n.length ? n[0].focus() : h();
});
l.handle("open-win", (n, e) => {
  const o = new p({
    webPreferences: {
      preload: w,
      nodeIntegration: !0,
      contextIsolation: !1
    }
  });
  process.env.VITE_DEV_SERVER_URL ? o.loadURL(`${c}#${e}`) : o.loadFile(m, { hash: e });
});
