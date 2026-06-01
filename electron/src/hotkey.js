const { globalShortcut } = require("electron");

function getAccelerator() {
  return process.platform === "darwin" ? "Command+Space" : "Control+Space";
}

function registerHotkeys(mainWindow) {
  const accelerator = getAccelerator();

  const registered = globalShortcut.register(accelerator, () => {
    if (!mainWindow) return;

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });

  if (!registered) {
    console.warn(`[hotkey] Could not register ${accelerator}`);
  }
}

function unregisterHotkeys() {
  globalShortcut.unregisterAll();
}

module.exports = {
  registerHotkeys,
  unregisterHotkeys,
};
