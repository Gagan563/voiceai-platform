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

// Sandboxed output directory for agent-generated files
const OUTPUT_DIR = path.join(__dirname, "..", "agent-output");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function resolveOutputPath(filename) {
  const cleanFilename = String(filename || "").trim();
  if (!cleanFilename) {
    throw new Error("Filename is required.");
  }

  const resolved = path.resolve(OUTPUT_DIR, cleanFilename);
  const workspace = path.resolve(OUTPUT_DIR);
  if (resolved !== workspace && !resolved.startsWith(workspace + path.sep)) {
    throw new Error("File path escapes the output workspace.");
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
    case "mcp_call":
      return callConnector(params);
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
  OUTPUT_DIR,
};
