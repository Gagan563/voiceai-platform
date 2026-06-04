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
  console.log("── Step 1: Install frontend deps ──");
  run("npm ci", FRONTEND);

  console.log("\n── Step 2: Build frontend ──");
  run("npm run build", FRONTEND);

  // 3. Copy to backend/public
  console.log("\n── Step 3: Copy dist → backend/public ──");
  if (fs.existsSync(PUBLIC)) {
    fs.rmSync(PUBLIC, { recursive: true });
  }
  fs.cpSync(DIST, PUBLIC, { recursive: true });
  console.log(`   ✓ Copied to ${PUBLIC}`);

  // 4. Backend deps
  console.log("\n── Step 4: Install backend production deps ──");
  run("npm ci --omit=dev", BACKEND);

  console.log("\n══════════════════════════════════════");
  console.log("✓  Build complete!");
  console.log(`   Start: cd backend && node server.js`);
  console.log("══════════════════════════════════════\n");
}

main();
