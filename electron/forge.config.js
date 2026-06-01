const path = require("path");

const appName = "VoiceAI Platform";
const appVersion = "1.0.0";
const rootDir = path.resolve(__dirname, "..");
const iconBase = path.join(__dirname, "assets", "icon");

module.exports = {
  packagerConfig: {
    name: appName,
    executableName: "VoiceAI",
    appBundleId: "com.voiceai.platform",
    appCategoryType: "public.app-category.productivity",
    icon: iconBase,
    asar: true,
    extraResource: [
      path.join(rootDir, "frontend", "dist"),
      path.join(rootDir, "backend", "server.js"),
      path.join(rootDir, "backend", "prompts.js"),
      path.join(rootDir, "backend", "socket.js"),
      path.join(rootDir, "backend", "routes"),
      path.join(rootDir, "backend", "services"),
      path.join(rootDir, "backend", "prisma"),
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "voiceai_platform",
        authors: "VoiceAI Platform",
        description: "Voice-first AI platform with persistent memory.",
        setupIcon: path.join(__dirname, "assets", "icon.ico"),
        iconUrl: "https://example.com/icon.ico",
        exe: "VoiceAI.exe",
        noMsi: true,
      },
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        name: appName,
        icon: path.join(__dirname, "assets", "icon.icns"),
        format: "ULFO",
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          name: "voiceai-platform",
          productName: appName,
          version: appVersion,
          maintainer: "VoiceAI Platform",
          homepage: "https://example.com",
          icon: path.join(__dirname, "assets", "icon.png"),
          categories: ["Utility", "Development"],
          description: "Voice-first AI platform with persistent memory.",
        },
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
  ],
};
