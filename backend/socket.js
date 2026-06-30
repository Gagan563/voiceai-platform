// ============================================
// VoiceAI Platform — Socket.IO Setup
// ============================================
// Uses the hybrid AI router (Gemini → Anthropic → local)

const { Server } = require("socket.io");
const { INTENT_EXTRACTION_PROMPT, PLAN_GENERATION_PROMPT } = require("./prompts");
const ai = require("./services/ai");

/**
 * Initialize Socket.IO on the HTTP server.
 * Provides real-time messaging for AI responses.
 *
 * Events:
 *   - "stream:intent"   — client sends { text }, server returns intent
 *   - "stream:plan"     — client sends { intent }, server returns plan
 *   - "connection"      — logs new client connections
 *   - "disconnect"      — logs client disconnections
 */
function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    path: process.env.SOCKET_PATH || "/socket.io",
  });

  // ── WebSocket auth middleware ──
  const { verifyToken } = require("./middleware/auth");
  io.use((socket, next) => {
    const secret = process.env.JWT_SECRET;
    // Skip auth in dev mode if no JWT_SECRET is set
    if (!secret || secret === "change-this-to-a-random-64-char-string-in-production") {
      socket.user = { id: "dev-user", email: "dev@local", role: "admin" };
      return next();
    }

    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required — send token via auth.token"));
    }

    try {
      socket.user = verifyToken(token, secret);
      next();
    } catch (err) {
      next(new Error(`Auth failed: ${err.message}`));
    }
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id} (user: ${socket.user?.email || "unknown"})`);

    // ── Intent Extraction ──
    socket.on("stream:intent", async (data) => {
      const { text } = data;

      if (!text || typeof text !== "string") {
        socket.emit("stream:error", {
          error: "Invalid input: 'text' field is required and must be a string.",
        });
        return;
      }

      console.log(`[Socket.IO] stream:intent from ${socket.id}: "${text.substring(0, 50)}..."`);

      try {
        const intent = await ai.chatJSON(INTENT_EXTRACTION_PROMPT, text);
        socket.emit("stream:intent:complete", { intent });
      } catch (error) {
        console.error(`[Socket.IO] stream:intent error:`, error.message);
        socket.emit("stream:error", { error: error.message });
      }
    });

    // ── Plan Generation ──
    socket.on("stream:plan", async (data) => {
      const { intent } = data;

      if (!intent) {
        socket.emit("stream:error", {
          error: "Invalid input: 'intent' field is required.",
        });
        return;
      }

      console.log(`[Socket.IO] stream:plan from ${socket.id}`);

      try {
        const intentString = typeof intent === "string" ? intent : JSON.stringify(intent);
        const plan = await ai.chatJSON(PLAN_GENERATION_PROMPT, intentString);
        const planArray = Array.isArray(plan) ? plan : plan.plan || plan.steps || [];
        socket.emit("stream:plan:complete", { plan: planArray });
      } catch (error) {
        console.error(`[Socket.IO] stream:plan error:`, error.message);
        socket.emit("stream:error", { error: error.message });
      }
    });

    // ── Disconnect ──
    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log("[Socket.IO] Initialized and listening for connections");
  return io;
}

module.exports = { initializeSocket };
