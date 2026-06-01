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
const modulesRouter = require("./routes/modules");
const { recallMemory, extractFacts, saveMemory, ensureDefaultUser, getMemoryStatus } = require("./services/memory");
const ai = require("./services/ai");
const { listConnectors } = require("./services/mcp");
const { runAgent } = require("./services/agent");
const { OUTPUT_DIR, executeTool } = require("./services/tools");
const {
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  recordRoutineRun,
  startRoutineScheduler,
} = require("./services/routines");

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

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new Error("Only image files are supported."), false);
      return;
    }
    cb(null, true);
  },
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

function confidenceNumber(value, fallback = 0.72) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function buildClarifyingQuestion(intent = {}) {
  const missing = Array.isArray(intent.missing_info) ? intent.missing_info.filter(Boolean) : [];
  if (missing.length > 0) {
    return `I can do that. What should I use for ${missing[0]}?`;
  }

  const goal = intent.goal || "that request";
  return `I want to make sure I understood ${goal}. What is the main result you want?`;
}

function enrichIntent(intent = {}, sourceText = "") {
  const confidence = confidenceNumber(intent.confidence);
  const missingInfo = Array.isArray(intent.missing_info) ? intent.missing_info : [];
  const needsClarification = confidence < 0.7;

  return {
    ...intent,
    goal: intent.goal || sourceText.trim() || "Help with a VoxMind request",
    missing_info: missingInfo,
    confidence,
    clarification: needsClarification
      ? {
          required: true,
          reason: "low_confidence",
          question: buildClarifyingQuestion({ ...intent, missing_info: missingInfo }),
        }
      : {
          required: false,
        },
  };
}

function enrichPlanSteps(plan = [], intent = {}) {
  const baseConfidence = confidenceNumber(intent.confidence, 0.74);
  return plan.map((step, index) => {
    const requiresInput = Boolean(step.requires_input);
    const confidencePenalty = requiresInput ? 0.14 : 0.03 * Math.min(index, 4);
    const confidence = confidenceNumber(
      step.confidence,
      Math.max(0.45, baseConfidence - confidencePenalty)
    );

    return {
      ...step,
      step: Number(step.step) || index + 1,
      action: step.action || step.action_type || "general",
      service: step.service || "ai",
      requires_input: requiresInput,
      estimated_duration_seconds: Number(step.estimated_duration_seconds) || 2 + index,
      fallback: step.fallback || "Ask for confirmation and retry this step",
      confidence,
      parallel_group: step.parallel_group || null,
    };
  });
}

async function extractIntentForText(text, userId = "default-user") {
  let memoriesContext = "";
  try {
    const memories = await recallMemory(userId, text, 5);
    if (memories.length > 0) {
      memoriesContext = `\n\nRelevant context from previous sessions:\n${memories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
      console.log(`[Intent] Injecting ${memories.length} memories`);
    }
  } catch (err) {
    console.warn("[Intent] Memory recall skipped:", err.message);
  }

  const systemPrompt = INTENT_EXTRACTION_PROMPT + memoriesContext;
  const intent = enrichIntent(await ai.chatJSON(systemPrompt, text), text);

  setImmediate(async () => {
    try {
      const conversationText = `User said: ${text}\nAI extracted intent: ${JSON.stringify(intent)}`;
      const facts = await extractFacts(conversationText);
      for (const fact of facts) {
        await saveMemory(userId, fact);
      }
    } catch (err) {
      console.warn("[Intent] Fact extraction skipped:", err.message);
    }
  });

  return intent;
}

async function generatePlanForIntent(intent = {}) {
  const plan = await ai.chatJSON(PLAN_GENERATION_PROMPT, JSON.stringify(intent));
  const planArray = Array.isArray(plan) ? plan : plan.plan || plan.steps || [];
  return enrichPlanSteps(planArray, intent);
}

// ── Health ──
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "voiceai-backend",
    version: "2.0.0",
    ai_engine: ai.isAvailable() ? "gemini" : "mock",
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
    whisper: Boolean(process.env.OPENAI_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
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
      connectors: process.env.CONNECTOR_DEMO_MODE !== "false",
      transcription: process.env.ALLOW_STUB_TRANSCRIPTION === "true",
    },
  });
});

// ── Existing routes ──
app.use("/transcribe", transcribeRouter);
app.use("/tts", ttsRouter);
app.use("/memories", memoriesRouter);
app.use("/mcp", mcpRouter);
app.use("/modules", modulesRouter);

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

    const intent = await extractIntentForText(text, currentUserId);

    console.log(`[Intent] Extracted: action_type="${intent.action_type}", confidence=${intent.confidence}`);

    res.json({
      success: true,
      intent,
      metadata: {
        engine: "ai_router",
        clarification_required: Boolean(intent.clarification?.required),
      },
    });
  } catch (error) {
    console.error("[Intent] Error:", error.message);
    const intent = enrichIntent(fallbackIntent(req.body?.text), req.body?.text);
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

    const planArray = await generatePlanForIntent(intent);

    res.json({
      success: true,
      plan: planArray,
      total_steps: planArray.length,
      metadata: { engine: "gemini" },
    });
  } catch (error) {
    console.error("[Plan] Error:", error.message);
    const planArray = enrichPlanSteps(fallbackPlan(req.body?.intent), req.body?.intent);
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
      step_id: step.id || null,
      status: "waiting_for_input",
      message: "This step needs user confirmation before it can run.",
    };
  }

  if (/search|research|web/.test(text)) {
    const searchQuery = step.query || step.description || step.goal || text;
    const result = await executeTool("search_web", { query: searchQuery });
    return {
      step: index + 1,
      step_id: step.id || null,
      status: result.success ? "completed" : "failed",
      message: result.success ? "Search completed." : result.error,
      result,
    };
  }

  const externalMessage = externalServiceMessage(step);
  if (externalMessage) {
    return {
      step: index + 1,
      step_id: step.id || null,
      status: "connector_required",
      message: externalMessage,
    };
  }

  return {
    step: index + 1,
    step_id: step.id || null,
    status: "completed",
    message: step.description || "Step completed.",
  };
}

function isBarrierStep(step) {
  const text = stepText(step);
  return (
    step.requires_input ||
    Boolean(step.depends_on || step.dependsOn) ||
    Boolean(externalServiceMessage(step)) ||
    /confirm|final|notify|summari[sz]e|review/.test(text)
  );
}

function buildExecutionBatches(plan) {
  const batches = [];
  let current = [];

  const flush = () => {
    if (current.length) {
      batches.push(current);
      current = [];
    }
  };

  plan.forEach((step, index) => {
    const entry = { step, index };
    if (isBarrierStep(step)) {
      flush();
      batches.push([entry]);
      return;
    }
    current.push(entry);
  });

  flush();
  return batches;
}

async function executePlanBatches(plan) {
  const batches = buildExecutionBatches(plan);
  const results = new Array(plan.length);
  const batchSummaries = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchResults =
      batch.length > 1
        ? await Promise.all(batch.map(({ step, index }) => executePlanStep(step, index)))
        : [await executePlanStep(batch[0].step, batch[0].index)];

    batchResults.forEach((result, offset) => {
      results[batch[offset].index] = result;
    });

    batchSummaries.push({
      batch: batchIndex + 1,
      mode: batch.length > 1 ? "parallel" : "sequential",
      steps: batch.map(({ index }) => index + 1),
    });
  }

  return { results, batches: batchSummaries };
}

function fallbackExecutionReview(results = []) {
  const failed = results.filter((step) => step.status === "failed");
  const blocked = results.filter((step) =>
    ["connector_required", "waiting_for_input"].includes(step.status)
  );
  const completed = results.filter((step) => step.status === "completed");
  const confidence = results.length ? completed.length / results.length : 0;

  return {
    status: failed.length ? "needs_attention" : blocked.length ? "partial" : "passed",
    confidence: Number(confidence.toFixed(2)),
    summary: blocked.length
      ? `${completed.length} step(s) completed; ${blocked.length} step(s) need confirmation or connectors.`
      : failed.length
        ? `${failed.length} step(s) failed and should be retried or adjusted.`
        : "All executable steps completed cleanly.",
    issues: [
      ...failed.map((step) => `Step ${step.step} failed: ${step.message || "unknown error"}`),
      ...blocked.map((step) => `Step ${step.step} is blocked: ${step.message}`),
    ],
    corrections: failed.length ? ["Retry failed steps after checking connector/API state."] : [],
  };
}

async function reviewExecution({ plan, results, agent }) {
  const fallback = fallbackExecutionReview(results);
  if (!ai.isAvailable()) return fallback;

  try {
    const review = await ai.chatJSON(
      `You review an AI assistant execution result.
Return ONLY JSON with: status ("passed"|"partial"|"needs_attention"), confidence (0-1), summary, issues array, corrections array.
Be concise. Do not expose hidden reasoning.`,
      JSON.stringify({ plan, results, agent }),
      { task: "review", maxTokens: 1200, temperature: 0.2 }
    );

    return {
      ...fallback,
      ...review,
      confidence: confidenceNumber(review.confidence, fallback.confidence),
      issues: Array.isArray(review.issues) ? review.issues : fallback.issues,
      corrections: Array.isArray(review.corrections) ? review.corrections : fallback.corrections,
    };
  } catch (error) {
    console.warn("[Execute] Review fallback:", error.message);
    return fallback;
  }
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

async function runRoutineWorkflow(routine, userId = "default-user") {
  const intent = await extractIntentForText(routine.prompt, userId);
  const plan = await generatePlanForIntent(intent);
  const execution = await executePlanBatches(plan);
  const review = await reviewExecution({ plan, results: execution.results, agent: null });

  return {
    status: review.status === "needs_attention" ? "partial" : "ok",
    routine_id: routine.id,
    intent,
    plan,
    batches: execution.batches,
    results: execution.results,
    review,
  };
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

    const execution = await executePlanBatches(plan);
    results.push(...execution.results);

    const failed = results.filter((step) => step.status === "failed");
    const blocked = results.filter((step) =>
      ["connector_required", "waiting_for_input"].includes(step.status)
    );
    const review = await reviewExecution({ plan, results, agent: agentResult });

    res.json({
      status: failed.length ? "partial" : "ok",
      message: blocked.length
        ? `Executed ${results.length - blocked.length} step(s). ${blocked.length} step(s) need a connector or confirmation.`
        : "Plan executed successfully.",
      execution_id: executionId,
      steps_received: plan.length,
      batches: execution.batches,
      results,
      review,
      agent: agentResult,
    });
  } catch (error) {
    console.error("[Execute] Error:", error.message);
    res.status(500).json({ error: "Plan execution failed", details: error.message });
  }
});

// Routine automation
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
    const result = await runRoutineWorkflow(routine, req.body?.userId || "default-user");
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

// Image and screen context
app.post("/context/image", imageUpload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Upload an image file in the 'image' field." });
  }

  const prompt =
    req.body?.prompt ||
    "Describe the useful information in this image for a voice-first assistant.";

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

  startRoutineScheduler(async (routine) => {
    console.log(`[Routine] Running scheduled routine: ${routine.name}`);
    return runRoutineWorkflow(routine, "default-user");
  });
  console.log("[Routine] Scheduler ready");
});

module.exports = { app, server };
