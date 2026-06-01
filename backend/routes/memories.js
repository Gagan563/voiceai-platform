// ============================================
// VoiceAI Platform — Memories API Routes
// ============================================

const express = require("express");
const { getAllMemories, deleteMemory, clearAllMemories } = require("../services/memory");

const router = express.Router();

/**
 * GET /memories/:userId
 * Returns all stored memories for a user.
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
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
 * DELETE /memories/:userId/all
 * Clears all memories for a user.
 */
router.delete("/:userId/all", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await clearAllMemories(userId);

    res.json({
      success: true,
      message: `Cleared all memories for user ${userId}`,
      deleted: result.count,
    });
  } catch (error) {
    console.error("[Memories API] Clear error:", error.message);
    res.status(500).json({ error: "Failed to clear memories", details: error.message });
  }
});

/**
 * DELETE /memories/:userId/:memoryId
 * Deletes a specific memory.
 */
router.delete("/:userId/:memoryId", async (req, res) => {
  try {
    const { userId, memoryId } = req.params;
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
