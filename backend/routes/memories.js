// ============================================
// VoiceAI Platform — Memories API Routes
// ============================================

const express = require("express");
const { getAllMemories, deleteMemory, clearAllMemories } = require("../services/memory");

const router = express.Router();

/**
 * GET /memories
 * Returns all stored memories for the authenticated user.
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const memories = await getAllMemories(userId);

    res.json({
      success: true,
      userId,
      memories,
      count: memories.length,
    });
  } catch (error) {
    console.error("[Memories API] Get error:", error.message);
    res.status(500).json({ error: "Failed to fetch memories", details: error.message });
  }
});

/**
 * DELETE /memories/all
 * Clears all memories for the authenticated user.
 */
router.delete("/all", async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await clearAllMemories(userId);

    res.json({
      success: true,
      message: "Cleared all memories",
      deleted: result.count,
    });
  } catch (error) {
    console.error("[Memories API] Clear error:", error.message);
    res.status(500).json({ error: "Failed to clear memories", details: error.message });
  }
});

/**
 * DELETE /memories/:memoryId
 * Deletes a specific memory.
 */
router.delete("/:memoryId", async (req, res) => {
  try {
    const { memoryId } = req.params;
    const userId = req.user.id;
    const result = await deleteMemory(userId, memoryId);

    if (result.count === 0) {
      return res.status(404).json({ error: "Memory not found" });
    }

    res.json({
      success: true,
      userId,
      message: `Memory ${memoryId} deleted`,
    });
  } catch (error) {
    console.error("[Memories API] Delete error:", error.message);

    res.status(500).json({ error: "Failed to delete memory", details: error.message });
  }
});

module.exports = router;
