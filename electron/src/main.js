const path = require("path");
const { spawn } = require("child_process");
const { app, BrowserWindow, nativeImage, ipcMain } = require("electron");
const startedBySquirrel = require("electron-squirrel-startup");
const { setupTray } = require("./tray");
const { registerHotkeys, unregisterHotkeys } = require("./hotkey");
const secureStore = require("./store");

const APP_NAME = "VoiceAI Platform";
const BACKEND_PORT = process.env.PORT || "3001";

let mainWindow = null;
let backendProcess = null;
let tray = null;
let isQuitting = false;

if (startedBySquirrel) {
  app.quit();
}

function resolveRootPath() {
  return app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..", "..");
}

function resolveFrontendIndex() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "dist", "index.html")
    : path.resolve(__dirname, "..", "..", "frontend", "dist", "index.html");
}

function resolveBackendEntry() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "server.js")
    : path.resolve(__dirname, "..", "..", "backend", "server.js");
}

function resolveIconPath() {
  const root = resolveRootPath();
  const candidates = [
    path.join(root, "electron", "assets", "icon.ico"),
    path.join(root, "electron", "assets", "icon.png"),
    path.join(root, "electron", "assets", "icon.icns"),
    path.join(root, "electron", "assets", "icon.svg"),
    path.join(root, "frontend", "public", "favicon.svg"),
  ];

  return candidates.find((candidate) => require("fs").existsSync(candidate));
}

function createWindow() {
  const iconPath = resolveIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    icon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(resolveFrontendIndex());

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function startBackend() {
  if (backendProcess) return;

  const backendEntry = resolveBackendEntry();
  const backendDir = path.dirname(backendEntry);
  const nodePath = app.isPackaged
    ? path.join(app.getAppPath(), "node_modules")
    : path.resolve(__dirname, "..", "node_modules");

  backendProcess = spawn(process.execPath, [backendEntry], {
    cwd: backendDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_PATH: nodePath,
      PORT: BACKEND_PORT,
      CORS_ORIGIN: "file://",
    },
    stdio: "pipe",
    windowsHide: true,
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.error(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.on("exit", (code, signal) => {
    console.log(`[backend] exited code=${code} signal=${signal}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (!backendProcess) return;

  const child = backendProcess;
  backendProcess = null;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }

  child.kill("SIGTERM");
}

function registerStoreIpc() {
  ipcMain.handle("secure-store:get", (event, key) => secureStore.get(key));
  ipcMain.handle("secure-store:set", (event, key, value) => {
    secureStore.set(key, value);
    return true;
  });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.setName(APP_NAME);

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    registerStoreIpc();
    startBackend();
    createWindow();
    tray = setupTray(app, mainWindow, {
      onOpen: () => {
        mainWindow.show();
        mainWindow.focus();
      },
      onSettings: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send("desktop:navigate", "settings");
      },
      onQuit: () => {
        isQuitting = true;
        app.quit();
      },
    });
    registerHotkeys(mainWindow);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on("before-quit", () => {
    isQuitting = true;
    unregisterHotkeys();
    stopBackend();
    if (tray) tray.destroy();
  });

  app.on("window-all-closed", (event) => {
    event.preventDefault();
  });
}
