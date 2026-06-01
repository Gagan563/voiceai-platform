// ============================================
// VoiceAI Platform — Express Server (Gemini-Powered)
// ============================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { INTENT_EXTRACTION_PROMPT, PLAN_GENERATION_PROMPT } = require("./prompts");
const { initializeSocket } = require("./socket");
const transcribeRouter = require("./routes/transcribe");
const ttsRouter = require("./routes/tts");
const memoriesRouter = require("./routes/memories");
const mcpRouter = require("./routes/mcp");
const { recallMemory, extractFacts, saveMemory, ensureDefaultUser } = require("./services/memory");
const ai = require("./services/ai");
const { runAgent } = require("./services/agent");
const { OUTPUT_DIR, executeTool } = require("./services/tools");

// ── Config ──
const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);

// ── Middleware ──
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Multer for audio uploads
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Multer for file uploads to the agent
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const fileUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
      cb(null, unique + "-" + file.originalname);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

function inferModuleFromText(text = "") {
  const value = text.toLowerCase();
  const rules = [
    ["health", /(health|symptom|medicine|medication|water|sleep|mood|exercise|bmi|calorie|doctor)/],
    ["finance", /(finance|expense|income|budget|spending|bill|currency|money|invoice)/],
    ["learn", /(learn|lesson|quiz|flashcard|teach|study|explain|homework)/],
    ["home", /(home assistant|smart home|light|thermostat|room|device|scene)/],
    ["travel", /(travel|trip|itinerary|flight|hotel|visa|packing|destination|weather)/],
    ["media", /(music|movie|tv|book|podcast|youtube|spotify|news|entertainment)/],
    ["translate", /(translate|translation|language|phrase|pronunciation)/],
    ["business", /(business|meeting summary|crm|contact|report|csv|data analysis|proposal)/],
    ["write", /(write|draft|email|essay|blog|post|cover letter|content|generate code)/],
    ["search", /(search|research|find|look up|source|latest)/],
    ["task", /(task|schedule|meeting|remind|reminder|calendar|checklist)/],
  ];

  return rules.find(([, pattern]) => pattern.test(value))?.[0] || "chat";
}

function inferActionType(text = "") {
  const value = text.toLowerCase();
  if (/(schedule|meeting|calendar|book)/.test(value)) return "schedule";
  if (/(remind|reminder|notify)/.test(value)) return "remind";
  if (/(search|research|find|look up|latest)/.test(value)) return "search";
  if (/(translate|language)/.test(value)) return "translate";
  if (/(turn on|turn off|control|thermostat|light)/.test(value)) return "control";
  if (/(write|draft|create|generate|make|build)/.test(value)) return "create";
  return "answer";
}

function fallbackIntent(text = "") {
  const goal = text.trim().replace(/[.?!]+$/, "") || "Help with a VoxMind request";
  const module = inferModuleFromText(goal);
  const actionType = inferActionType(goal);

  return {
    goal,
    module,
    action_type: actionType,
    entities: {
      time: null,
      person: null,
      location: null,
      topic: goal,
      amount: null,
      language: null,
    },
    steps: [
      "Understand the request",
      `Prepare a ${module} module result`,
      "Show the result and save it for follow-up",
    ],
    constraints: [],
    missing_info: [],
    confidence: 0.72,
    spoken_response: "I can help with that. I will prepare a practical plan and route it to the right module.",
  };
}

function fallbackPlan(intent = {}) {
  const module = intent.module || inferModuleFromText(intent.goal || "");
  const goal = intent.goal || "Complete the request";

  return [
    {
      step: 1,
      action: "parse_request",
      description: `Understand the request: ${goal}`,
      service: "ai",
      requires_input: false,
      estimated_duration_seconds: 2,
      fallback: "Ask for a clearer request",
    },
    {
      step: 2,
      action: `prepare_${module}_result`,
      description: `Create a useful ${module} result for the user`,
      service: module === "search" ? "web" : "ai",
      requires_input: false,
      estimated_duration_seconds: 4,
      fallback: "Save a local module note for manual follow-up",
    },
    {
      step: 3,
      action: "confirm_completion",
      description: "Confirm the result and save it in the module workspace",
      service: "notification",
      requires_input: false,
      estimated_duration_seconds: 1,
      fallback: "Log completion in the current session",
    },
  ];
}

// ── Health ──
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "voiceai-backend",
    version: "2.0.0",
    ai_engine: ai.isAvailable() ? "gemini" : "mock",
    ai_router: ai.providerStatus ? ai.providerStatus() : undefined,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── Existing routes ──
app.use("/transcribe", transcribeRouter);
app.use("/tts", ttsRouter);
app.use("/memories", memoriesRouter);
app.use("/mcp", mcpRouter);

// ── Intent Extraction (Gemini) ──
app.post("/intent", async (req, res) => {
  try {
    const { text, userId } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Invalid request body",
        hint: 'Send JSON with a "text" field.',
        example: { text: "Schedule a meeting with Sarah next Tuesday at 3pm" },
      });
    }

    const currentUserId = userId || "default-user";
    console.log(`[Intent] Processing: "${text.substring(0, 80)}"`);

    // Recall memories
    let memoriesContext = "";
    try {
      const memories = await recallMemory(currentUserId, text, 5);
      if (memories.length > 0) {
        memoriesContext = `\n\nRelevant context from previous sessions:\n${memories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
        console.log(`[Intent] Injecting ${memories.length} memories`);
      }
    } catch (err) {
      console.warn("[Intent] Memory recall skipped:", err.message);
    }

    const systemPrompt = INTENT_EXTRACTION_PROMPT + memoriesContext;
    const intent = await ai.chatJSON(systemPrompt, text);

    console.log(`[Intent] Extracted: action_type="${intent.action_type}", confidence=${intent.confidence}`);

    // Extract facts in background
    setImmediate(async () => {
      try {
        const conversationText = `User said: ${text}\nAI extracted intent: ${JSON.stringify(intent)}`;
        const facts = await extractFacts(conversationText);
        for (const fact of facts) {
          await saveMemory(currentUserId, fact);
        }
      } catch (err) {
        console.warn("[Intent] Fact extraction skipped:", err.message);
      }
    });

    res.json({
      success: true,
      intent,
      metadata: { engine: "gemini", memories_used: !!memoriesContext },
    });
  } catch (error) {
    console.error("[Intent] Error:", error.message);
    const intent = fallbackIntent(req.body?.text);
    res.json({
      success: true,
      intent,
      metadata: {
        engine: "local_fallback",
        reason: error.message,
        memories_used: false,
      },
    });
  }
});

// ── Plan Generation (Gemini) ──
app.post("/plan", async (req, res) => {
  try {
    const { intent } = req.body;

    if (!intent || typeof intent !== "object") {
      return res.status(400).json({
        error: "Invalid request body",
        hint: "Send JSON with an intent object.",
      });
    }

    console.log(`[Plan] Generating plan for: "${intent.goal}"`);

    const plan = await ai.chatJSON(PLAN_GENERATION_PROMPT, JSON.stringify(intent));

    const planArray = Array.isArray(plan) ? plan : plan.plan || plan.steps || [];

    res.json({
      success: true,
      plan: planArray,
      total_steps: planArray.length,
      metadata: { engine: "gemini" },
    });
  } catch (error) {
    console.error("[Plan] Error:", error.message);
    const planArray = fallbackPlan(req.body?.intent);
    res.json({
      success: true,
      plan: planArray,
      total_steps: planArray.length,
      metadata: { engine: "local_fallback", reason: error.message },
    });
  }
});

function stepText(step) {
  return [
    step.description,
    step.action,
    step.action_type,
    step.service,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function externalServiceMessage(step) {
  const text = stepText(step);
  if (/calendar|meeting|schedule|invite/.test(text)) {
    return "Calendar execution is not connected yet. The plan step is ready for a calendar connector.";
  }
  if (/email|mail|message|sms|send/.test(text)) {
    return "Messaging execution is not connected yet. The draft/send step needs a messaging connector.";
  }
  if (/notification|reminder/.test(text)) {
    return "Reminder execution is not connected yet. The reminder step needs a notification connector.";
  }
  return null;
}

async function executePlanStep(step, index) {
  const text = stepText(step);

  if (step.requires_input) {
    return {
      step: index + 1,
      status: "waiting_for_input",
      message: "This step needs user confirmation before it can run.",
    };
  }

  if (/search|research|web/.test(text)) {
    const searchQuery = step.query || step.description || step.goal || text;
    const result = await executeTool("search_web", { query: searchQuery });
    return {
      step: index + 1,
      status: result.success ? "completed" : "failed",
      message: result.success ? "Search completed." : result.error,
      result,
    };
  }

  const externalMessage = externalServiceMessage(step);
  if (externalMessage) {
    return {
      step: index + 1,
      status: "connector_required",
      message: externalMessage,
    };
  }

  return {
    step: index + 1,
    status: "completed",
    message: step.description || "Step completed.",
  };
}

function shouldRunAgent(plan) {
  return plan.some((step) =>
    /(build|create|generate|preview|code|filesystem|app|website|dashboard)/.test(
      stepText(step)
    )
  );
}

function planToAgentInput(plan) {
  const lines = plan.map((step, index) => {
    const description = step.description || step.action || "Complete this step";
    return `${index + 1}. ${description}`;
  });

  return `Execute this approved plan and produce a preview artifact when useful:\n${lines.join("\n")}`;
}

// ── Execute ──
app.post("/execute", async (req, res) => {
  const plan = req.body.plan || req.body.steps;
  const userId = req.body.userId || "default-user";

  if (!plan || !Array.isArray(plan)) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  try {
    const executionId = `exec_${Date.now()}`;
    const io = req.app.get("io");
    const results = [];
    let agentResult = null;

    if (shouldRunAgent(plan)) {
      agentResult = await runAgent({
        input: planToAgentInput(plan),
        userId,
        onStep: (step) => {
          if (io) io.emit("execution:step", { execution_id: executionId, ...step });
        },
      });
    }

    for (let index = 0; index < plan.length; index++) {
      results.push(await executePlanStep(plan[index], index));
    }

    const failed = results.filter((step) => step.status === "failed");
    const blocked = results.filter((step) =>
      ["connector_required", "waiting_for_input"].includes(step.status)
    );

    res.json({
      status: failed.length ? "partial" : "ok",
      message: blocked.length
        ? `Executed ${results.length - blocked.length} step(s). ${blocked.length} step(s) need a connector or confirmation.`
        : "Plan executed successfully.",
      execution_id: executionId,
      steps_received: plan.length,
      results,
      agent: agentResult,
    });
  } catch (error) {
    console.error("[Execute] Error:", error.message);
    res.status(500).json({ error: "Plan execution failed", details: error.message });
  }
});

// ══════════════════════════════════════════
//  AUTONOMOUS AGENT ROUTES
// ══════════════════════════════════════════

/**
 * POST /agent/run
 * Main agent endpoint — takes text + optional files,
 * runs autonomous loop, streams progress via WebSocket.
 */
app.post("/agent/run", fileUpload.array("files", 10), async (req, res) => {
  try {
    const { input, userId } = req.body;

    if (!input || typeof input !== "string") {
      return res.status(400).json({
        error: "Missing input",
        hint: 'Send a "input" field with your command.',
      });
    }

    const files = (req.files || []).map((f) => f.filename);
    const currentUserId = userId || "default-user";

    console.log(`[Agent] Starting: "${input.substring(0, 80)}" (${files.length} files)`);

    // Get the Socket.IO instance to stream progress
    const io = req.app.get("io");

    const result = await runAgent({
      input,
      files,
      userId: currentUserId,
      onStep: (step) => {
        // Stream to all connected clients
        if (io) {
          io.emit("agent:step", step);
        }
        console.log(`[Agent] ${step.type}: ${step.message || step.tool || ""}`);
      },
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[Agent] Error:", error.message);
    res.status(500).json({ error: "Agent failed", details: error.message });
  }
});

/**
 * POST /upload
 * Upload files for the agent to use.
 */
app.post("/upload", fileUpload.array("files", 10), (req, res) => {
  const files = (req.files || []).map((f) => ({
    filename: f.filename,
    originalName: f.originalname,
    size: f.size,
    mimetype: f.mimetype,
  }));

  res.json({ success: true, files, count: files.length });
});

/**
 * GET /agent/output/:filename
 * Serve files generated by the agent (for live preview).
 */
app.get("/agent/output/*", (req, res) => {
  // Extract the path after /agent/output/
  const requestedPath = req.params[0];
  const filePath = path.join(OUTPUT_DIR, requestedPath);

  // Security: prevent directory traversal
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(OUTPUT_DIR))) {
    return res.status(403).json({ error: "Access denied" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found", path: requestedPath });
  }

  // Set appropriate content type
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
    ".md": "text/markdown",
  };

  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
  res.sendFile(resolved);
});

/**
 * GET /agent/files
 * List all files in the agent output workspace.
 */
app.get("/agent/files", (req, res) => {
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
  res.json({ success: true, files, count: files.length });
});

// ── 404 / Error ──
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
    available_endpoints: [
      "GET  /health",
      "POST /intent",
      "POST /plan",
      "POST /execute",
      "POST /agent/run",
      "POST /upload",
      "GET  /agent/output/:file",
      "GET  /agent/files",
      "GET  /memories/:userId",
    ],
  });
});

app.use((err, req, res, next) => {
  console.error("[Server Error]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ── Socket.IO ──
const io = initializeSocket(server);
app.set("io", io);

// ── Start Server ──
server.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║      VoxMind — Autonomous AI Platform        ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Server:  http://localhost:${PORT}               ║`);
  console.log(`║  Engine:  ${(ai.isAvailable() ? "Google Gemini ✓" : "Mock Mode (no key)").padEnd(33)} ║`);
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║  POST /agent/run    — Autonomous agent       ║");
  console.log("║  POST /upload       — File upload            ║");
  console.log("║  GET  /agent/output — Preview files          ║");
  console.log("║  POST /intent       — Intent extraction      ║");
  console.log("║  POST /plan         — Plan generation        ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");

  ensureDefaultUser()
    .then(() => console.log("[Memory] Default user ready"))
    .catch((err) => console.warn("[Memory] Default user skipped:", err.message));
});

module.exports = { app, server };
