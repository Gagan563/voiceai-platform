const path = require("path");
const { Menu, Tray, nativeImage } = require("electron");

function resolveTrayIcon(app) {
  const root = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..", "..");
  const candidates = [
    path.join(root, "electron", "assets", "tray.png"),
    path.join(root, "electron", "assets", "icon.png"),
    path.join(root, "electron", "assets", "icon.ico"),
    path.join(root, "frontend", "public", "favicon.svg"),
  ];

  const iconPath = candidates.find((candidate) => require("fs").existsSync(candidate));
  const image = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();

  if (process.platform === "darwin") {
    image.setTemplateImage(true);
  }

  return image.resize({ width: 16, height: 16 });
}

function setupTray(app, mainWindow, handlers = {}) {
  const tray = new Tray(resolveTrayIcon(app));

  const toggleWindow = () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      return;
    }

    mainWindow.show();
    mainWindow.focus();
  };

  const menu = Menu.buildFromTemplate([
    {
      label: "Open",
      click: handlers.onOpen || toggleWindow,
    },
    {
      label: "Settings",
      click: handlers.onSettings || toggleWindow,
    },
    { type: "separator" },
    {
      label: "Quit",
      click: handlers.onQuit || (() => app.quit()),
    },
  ]);

  tray.setToolTip("VoiceAI Platform");
  tray.setContextMenu(menu);
  tray.on("click", toggleWindow);

  return tray;
}

module.exports = { setupTray };
