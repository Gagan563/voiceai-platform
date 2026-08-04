// ============================================
// VoiceAI Platform — Express Server (Gemini-Powered)
// ============================================

const config = require("./config");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { emitToUser, initializeSocket } = require("./socket");
const transcribeRouter = require("./routes/transcribe");
const ttsRouter = require("./routes/tts");
const memoriesRouter = require("./routes/memories");
const mcpRouter = require("./routes/mcp");
const modulesRouter = require("./routes/modules");
const novaModulesRouter = require("./routes/nova-modules");
const chatRouter = require("./routes/chat");
const { ensureDefaultUser, getMemoryStatus } = require("./services/memory");
const ai = require("./services/ai");
const { listConnectors } = require("./services/mcp");
const { runAgent } = require("./services/agent");
const { orchestrate, AGENTS } = require("./services/orchestrator");
const { getUserOutputDir } = require("./services/tools");
const { extractDocument } = require("./services/document");
const {
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  recordRoutineRun,
  startRoutineScheduler,
} = require("./services/routines");
const {
  listReminders,
  updateReminder,
} = require("./services/reminders");
const { validateEnv } = require("./middleware/validateEnv");
const { authMiddleware } = require("./middleware/auth");
const { sanitizeMiddleware } = require("./middleware/sanitize");
const { aiLimiter, agentLimiter, authLimiter, generalLimiter } = require("./middleware/rateLimit");
const authRouter = require("./routes/auth");
const moduleDataRouter = require("./routes/module-data");
const backgroundAgent = require("./services/backgroundAgent");
const { safetyMiddleware } = require("./middleware/safety");
const { registry: skillRegistry } = require("./services/skills");

// ── Validate environment ──
validateEnv();

// ── Config ──
const PORT = config.PORT;
const app = express();
const server = http.createServer(app);

// ── Middleware ──
app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeMiddleware);
app.use(authMiddleware);

// Multer for audio uploads
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.FILE_SIZE_LIMITS.audio },
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
  limits: { fileSize: config.FILE_SIZE_LIMITS.agentFile },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.FILE_SIZE_LIMITS.image },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new Error("Only image files are supported."), false);
      return;
    }
    cb(null, true);
  },
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.FILE_SIZE_LIMITS.agentFile },
});

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Routine workflow (used by routines run + scheduler) ──

async function runRoutineWorkflow(routine, userId = config.DEFAULT_USER_ID) {
  const extractIntentForText = chatRouter._extractIntentForText;
  const generatePlanForIntent = chatRouter._generatePlanForIntent;
  const executePlanBatches = chatRouter._executePlanBatches;
  const reviewExecution = chatRouter._reviewExecution;
  const prompt = typeof routine.prompt === "string"
    ? routine.prompt.trim()
    : typeof routine.name === "string"
      ? routine.name.trim()
      : "";

  if (!prompt) {
    throw new Error("Routine prompt is required.");
  }

  const intent = await extractIntentForText(prompt, userId);
  const plan = await generatePlanForIntent(intent);
  const execution = await executePlanBatches(plan, userId);
  const review = await reviewExecution({ plan, results: execution.results });

  return {
    status: "ok",
    intent,
    plan,
    ...execution,
    review,
  };
}

// ── Health ──
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: config.APP_NAME,
    version: config.APP_VERSION,
    ai_engine: (() => {
      const status = ai.providerStatus ? ai.providerStatus() : {};
      const realProvider = Object.entries(status).find(([, s]) => s.configured && !s.circuit_open);
      return realProvider ? realProvider[0] : "mock_fallback";
    })(),
    ai_router: ai.providerStatus ? ai.providerStatus() : undefined,
    memory: getMemoryStatus ? getMemoryStatus() : undefined,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/status", (req, res) => {
  const aiRouter = ai.providerStatus ? ai.providerStatus() : {};
  const connectors = listConnectors();
  const requiredKeys = {
    whisper: config.isOpenAIConfigured(),
    groq: Boolean(config.GROQ_API_KEY),
    gemini: Boolean(config.GEMINI_API_KEY),
    anthropic: Boolean(config.ANTHROPIC_API_KEY),
    elevenlabs: config.isElevenLabsConfigured(),
  };

  res.json({
    success: true,
    status: "ok",
    services: {
      api: "ready",
      ai: ai.isAvailable() ? "ready" : "local_fallback",
      transcription: requiredKeys.whisper ? "whisper" : "needs_openai_key",
      memory: getMemoryStatus(),
      connectors,
      routines: {
        enabled: true,
        count: listRoutines().length,
      },
    },
    keys: requiredKeys,
    ai_router: aiRouter,
    demo: {
      connectors: config.CONNECTOR_DEMO_MODE,
      transcription: config.ALLOW_STUB_TRANSCRIPTION,
    },
  });
});

// ── Route modules ──
app.use("/transcribe", aiLimiter, transcribeRouter);
app.use("/tts", aiLimiter, ttsRouter);
app.use("/memories", generalLimiter, memoriesRouter);
app.use("/mcp", generalLimiter, mcpRouter);
app.use("/modules", generalLimiter, modulesRouter);
app.use("/nova", aiLimiter, novaModulesRouter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api", generalLimiter, moduleDataRouter);

// Skills API endpoint
app.get("/api/skills", generalLimiter, (req, res) => {
  res.json({
    success: true,
    skills: skillRegistry.listByBuildOrder(),
  });
});

// Chat / Intent / Plan / Execute / Stream (with safety middleware)
app.use("/", safetyMiddleware, chatRouter);

// ── Routine automation ──
app.get("/routines", (req, res) => {
  res.json({ success: true, routines: listRoutines() });
});

app.post("/routines", (req, res) => {
  try {
    const routine = createRoutine(req.body || {});
    res.status(201).json({ success: true, routine });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/routines/:id", (req, res) => {
  try {
    const routine = updateRoutine(req.params.id, req.body || {});
    if (!routine) return res.status(404).json({ error: "Routine not found" });
    res.json({ success: true, routine });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/routines/:id", (req, res) => {
  const deleted = deleteRoutine(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Routine not found" });
  res.json({ success: true, deleted });
});

app.post("/routines/:id/run", async (req, res) => {
  const routine = listRoutines().find((item) => item.id === req.params.id);
  if (!routine) return res.status(404).json({ error: "Routine not found" });

  try {
    const result = await runRoutineWorkflow(routine, req.user.id);
    const updated = recordRoutineRun(routine.id, result);
    res.json({ success: true, routine: updated, result });
  } catch (error) {
    const updated = recordRoutineRun(routine.id, {
      status: "failed",
      error: error.message,
    });
    res.status(500).json({ error: "Routine failed", details: error.message, routine: updated });
  }
});

// ── Local reminders ──
app.get("/reminders", (req, res) => {
  res.json({ success: true, reminders: listReminders(req.user.id) });
});

app.patch("/reminders/:id", (req, res) => {
  const reminder = updateReminder(req.params.id, req.body || {}, req.user.id);
  if (!reminder) return res.status(404).json({ error: "Reminder not found" });
  res.json({ success: true, reminder });
});

// ── Background Agent management ──
app.get("/background-agents", (req, res) => {
  res.json({ success: true, agents: backgroundAgent.listAgents(req.user.id) });
});

app.patch("/background-agents/:id/toggle", (req, res) => {
  const agent = backgroundAgent.setAgentEnabled(req.params.id, req.body?.enabled === undefined
    ? !backgroundAgent.isAgentEnabledForUser(req.params.id, req.user.id)
    : Boolean(req.body.enabled), req.user.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json({ success: true, agent: { id: agent.id, enabled: !agent.disabledForUsers.has(req.user.id) } });
});

app.post("/background-agents/:id/run", async (req, res) => {
  try {
    const result = await backgroundAgent.runAgent(req.params.id, req.user.id);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Image and screen context ──
app.post("/context/image", imageUpload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Upload an image file in the 'image' field." });
  }

  let prompt = "Describe the useful information in this image for a voice-first assistant.";
  if (req.body?.prompt !== undefined) {
    if (typeof req.body.prompt !== "string") {
      return res.status(400).json({ error: "Prompt must be a string." });
    }
    prompt = req.body.prompt.trim();
    if (!prompt) {
      return res.status(400).json({ error: "Prompt cannot be empty." });
    }
  }

  try {
    if (!ai.chatImage) throw new Error("Vision route is unavailable.");

    const analysis = await ai.chatImage(
      `You analyze image or screen context for a voice AI assistant.
Return a concise plain-text summary with visible text, important UI/state, and suggested next action.
Do not claim certainty for unclear details.`,
      {
        mimeType: req.file.mimetype,
        data: req.file.buffer.toString("base64"),
      },
      prompt,
      { task: "vision", maxTokens: 1200, temperature: 0.2 }
    );

    res.json({
      success: true,
      type: req.body?.type || "image",
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      analysis,
    });
  } catch (error) {
    res.json({
      success: true,
      type: req.body?.type || "image",
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      analysis:
        "Image received. Vision analysis needs a configured Gemini API key, so I can attach this context but cannot inspect the image yet.",
      metadata: { engine: "local_fallback", reason: error.message },
    });
  }
});

// ══════════════════════════════════════════
//  AUTONOMOUS AGENT ROUTES
// ══════════════════════════════════════════

app.post("/context/document", documentUpload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Upload a document file in the 'document' field." });
  }

  try {
    const document = await extractDocument({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    res.json({
      success: true,
      filename: document.filename,
      kind: document.kind,
      characters: document.characters,
      summary: document.summary,
      prompt: document.prompt,
      text: document.text.slice(0, 18000),
      truncated: document.text.length > 18000,
    });
  } catch (error) {
    console.warn("[Document] Analysis failed:", error.message);
    res.status(400).json({
      error: "Document analysis failed",
      details: "The uploaded document could not be processed.",
    });
  }
});

/**
 * POST /context/document/plan
 * Upload a requirement document and receive a structured implementation plan.
 */
app.post("/context/document/plan", documentUpload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Upload a document file in the 'document' field." });
  }

  try {
    const { extractAndPlan } = require("./services/document");
    const result = await extractAndPlan({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    res.json({
      success: true,
      filename: result.document.filename,
      kind: result.document.kind,
      characters: result.document.characters,
      summary: result.document.summary,
      requirements: result.requirements,
      phases: result.phases,
      text: result.document.text.slice(0, 18000),
      truncated: result.document.text.length > 18000,
    });
  } catch (error) {
    console.warn("[Document] Plan extraction failed:", error.message);
    res.status(400).json({
      error: "Document plan extraction failed",
      details: "The uploaded document could not be converted into a plan.",
    });
  }
});

/**
 * POST /agent/run
 * Main agent endpoint — takes text + optional files,
 * runs autonomous loop, streams progress via WebSocket.
 */
app.post("/agent/run", agentLimiter, fileUpload.array("files", 10), async (req, res) => {
  try {
    const { input } = req.body;

    if (!input || typeof input !== "string") {
      return res.status(400).json({
        error: "Missing input",
        hint: 'Send a "input" field with your command.',
      });
    }

    const files = (req.files || []).map((f) => f.filename);
    const userId = req.user.id;

    console.log(`[Agent] Starting (${files.length} files)`);

    // Get the Socket.IO instance to stream progress
    const io = req.app.get("io");

    const result = await runAgent({
      input,
      files,
      userId,
      onStep: (step) => {
        emitToUser(io, userId, "agent:step", step);
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
 * POST /orchestrate
 * Multi-agent DAG orchestration — decomposes a complex goal into
 * parallel specialist agents (coder, researcher, designer, tester, deployer).
 */
app.post("/orchestrate", agentLimiter, async (req, res) => {
  try {
    const { goal } = req.body;
    if (!goal) {
      return res.status(400).json({ error: "Missing goal", hint: 'Send a "goal" field.' });
    }

    const userId = req.user.id;
    console.log("[Orchestrator] Starting");
    const io = req.app.get("io");

    const result = await orchestrate(goal, {
      userId,
      onStep: (step) => {
        emitToUser(io, userId, "orchestrator:step", step);
        const label = step.agentName
          ? `[${step.agentIcon || "⚙️"} ${step.agentName}]`
          : "[Orchestrator]";
        console.log(`${label} ${step.type}: ${step.description || step.thinking || step.message || ""}`);
      },
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Orchestrator] Error:", error.message);
    res.status(500).json({ error: "Orchestration failed", details: error.message });
  }
});

/**
 * GET /agents
 * List available specialist agents and their capabilities.
 */
app.get("/agents", (req, res) => {
  const agents = Object.entries(AGENTS).map(([id, agent]) => ({
    id,
    name: agent.name,
    icon: agent.icon,
    tools: agent.tools,
  }));
  res.json({ success: true, agents });
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
  const outputDir = getUserOutputDir(req.user.id);
  const filePath = path.join(outputDir, requestedPath);

  // Security: prevent directory traversal
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(outputDir))) {
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
  res.setHeader("Cache-Control", "no-store, max-age=0");
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

  const files = walk(getUserOutputDir(req.user.id));
  res.json({ success: true, files, count: files.length });
});

// ── Socket.IO ──
const io = initializeSocket(server);
app.set("io", io);

// ── Serve frontend in production ──
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback — serve index.html for any non-API route
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/health")) return;
    res.sendFile(path.join(publicDir, "index.html"));
  });
  console.log("[Server] Serving static frontend from /public");
}

// ── 404 / Error ──
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
    available_endpoints: [
      "GET  /health",
      "POST /chat/stream",
      "POST /intent",
      "POST /plan",
      "POST /execute",
      "POST /chat/direct",
      "POST /agent/run",
      "POST /upload",
      "GET  /agent/output/:file",
      "GET  /agent/files",
      "GET  /memories",
    ],
  });
});

app.use((err, req, res, next) => {
  console.error("[Server Error]", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ── Start Server ──
server.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║        NOVA — Voice AI Platform              ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Server:  http://localhost:${PORT}               ║`);
  console.log(`║  Engine:  ${(ai.isAvailable() ? "Google Gemini ✓" : "Mock Mode (no key)").padEnd(33)} ║`);
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║  POST /agent/run    — Autonomous agent       ║");
  console.log("║  POST /upload       — File upload            ║");
  console.log("║  GET  /agent/output — Preview files          ║");
  console.log("║  POST /intent       — Intent extraction      ║");
  console.log("║  POST /plan         — Plan generation        ║");
  console.log("║  POST /chat/stream  — SSE streaming          ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");

  ensureDefaultUser()
    .then(() => console.log("[Memory] Default user ready"))
    .catch((err) => console.warn("[Memory] Default user skipped:", err.message));

  startRoutineScheduler(async (routine) => {
    console.log(`[Routine] Running scheduled routine: ${routine.name}`);
    return runRoutineWorkflow(routine, config.DEFAULT_USER_ID);
  });
  console.log("[Routine] Scheduler ready");

  // Start background agents
  backgroundAgent.registerBuiltinAgents();
  backgroundAgent.startScheduler(io, config.DEFAULT_USER_ID);
});

module.exports = { app, server };
