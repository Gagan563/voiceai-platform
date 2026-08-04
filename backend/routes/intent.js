// ============================================
// VoiceAI Platform — Intent Extraction Route
// ============================================
// Uses the hybrid AI router (Gemini → Anthropic → local fallback)
// Safety middleware runs BEFORE intent extraction

const express = require("express");
const { INTENT_EXTRACTION_PROMPT } = require("../prompts");
const { recallMemory, extractFacts, saveMemory } = require("../services/memory");
const ai = require("../services/ai");
const config = require("../config");
const { assessRiskLevel } = require("../middleware/safety");
const { registry: skillRegistry } = require("../services/skills");

const router = express.Router();

function buildMemoryContext(memories) {
  if (!memories.length) return "";
  return `\n\nRelevant context from previous sessions: ${JSON.stringify(memories)}`;
}

router.post("/", async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.user?.id || config.DEFAULT_USER_ID;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Invalid request body",
        hint: "Send JSON with a text field containing the user's input.",
        example: { text: "Schedule a meeting with Sarah next Tuesday at 3pm" },
      });
    }

    // Safety check was already performed by middleware (req.safety)
    // If safety flagged the request, the middleware already responded.
    // This is a secondary check for direct API calls that bypass middleware.
    if (req.safety && !req.safety.safe) {
      return; // Already handled by safety middleware
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

    // Determine risk level — use AI's assessment, supplemented by our pattern-based check
    const patternRisk = assessRiskLevel(text);
    const aiRisk = intent.risk_level || "low";
    // Use the higher of the two risk assessments
    const riskOrder = { low: 0, medium: 1, high: 2 };
    const effectiveRisk = (riskOrder[aiRisk] || 0) >= (riskOrder[patternRisk] || 0)
      ? aiRisk
      : patternRisk;

    intent.risk_level = effectiveRisk;

    // Resolve the matching skill for this intent
    const skill = skillRegistry.resolve(intent.module, intent.action_type);
    const skillMeta = skill ? {
      skill_id: skill.id,
      skill_name: skill.name,
      requires_double_confirm: skill.riskLevel === "high",
    } : null;

    // Handle safety_review module — the AI flagged this as unsafe
    if (intent.module === "safety_review") {
      console.warn(`[Intent] AI flagged request as safety_review: "${text.substring(0, 60)}"`);
      return res.json({
        success: true,
        intent: {
          ...intent,
          risk_level: "high",
        },
        safety_flagged: true,
        metadata: {
          engine: "ai_router",
          memories_used: memories.length,
          facts_saved: 0,
          skill: skillMeta,
        },
      });
    }

    console.log(`[Intent] Extracted: action_type="${intent.action_type}", risk="${effectiveRisk}", confidence=${intent.confidence}`);

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
        risk_level: effectiveRisk,
        skill: skillMeta,
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

