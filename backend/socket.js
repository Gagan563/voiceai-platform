// ============================================
// VoiceAI Platform — Socket.IO Setup
// ============================================
// Uses the hybrid AI router (Gemini → Anthropic → local)

const { Server } = require("socket.io");
const { INTENT_EXTRACTION_PROMPT, PLAN_GENERATION_PROMPT } = require("./prompts");
const ai = require("./services/ai");
const { getJwtSecret, verifyToken } = require("./middleware/auth");
const config = require("./config");

function errorMessage(error, fallback = "Unexpected error") {
  return error instanceof Error ? error.message : fallback;
}

function userRoom(userId) {
  return `user:${userId}`;
}

function emitToUser(io, userId, event, payload) {
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit(event, payload);
}

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
      origin: config.CORS_ORIGINS,
      methods: ["GET", "POST"],
    },
    path: config.SOCKET_PATH,
  });

  // ── WebSocket auth middleware ──
  io.use((socket, next) => {
    const secret = getJwtSecret();
    if (!secret) return next(new Error("JWT_SECRET not configured"));

    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required — send token via auth.token"));
    }

    try {
      socket.user = verifyToken(token, secret);
      next();
    } catch (err) {
      next(new Error(`Auth failed: ${errorMessage(err)}`));
    }
  });

  io.on("connection", (socket) => {
    socket.join(userRoom(socket.user.id));
    console.log(`[Socket.IO] Client connected: ${socket.id} (userId: ${socket.user.id})`);

    // ── Intent Extraction ──
    socket.on("stream:intent", async (data) => {
      const { text } = data;

      if (!text || typeof text !== "string") {
        socket.emit("stream:error", {
          error: "Invalid input: 'text' field is required and must be a string.",
        });
        return;
      }

      console.log(`[Socket.IO] stream:intent from ${socket.id}`);

      try {
        const intent = await ai.chatJSON(INTENT_EXTRACTION_PROMPT, text);
        socket.emit("stream:intent:complete", { intent });
      } catch (error) {
        console.error("[Socket.IO] stream:intent error:", errorMessage(error));
        socket.emit("stream:error", { error: errorMessage(error) });
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
        console.error("[Socket.IO] stream:plan error:", errorMessage(error));
        socket.emit("stream:error", { error: errorMessage(error) });
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

module.exports = { emitToUser, initializeSocket, userRoom };
