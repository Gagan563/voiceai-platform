#!/usr/bin/env node

/**
 * NOVA — Production build script
 *
 * Usage: node scripts/build.js
 *
 * 1. Installs frontend dependencies
 * 2. Builds the Vite frontend
 * 3. Copies dist/ → backend/public/
 * 4. Installs backend production dependencies
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FRONTEND = path.join(ROOT, "frontend");
const BACKEND = path.join(ROOT, "backend");
const DIST = path.join(FRONTEND, "dist");
const PUBLIC = path.join(BACKEND, "public");

function run(cmd, cwd) {
  console.log(`\n▸ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   NOVA — Production Build            ║");
  console.log("╚══════════════════════════════════════╝\n");

  // 1. Frontend
  console.log("── Step 1: Frontend deps & build ──");
  if (!fs.existsSync(path.join(FRONTEND, "node_modules"))) {
    run("npm install", FRONTEND);
  }
  run("npm run build", FRONTEND);

  // 3. Copy to backend/public, root/public, and root/dist
  console.log("\n── Step 3: Copy dist → public & backend/public ──");
  if (fs.existsSync(PUBLIC)) {
    fs.rmSync(PUBLIC, { recursive: true });
  }
  fs.cpSync(DIST, PUBLIC, { recursive: true });
  console.log(`   ✓ Copied to ${PUBLIC}`);

  const ROOT_PUBLIC = path.join(ROOT, "public");
  if (fs.existsSync(ROOT_PUBLIC)) {
    fs.rmSync(ROOT_PUBLIC, { recursive: true });
  }
  fs.cpSync(DIST, ROOT_PUBLIC, { recursive: true });
  console.log(`   ✓ Copied to ${ROOT_PUBLIC}`);

  const ROOT_DIST = path.join(ROOT, "dist");
  if (fs.existsSync(ROOT_DIST)) {
    fs.rmSync(ROOT_DIST, { recursive: true });
  }
  fs.cpSync(DIST, ROOT_DIST, { recursive: true });
  console.log(`   ✓ Copied to ${ROOT_DIST}`);

  // 4. Backend deps
  console.log("\n── Step 4: Install backend production deps ──");
  run("npm ci --omit=dev", BACKEND);

  console.log("\n══════════════════════════════════════");
  console.log("✓  Build complete!");
  console.log(`   Start: cd backend && node server.js`);
  console.log("══════════════════════════════════════\n");
}

main();
