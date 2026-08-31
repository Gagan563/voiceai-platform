/**
 * Knowledge Hub API Routes
 */

const express = require("express");
const multer = require("multer");
const {
  indexDocument,
  searchKnowledge,
  listDocuments,
  deleteDocument,
  clearKnowledge,
} = require("../services/knowledge");
const logger = require("../services/logger");

const router = express.Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// GET /knowledge/documents
router.get("/documents", (req, res) => {
  try {
    const docs = listDocuments(req.user?.id);
    res.json({ success: true, documents: docs, count: docs.length });
  } catch (err) {
    logger.error("List documents failed", { error: err.message });
    res.status(500).json({ error: "Failed to list knowledge documents." });
  }
});

// POST /knowledge/index — Ingest plain text or markdown document
router.post("/index", async (req, res) => {
  try {
    const { title, content, type, tags } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required." });
    }

    const doc = await indexDocument({
      title,
      content,
      type: type || "manual",
      tags: Array.isArray(tags) ? tags : [],
      userId: req.user?.id || "default-user",
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    logger.error("Index document failed", { error: err.message });
    res.status(500).json({ error: err.message || "Failed to index document." });
  }
});

// POST /knowledge/upload — Ingest uploaded file (txt, md, json, log)
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const title = req.body.title || req.file.originalname;
    const content = req.file.buffer.toString("utf-8");

    const doc = await indexDocument({
      title,
      content,
      type: req.file.mimetype || "file",
      tags: req.body.tags ? JSON.parse(req.body.tags) : [req.file.originalname.split(".").pop()],
      userId: req.user?.id || "default-user",
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    logger.error("File upload to knowledge base failed", { error: err.message });
    res.status(500).json({ error: err.message || "Failed to parse and index file." });
  }
});

// POST /knowledge/search — Semantic query
router.post("/search", (req, res) => {
  try {
    const { query, topK, minScore } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Search query is required." });
    }

    const results = searchKnowledge(query, {
      topK: Number(topK) || 4,
      minScore: minScore !== undefined ? Number(minScore) : 0.1,
    });

    res.json({ success: true, query, results, count: results.length });
  } catch (err) {
    logger.error("Knowledge search failed", { error: err.message });
    res.status(500).json({ error: "Knowledge search failed." });
  }
});

// DELETE /knowledge/documents/:id
router.delete("/documents/:id", (req, res) => {
  try {
    const result = deleteDocument(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to delete document." });
  }
});

// DELETE /knowledge/clear
router.delete("/clear", (req, res) => {
  try {
    const result = clearKnowledge();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to clear knowledge base." });
  }
});

module.exports = router;
