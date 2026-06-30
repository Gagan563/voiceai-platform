// ============================================
// VoiceAI Platform — Agent Tool Registry
// ============================================
//
// Each tool the autonomous agent can call.
// Tools are pure functions: (params) → result
// The agent loop calls these based on Claude's decisions.

const fs = require("fs");
const path = require("path");
const ai = require("./ai");
const { callConnector } = require("./mcp");
const { runTerminal } = require("./terminal");

// Sandboxed output directory for agent-generated files
const OUTPUT_DIR = path.join(__dirname, "..", "agent-output");
const LOCAL_ACCESS_ENABLED = process.env.LOCAL_COMPUTER_ACCESS === "true";
const LOCAL_WRITE_ENABLED = process.env.LOCAL_COMPUTER_WRITE === "true";
const LOCAL_ACCESS_ROOTS = (process.env.LOCAL_ACCESS_ROOTS || "")
  .split(path.delimiter)
  .map((root) => root.trim())
  .filter(Boolean)
  .map((root) => path.resolve(root));

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Get the per-user output directory.
 * Creates the directory if it doesn't exist.
 */
function getUserOutputDir(userId) {
  if (!userId || userId === "default-user") return OUTPUT_DIR;

  // Sanitize userId to prevent directory traversal
  const safeId = String(userId).replace(/[^a-zA-Z0-9_@.-]/g, "_").substring(0, 64);
  const userDir = path.join(OUTPUT_DIR, safeId);

  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  return userDir;
}

function resolveOutputPath(filename, userId) {
  const cleanFilename = String(filename || "").trim();
  if (!cleanFilename) {
    throw new Error("Filename is required.");
  }

  const baseDir = getUserOutputDir(userId);
  const resolved = path.resolve(baseDir, cleanFilename);
  const workspace = path.resolve(baseDir);
  if (resolved !== workspace && !resolved.startsWith(workspace + path.sep)) {
    throw new Error("File path escapes the output workspace.");
  }

  return resolved;
}

function resolveLocalPath(targetPath) {
  if (!LOCAL_ACCESS_ENABLED) {
    throw new Error("Local computer access is disabled. Set LOCAL_COMPUTER_ACCESS=true and LOCAL_ACCESS_ROOTS.");
  }

  if (!LOCAL_ACCESS_ROOTS.length) {
    throw new Error("No local access roots configured. Set LOCAL_ACCESS_ROOTS to one or more approved folders.");
  }

  const resolved = path.resolve(String(targetPath || ""));
  const allowed = LOCAL_ACCESS_ROOTS.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep)
  );

  if (!allowed) {
    throw new Error("Path is outside the approved local access roots.");
  }

  return resolved;
}

// ── Tool Definitions (sent to Claude so it knows what's available) ──

const TOOL_DEFINITIONS = [
  {
    name: "generate_code",
    description:
      "Generate complete, production-ready code for a given task. Returns the full source code as a string. Use this for creating HTML pages, JavaScript apps, Python scripts, CSS stylesheets, or any other code.",
    parameters: {
      language: "The programming language or file type (html, javascript, python, css, etc.)",
      filename: "The output filename (e.g. index.html, app.js, styles.css)",
      description: "Detailed description of what the code should do",
      context: "Optional extra context, existing code, or constraints",
    },
  },
  {
    name: "write_file",
    description:
      "Write content to a file in the output workspace. Use this to save generated code, data, or any text content.",
    parameters: {
      filename: "Filename relative to workspace (e.g. index.html, src/app.js)",
      content: "The full file content to write",
    },
  },
  {
    name: "read_file",
    description:
      "Read the content of a file from the workspace or an uploaded file.",
    parameters: {
      filename: "Filename to read",
    },
  },
  {
    name: "modify_file",
    description:
      "Read an existing file, modify specific parts, and write it back. Use when the user wants to change something in existing code.",
    parameters: {
      filename: "File to modify",
      instructions: "What to change — be specific",
    },
  },
  {
    name: "list_files",
    description: "List all files in the current output workspace.",
    parameters: {},
  },
  {
    name: "preview_html",
    description:
      "Mark an HTML file as the preview target. The frontend will render it in a live iframe.",
    parameters: {
      filename: "The HTML file to preview (e.g. index.html)",
    },
  },
  {
    name: "search_web",
    description:
      "Search the web for information. Returns summarized search results.",
    parameters: {
      query: "The search query",
    },
  },
  {
    name: "list_local_directory",
    description:
      "List files in a user-approved local computer folder. Only works inside LOCAL_ACCESS_ROOTS.",
    parameters: {
      path: "Absolute path to an approved local directory",
    },
  },
  {
    name: "read_local_file",
    description:
      "Read a file from a user-approved local computer folder. Only works inside LOCAL_ACCESS_ROOTS.",
    parameters: {
      path: "Absolute path to an approved local file",
    },
  },
  {
    name: "write_local_file",
    description:
      "Write a file inside a user-approved local computer folder. Requires LOCAL_COMPUTER_WRITE=true and LOCAL_ACCESS_ROOTS.",
    parameters: {
      path: "Absolute output path inside an approved local folder",
      content: "Full file content to write",
    },
  },
  {
    name: "mcp_call",
    description:
      "Call an external connector through the MCP bridge. Use this for calendar, email, smart home, Spotify, and other configured integrations.",
    parameters: {
      connectorId: "Connector id, e.g. calendar, email, home_assistant, spotify",
      action: "Action name supported by the connector",
      params: "Parameters for the connector action",
    },
  },
  {
    name: "run_terminal",
    description:
      "Run a shell command in a sandboxed environment. Use for installing packages (npm install), running builds (npm run build), executing scripts, or checking versions. Commands are timeout-enforced and security-checked.",
    parameters: {
      command: "The shell command to execute (e.g. 'npm install express', 'node script.js')",
      cwd: "Optional working directory (defaults to agent workspace)",
    },
  },
  {
    name: "think",
    description:
      "Take a moment to plan your approach. Use this to reason about complex tasks before acting.",
    parameters: {
      thought: "Your reasoning and planning",
    },
  },
  {
    name: "complete",
    description:
      "Signal that the task is fully complete. Include a summary of what was built.",
    parameters: {
      summary: "Summary of what was accomplished",
      preview_file: "The main file to preview (e.g. index.html), or null",
    },
  },
];

// ── Tool Implementations ──

/**
 * Generate code using Claude.
 */
async function generate_code({ language, filename, description, context }) {
  const systemPrompt = `You are an expert ${language} developer. Generate complete, production-ready, beautiful code.

RULES:
1. Return ONLY the raw code — no markdown fences, no explanations, no \`\`\` blocks.
2. The code must be complete and immediately runnable.
3. For HTML: include embedded CSS and JS in a single file. Use modern design with:
   - Dark theme with gradient backgrounds
   - Google Fonts (Inter or Outfit)
   - Smooth animations and transitions
   - Responsive design
   - Professional, premium aesthetics
4. For CSS: use modern features, custom properties, smooth transitions.
5. For JavaScript: use modern ES6+, clean structure, good error handling.
6. Make it visually impressive and functional — the user should be wowed.`;

  const userPrompt = context
    ? `Create: ${description}\n\nContext:\n${context}`
    : `Create: ${description}`;

  const code = await ai.chat(systemPrompt, userPrompt, { maxTokens: 8192, temperature: 0.5 });

  // Clean any markdown fences if Claude adds them
  const cleaned = code
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .trim();

  // Write to file
  const filePath = resolveOutputPath(filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, cleaned, "utf-8");

  return {
    success: true,
    filename,
    language,
    size: cleaned.length,
    preview: cleaned.substring(0, 200) + (cleaned.length > 200 ? "..." : ""),
  };
}

/**
 * Write content to a file.
 */
function write_file({ filename, content }) {
  const filePath = resolveOutputPath(filename);
  const body = String(content ?? "");
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, body, "utf-8");

  return {
    success: true,
    filename,
    size: body.length,
  };
}

/**
 * Read a file from the workspace.
 */
function read_file({ filename }) {
  // Check output dir first, then uploaded files
  let outputPath;
  try {
    outputPath = resolveOutputPath(filename);
  } catch (error) {
    return { success: false, error: error.message };
  }

  const uploadDir = path.resolve(__dirname, "..", "uploads");
  const uploadPath = path.resolve(uploadDir, String(filename || ""));
  const canReadUpload =
    uploadPath !== uploadDir && uploadPath.startsWith(uploadDir + path.sep);

  let filePath;
  if (fs.existsSync(outputPath)) {
    filePath = outputPath;
  } else if (canReadUpload && fs.existsSync(uploadPath)) {
    filePath = uploadPath;
  } else {
    return { success: false, error: `File not found: ${filename}` };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return {
    success: true,
    filename,
    content,
    size: content.length,
  };
}

/**
 * Modify an existing file using Claude.
 */
async function modify_file({ filename, instructions }) {
  const readResult = read_file({ filename });
  if (!readResult.success) return readResult;

  const newContent = (await ai.chat(
    "You are a code editor. Modify the given code according to the instructions. Return ONLY the complete modified code — no markdown fences, no explanations.",
    `Current file (${filename}):\n\n${readResult.content}\n\nInstructions: ${instructions}`,
    { maxTokens: 8192 }
  ))
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .trim();

  write_file({ filename, content: newContent });

  return {
    success: true,
    filename,
    size: newContent.length,
    message: `Modified ${filename} according to instructions`,
  };
}

/**
 * List all files in the output workspace.
 */
function list_files() {
  function walk(dir, prefix = "") {
    const entries = [];
    if (!fs.existsSync(dir)) return entries;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        entries.push(...walk(path.join(dir, entry.name), rel));
      } else {
        const stat = fs.statSync(path.join(dir, entry.name));
        entries.push({ name: rel, size: stat.size });
      }
    }
    return entries;
  }

  const files = walk(OUTPUT_DIR);
  return { success: true, files, count: files.length };
}

/**
 * Mark a file for live preview.
 */
function preview_html({ filename }) {
  let filePath;
  try {
    filePath = resolveOutputPath(filename);
  } catch (error) {
    return { success: false, error: error.message };
  }

  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filename}` };
  }
  return { success: true, filename, message: `Preview set to ${filename}` };
}

/**
 * Web search through DuckDuckGo's instant answer API.
 */
async function search_web({ query }) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) {
    return { success: false, error: "Search query is required." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url = new URL("https://api.duckduckgo.com/");
    url.searchParams.set("q", cleanQuery);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_html", "1");
    url.searchParams.set("skip_disambig", "1");

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "VoiceAI-Platform/1.0",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        query: cleanQuery,
        error: `Search request failed with status ${response.status}.`,
      };
    }

    const data = await response.json();
    const related = Array.isArray(data.RelatedTopics)
      ? data.RelatedTopics.flatMap((topic) =>
          Array.isArray(topic.Topics) ? topic.Topics : [topic]
        )
      : [];

    const results = [
      data.AbstractText
        ? {
            title: data.Heading || cleanQuery,
            snippet: data.AbstractText,
            url: data.AbstractURL || null,
          }
        : null,
      ...related
        .filter((topic) => topic.Text)
        .slice(0, 5)
        .map((topic) => ({
          title: topic.Text.split(" - ")[0] || cleanQuery,
          snippet: topic.Text,
          url: topic.FirstURL || null,
        })),
    ].filter(Boolean);

    return {
      success: true,
      query: cleanQuery,
      source: "duckduckgo_instant_answer",
      results,
      note: results.length
        ? "Instant-answer results returned."
        : "No instant-answer results were available for this query.",
    };
  } catch (error) {
    return {
      success: false,
      query: cleanQuery,
      error:
        error.name === "AbortError"
          ? "Search timed out."
          : `Search failed: ${error.message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function list_local_directory({ path: targetPath }) {
  const directory = resolveLocalPath(targetPath);
  const stat = fs.statSync(directory);
  if (!stat.isDirectory()) {
    return { success: false, error: "Path is not a directory." };
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const fullPath = path.join(directory, entry.name);
    const entryStat = fs.statSync(fullPath);
    return {
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? "directory" : "file",
      size: entryStat.size,
      modifiedAt: entryStat.mtime.toISOString(),
    };
  });

  return { success: true, path: directory, entries };
}

function read_local_file({ path: targetPath }) {
  const filePath = resolveLocalPath(targetPath);
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return { success: false, error: "Path is not a file." };
  }

  if (stat.size > 2 * 1024 * 1024) {
    return { success: false, error: "File is larger than the 2 MB read limit." };
  }

  return {
    success: true,
    path: filePath,
    content: fs.readFileSync(filePath, "utf-8"),
    size: stat.size,
  };
}

function write_local_file({ path: targetPath, content }) {
  if (!LOCAL_WRITE_ENABLED) {
    return {
      success: false,
      error: "Local file writes are disabled. Set LOCAL_COMPUTER_WRITE=true to allow writes inside approved roots.",
    };
  }

  const filePath = resolveLocalPath(targetPath);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, String(content ?? ""), "utf-8");

  return {
    success: true,
    path: filePath,
    size: String(content ?? "").length,
  };
}

/**
 * Think / plan step — no-op, just records the reasoning.
 */
function think({ thought }) {
  return { success: true, thought };
}

/**
 * Complete — signals the task is done.
 */
function complete({ summary, preview_file }) {
  return {
    success: true,
    status: "complete",
    summary,
    preview_file: preview_file || null,
  };
}

// ── Tool Executor ──

/**
 * Execute a tool call from the agent.
 */
async function executeTool(toolName, params) {
  console.log(`[Tool] Executing: ${toolName}`, JSON.stringify(params).substring(0, 100));

  switch (toolName) {
    case "generate_code":
      return generate_code(params);
    case "write_file":
      return write_file(params);
    case "read_file":
      return read_file(params);
    case "modify_file":
      return modify_file(params);
    case "list_files":
      return list_files();
    case "preview_html":
      return preview_html(params);
    case "search_web":
      return search_web(params);
    case "list_local_directory":
      return list_local_directory(params);
    case "read_local_file":
      return read_local_file(params);
    case "write_local_file":
      return write_local_file(params);
    case "mcp_call":
      return callConnector(params);
    case "run_terminal":
      return runTerminal({ command: params.command, cwd: params.cwd || OUTPUT_DIR });
    case "think":
      return think(params);
    case "complete":
      return complete(params);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Clear the output directory for a fresh workspace.
 */
function clearWorkspace() {
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

module.exports = {
  TOOL_DEFINITIONS,
  executeTool,
  clearWorkspace,
  getUserOutputDir,
  OUTPUT_DIR,
};
