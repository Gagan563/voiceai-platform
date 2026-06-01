// ============================================
// VoxMind — Sandboxed Terminal Tool
// ============================================
// Allows agents to run shell commands safely.
// - Timeout enforcement
// - Command blocklist
// - Approval-required commands
// - Output capture + streaming

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

const MAX_OUTPUT = 50_000; // 50KB max output per command
const DEFAULT_TIMEOUT = 30_000; // 30s
const LONG_TIMEOUT = 120_000; // 2min for builds

// Commands that are NEVER allowed
const BANNED = [
  /^rm\s+-rf\s+\/$/,
  /^format\s/i,
  /^shutdown/i,
  /^reboot/i,
  /^mkfs/i,
  /^dd\s+if=/i,
  /^:(){ :|:& };:/,  // fork bomb
  /^curl.*\|\s*(ba)?sh/i, // pipe to shell
];

// Commands that require explicit user approval
const APPROVAL_REQUIRED = [
  /^npm\s+publish/,
  /^git\s+push/,
  /^docker\s+push/,
  /^vercel\s+--prod/,
  /^railway\s+up/,
  /^fly\s+deploy/,
  /^rm\s+-rf/,
  /^sudo\s/,
];

// Commands allowed for longer timeout
const LONG_RUNNING = [
  /^npm\s+(install|ci|run\s+build)/,
  /^npx\s/,
  /^yarn\s+(install|build)/,
  /^pip\s+install/,
  /^docker\s+build/,
  /^cargo\s+build/,
  /^go\s+build/,
  /^python\s/,
  /^node\s/,
];

function isBanned(command) {
  return BANNED.some((pattern) => pattern.test(command));
}

function needsApproval(command) {
  return APPROVAL_REQUIRED.some((pattern) => pattern.test(command));
}

function getTimeout(command) {
  return LONG_RUNNING.some((p) => p.test(command)) ? LONG_TIMEOUT : DEFAULT_TIMEOUT;
}

/**
 * Run a shell command in a sandboxed environment.
 *
 * @param {object} params
 * @param {string} params.command — Shell command to run
 * @param {string} [params.cwd] — Working directory (must be within workspace)
 * @param {boolean} [params.approved] — Whether user has approved dangerous commands
 * @param {function} [onOutput] — Streaming output callback
 * @returns {object} { success, stdout, stderr, exitCode, duration_ms }
 */
async function runTerminal({ command, cwd, approved = false }, onOutput) {
  const cmd = (command || "").trim();
  if (!cmd) {
    return { success: false, error: "No command provided" };
  }

  // Security checks
  if (isBanned(cmd)) {
    return { success: false, error: `Command is banned for safety: "${cmd}"` };
  }

  if (needsApproval(cmd) && !approved) {
    return {
      success: false,
      error: "This command requires user approval before execution",
      requires_approval: true,
      command: cmd,
    };
  }

  const timeout = getTimeout(cmd);
  const isWindows = os.platform() === "win32";
  const shell = isWindows ? "cmd.exe" : "/bin/bash";
  const shellArgs = isWindows ? ["/c", cmd] : ["-c", cmd];

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let killed = false;
    const startTime = Date.now();

    const proc = spawn(shell, shellArgs, {
      cwd: cwd || process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        CI: "true",
        NODE_ENV: "development",
      },
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGTERM");
      setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch {}
      }, 3000);
    }, timeout);

    proc.stdout.on("data", (data) => {
      const chunk = data.toString();
      if (stdout.length < MAX_OUTPUT) {
        stdout += chunk;
      }
      if (onOutput) onOutput({ stream: "stdout", data: chunk });
    });

    proc.stderr.on("data", (data) => {
      const chunk = data.toString();
      if (stderr.length < MAX_OUTPUT) {
        stderr += chunk;
      }
      if (onOutput) onOutput({ stream: "stderr", data: chunk });
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;

      resolve({
        success: code === 0,
        command: cmd,
        exitCode: code,
        stdout: stdout.substring(0, MAX_OUTPUT),
        stderr: stderr.substring(0, MAX_OUTPUT),
        duration_ms: duration,
        truncated: stdout.length >= MAX_OUTPUT || stderr.length >= MAX_OUTPUT,
        killed,
        ...(killed ? { error: `Command killed after ${timeout}ms timeout` } : {}),
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        command: cmd,
        error: `Failed to execute: ${err.message}`,
        duration_ms: Date.now() - startTime,
      });
    });
  });
}

module.exports = { runTerminal, isBanned, needsApproval };
