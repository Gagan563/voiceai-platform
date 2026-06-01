// ============================================
// VoiceAI Platform — Intent Extraction Route
// ============================================
// Uses the hybrid AI router (Gemini → Anthropic → local fallback)

const express = require("express");
const { INTENT_EXTRACTION_PROMPT } = require("../prompts");
const { recallMemory, extractFacts, saveMemory } = require("../services/memory");
const ai = require("../services/ai");

const router = express.Router();

function buildMemoryContext(memories) {
  if (!memories.length) return "";
  return `\n\nRelevant context from previous sessions: ${JSON.stringify(memories)}`;
}

router.post("/", async (req, res) => {
  try {
    const { text, userId = "default-user" } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Invalid request body",
        hint: "Send JSON with a text field containing the user's input.",
        example: { text: "Schedule a meeting with Sarah next Tuesday at 3pm" },
      });
    }

    console.log(`[Intent] Processing: "${text.substring(0, 80)}"`);

    // Recall memories
    let memories = [];
    try {
      memories = await recallMemory(userId, text, 5);
      if (memories.length > 0) {
        console.log(`[Intent] Injecting ${memories.length} memories`);
      }
    } catch (err) {
      console.warn("[Intent] Memory recall skipped:", err.message);
    }

    const system = INTENT_EXTRACTION_PROMPT + buildMemoryContext(memories);
    const intent = await ai.chatJSON(system, text);

    console.log(`[Intent] Extracted: action_type="${intent.action_type}", confidence=${intent.confidence}`);

    // Extract and save facts in background
    let savedFacts = 0;
    setImmediate(async () => {
      try {
        const exchange = [
          `User: ${text}`,
          `Assistant intent JSON: ${JSON.stringify(intent)}`,
        ].join("\n");
        const facts = await extractFacts(exchange);
        await Promise.all(facts.map((fact) => saveMemory(userId, fact)));
        savedFacts = facts.length;
      } catch (err) {
        console.warn("[Intent] Fact extraction skipped:", err.message);
      }
    });

    res.json({
      success: true,
      intent,
      metadata: {
        engine: "ai_router",
        memories_used: memories.length,
        facts_saved: savedFacts,
      },
    });
  } catch (error) {
    console.error("[Intent] Error:", error.message);
    res.status(500).json({
      error: "Intent extraction failed",
      details: error.message,
    });
  }
});

module.exports = router;
