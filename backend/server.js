// ============================================
// VoiceAI Platform — Express Server
// ============================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const multer = require("multer");
const Anthropic = require("@anthropic-ai/sdk");
const { INTENT_EXTRACTION_PROMPT, PLAN_GENERATION_PROMPT } = require("./prompts");
const { initializeSocket } = require("./socket");
const transcribeRouter = require("./routes/transcribe");
const ttsRouter = require("./routes/tts");
const memoriesRouter = require("./routes/memories");
const { recallMemory, extractFacts, saveMemory, ensureDefaultUser } = require("./services/memory");

// ── Config ──
const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);

// ── Middleware ──
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Multer config for audio file uploads (used by /transcribe)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "audio/wav", "audio/mpeg", "audio/mp3", "audio/ogg",
      "audio/webm", "audio/flac", "audio/m4a", "audio/mp4",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`), false);
    }
  },
});

// ── Anthropic Client ──
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Request Logger Middleware ──
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// =============================================
// ROUTES
// =============================================

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "voiceai-backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * POST /transcribe — Audio → Text (Whisper API or stub)
 */
app.use("/transcribe", transcribeRouter);

/**
 * POST /tts — Text → Speech (ElevenLabs API)
 */
app.use("/tts", ttsRouter);

/**
 * Memory CRUD routes
 */
app.use("/memories", memoriesRouter);

/**
 * POST /intent
 * Takes { text }, sends to Claude with intent extraction prompt.
 * Returns structured JSON: goal, action_type, entities, constraints, missing_info, confidence
 */
app.post("/intent", async (req, res) => {
  try {
    const { text, userId } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Invalid request body",
        hint: "Send JSON with a 'text' field containing the user's spoken input as a string.",
        example: { text: "Schedule a meeting with Sarah next Tuesday at 3pm" },
      });
    }

    const currentUserId = userId || "default-user";
    console.log(`[Intent] Processing: "${text.substring(0, 80)}${text.length > 80 ? "..." : ""}"`);

    // ── Recall relevant memories ──
    let memoriesContext = "";
    try {
      const memories = await recallMemory(currentUserId, text, 5);
      if (memories.length > 0) {
        memoriesContext = `\n\nRelevant context from previous sessions:\n${memories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
        console.log(`[Intent] Injecting ${memories.length} memories into prompt`);
      }
    } catch (err) {
      console.warn("[Intent] Memory recall failed (continuing without):", err.message);
    }

    // ── Extract intent with memory-augmented prompt ──
    const systemPrompt = INTENT_EXTRACTION_PROMPT + memoriesContext;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    });

    const responseText = message.content[0]?.text || "";

    // Parse the JSON response from Claude
    let intent;
    try {
      intent = JSON.parse(responseText);
    } catch {
      console.warn("[Intent] Claude did not return valid JSON. Raw response:", responseText);
      return res.status(502).json({
        error: "AI returned invalid JSON",
        raw_response: responseText,
        hint: "The AI model did not follow the expected response format. Try rephrasing your input.",
      });
    }

    console.log(`[Intent] Extracted: action_type="${intent.action_type}", confidence=${intent.confidence}`);

    // ── Extract and save facts asynchronously (don't block response) ──
    setImmediate(async () => {
      try {
        const conversationText = `User said: ${text}\nAI extracted intent: ${JSON.stringify(intent)}`;
        const facts = await extractFacts(conversationText);
        for (const fact of facts) {
          await saveMemory(currentUserId, fact);
        }
      } catch (err) {
        console.warn("[Intent] Background fact extraction failed:", err.message);
      }
    });

    res.json({
      success: true,
      intent,
      metadata: {
        model: "claude-sonnet-4-20250514",
        input_tokens: message.usage?.input_tokens,
        output_tokens: message.usage?.output_tokens,
        memories_used: memoriesContext ? true : false,
      },
    });
  } catch (error) {
    console.error("[Intent] Error:", error.message);

    if (error.status === 401) {
      return res.status(401).json({
        error: "Invalid Anthropic API key",
        hint: "Check your ANTHROPIC_API_KEY in the .env file.",
      });
    }

    res.status(500).json({ error: "Intent extraction failed", details: error.message });
  }
});

/**
 * POST /plan
 * Takes intent JSON, sends to Claude, returns a numbered step-by-step plan as JSON array.
 */
app.post("/plan", async (req, res) => {
  try {
    const { intent } = req.body;

    if (!intent || typeof intent !== "object") {
      return res.status(400).json({
        error: "Invalid request body",
        hint: "Send JSON with an 'intent' field containing the structured intent object from /intent.",
        example: {
          intent: {
            goal: "Schedule a meeting",
            action_type: "schedule",
            entities: { person: "Sarah" },
            constraints: ["next Tuesday"],
            missing_info: [],
            confidence: 0.9,
          },
        },
      });
    }

    console.log(`[Plan] Generating plan for: "${intent.goal}"`);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: PLAN_GENERATION_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(intent) }],
    });

    const responseText = message.content[0]?.text || "";

    // Parse the JSON array response from Claude
    let plan;
    try {
      plan = JSON.parse(responseText);
    } catch {
      console.warn("[Plan] Claude did not return valid JSON. Raw response:", responseText);
      return res.status(502).json({
        error: "AI returned invalid JSON",
        raw_response: responseText,
        hint: "The AI model did not follow the expected response format.",
      });
    }

    if (!Array.isArray(plan)) {
      return res.status(502).json({
        error: "AI returned JSON but not an array",
        raw_response: plan,
      });
    }

    console.log(`[Plan] Generated ${plan.length} steps`);

    res.json({
      success: true,
      plan,
      total_steps: plan.length,
      estimated_total_seconds: plan.reduce((sum, step) => sum + (step.estimated_duration_seconds || 0), 0),
      metadata: {
        model: "claude-sonnet-4-20250514",
        input_tokens: message.usage?.input_tokens,
        output_tokens: message.usage?.output_tokens,
      },
    });
  } catch (error) {
    console.error("[Plan] Error:", error.message);

    if (error.status === 401) {
      return res.status(401).json({
        error: "Invalid Anthropic API key",
        hint: "Check your ANTHROPIC_API_KEY in the .env file.",
      });
    }

    res.status(500).json({ error: "Plan generation failed", details: error.message });
  }
});

/**
 * POST /execute
 * Takes an approved plan, logs it, and returns confirmation.
 * STUB — will connect to actual service executors in a future phase.
 */
app.post("/execute", (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || !Array.isArray(plan)) {
      return res.status(400).json({
        error: "Invalid request body",
        hint: "Send JSON with a 'plan' field containing the step array from /plan.",
      });
    }

    console.log(`[Execute] Received approved plan with ${plan.length} steps:`);
    plan.forEach((step) => {
      console.log(`  Step ${step.step}: [${step.service}] ${step.action} — ${step.description}`);
    });

    // STUB: Log and acknowledge
    res.json({
      status: "ok",
      message: "Plan received",
      steps_received: plan.length,
      execution_id: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      note: "STUB — Actual execution will be implemented in a future phase. Plan has been logged.",
    });
  } catch (error) {
    console.error("[Execute] Error:", error.message);
    res.status(500).json({ error: "Execution failed", details: error.message });
  }
});

// ── 404 Handler ──
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
    available_endpoints: [
      "GET  /health",
      "POST /transcribe",
      "POST /intent",
      "POST /plan",
      "POST /execute",
    ],
  });
});

// ── Error Handler ──
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.message);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// ── Initialize Socket.IO ──
const io = initializeSocket(server);

// ── Start Server ──
server.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║         VoiceAI Platform — Backend           ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  HTTP Server:  http://localhost:${PORT}          ║`);
  console.log(`║  Socket.IO:    ws://localhost:${PORT}            ║`);
  console.log(`║  Environment:  ${(process.env.NODE_ENV || "development").padEnd(24)}     ║`);
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║  Endpoints:                                  ║");
  console.log("║    GET  /health     — Health check            ║");
  console.log("║    POST /transcribe — Audio → Text (Whisper)   ║");
  console.log("║    POST /intent     — Text → Intent JSON      ║");
  console.log("║    POST /plan       — Intent → Step Plan      ║");
  console.log("║    POST /execute    — Plan → Execution (stub) ║");
  console.log("║    POST /tts        — Text → Speech            ║");
  console.log("║    GET  /memories   — List user memories       ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");

  // Ensure default user exists for single-user mode
  ensureDefaultUser()
    .then(() => console.log("[Memory] Default user ready"))
    .catch((err) => console.warn("[Memory] Could not create default user:", err.message));
});

module.exports = { app, server };
