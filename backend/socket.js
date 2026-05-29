// ============================================
// VoiceAI Platform — Socket.IO Setup
// ============================================

const { Server } = require("socket.io");
const Anthropic = require("@anthropic-ai/sdk");
const { INTENT_EXTRACTION_PROMPT, PLAN_GENERATION_PROMPT } = require("./prompts");

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Initialize Socket.IO on the HTTP server.
 * Provides real-time streaming for Claude responses.
 *
 * Events:
 *   - "stream:intent"   — client sends { text }, server streams intent extraction
 *   - "stream:plan"     — client sends { intent }, server streams plan generation
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

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // ── Stream Intent Extraction ──
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
        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: INTENT_EXTRACTION_PROMPT,
          messages: [{ role: "user", content: text }],
        });

        // Emit each text chunk as it arrives
        stream.on("text", (chunk) => {
          socket.emit("stream:intent:chunk", { chunk });
        });

        // Emit the final assembled message
        const finalMessage = await stream.finalMessage();
        const responseText = finalMessage.content[0]?.text || "";

        try {
          const parsed = JSON.parse(responseText);
          socket.emit("stream:intent:complete", { intent: parsed });
        } catch {
          socket.emit("stream:intent:complete", { intent: responseText, warning: "Response was not valid JSON" });
        }
      } catch (error) {
        console.error(`[Socket.IO] stream:intent error:`, error.message);
        socket.emit("stream:error", { error: error.message });
      }
    });

    // ── Stream Plan Generation ──
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

        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: PLAN_GENERATION_PROMPT,
          messages: [{ role: "user", content: intentString }],
        });

        // Emit each text chunk as it arrives
        stream.on("text", (chunk) => {
          socket.emit("stream:plan:chunk", { chunk });
        });

        // Emit the final assembled message
        const finalMessage = await stream.finalMessage();
        const responseText = finalMessage.content[0]?.text || "";

        try {
          const parsed = JSON.parse(responseText);
          socket.emit("stream:plan:complete", { plan: parsed });
        } catch {
          socket.emit("stream:plan:complete", { plan: responseText, warning: "Response was not valid JSON" });
        }
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
