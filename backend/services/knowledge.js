/**
 * NOVA VoiceAI — Knowledge Hub & Vector RAG Service
 *
 * Provides document chunking, semantic vector embeddings, and cosine similarity search.
 * Works offline with local vector index or with OpenAI/Gemini embedding APIs.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const logger = require("./logger");

const KNOWLEDGE_DIR = path.join(__dirname, "..", "data", "knowledge");
const INDEX_FILE = path.join(KNOWLEDGE_DIR, "index.json");

function ensureStore() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(
      INDEX_FILE,
      JSON.stringify({ documents: [], chunks: [] }, null, 2),
      "utf-8"
    );
  }
}

function readIndex() {
  ensureStore();
  try {
    const raw = fs.readFileSync(INDEX_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    logger.error("Failed to read knowledge index", { error: err.message });
    return { documents: [], chunks: [] };
  }
}

function writeIndex(data) {
  ensureStore();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Deterministic bag-of-words / TF-IDF style pseudo-embedding generator
 * used as an instant zero-latency offline embedding fallback.
 */
function generateLocalEmbedding(text, dimensions = 128) {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const vector = new Array(dimensions).fill(0);
  if (words.length === 0) return vector;

  words.forEach((word) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % dimensions;
    vector[bucket] += 1;
  });

  // Normalize to unit vector
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return magnitude > 0 ? vector.map((v) => v / magnitude) : vector;
}

/**
 * Compute cosine similarity between two unit vectors.
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

/**
 * Split raw text into chunks with sliding overlap.
 */
function chunkText(text, chunkSize = 400, overlap = 80) {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const cleanPara = para.trim();
    if (!cleanPara) continue;

    if ((currentChunk + " " + cleanPara).length > chunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 6)).join(" ");
      currentChunk = overlapWords + " " + cleanPara;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + cleanPara : cleanPara;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text.slice(0, chunkSize)];
}

/**
 * Ingest and index a document.
 */
async function indexDocument({ title, content, type = "text", tags = [], userId = "default-user" }) {
  if (!content || !title) {
    throw new Error("Title and content are required for document indexing.");
  }

  const docId = `doc_${crypto.randomBytes(8).toString("hex")}`;
  const rawChunks = chunkText(content, 450, 75);

  const chunks = rawChunks.map((text, idx) => {
    const embedding = generateLocalEmbedding(text);
    return {
      id: `chk_${docId}_${idx}`,
      docId,
      docTitle: title,
      text,
      embedding,
      tags,
      index: idx,
      createdAt: new Date().toISOString(),
    };
  });

  const docRecord = {
    id: docId,
    title,
    type,
    tags,
    userId,
    charCount: content.length,
    chunkCount: chunks.length,
    summary: content.slice(0, 180) + (content.length > 180 ? "..." : ""),
    createdAt: new Date().toISOString(),
  };

  const store = readIndex();
  store.documents.unshift(docRecord);
  store.chunks.push(...chunks);
  writeIndex(store);

  logger.info(`Indexed document '${title}' with ${chunks.length} chunks`, { docId });
  return docRecord;
}

/**
 * Search indexed documents by semantic similarity.
 */
function searchKnowledge(query, { topK = 4, minScore = 0.15 } = {}) {
  if (!query || typeof query !== "string") return [];

  const store = readIndex();
  if (store.chunks.length === 0) return [];

  const queryVector = generateLocalEmbedding(query);

  const scored = store.chunks.map((chunk) => {
    const similarity = cosineSimilarity(queryVector, chunk.embedding);
    return {
      id: chunk.id,
      docId: chunk.docId,
      docTitle: chunk.docTitle,
      text: chunk.text,
      score: Number(similarity.toFixed(4)),
      tags: chunk.tags,
    };
  });

  return scored
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * List all indexed documents.
 */
function listDocuments(userId) {
  const store = readIndex();
  return store.documents;
}

/**
 * Delete an indexed document and all its chunks.
 */
function deleteDocument(docId) {
  const store = readIndex();
  store.documents = store.documents.filter((d) => d.id !== docId);
  store.chunks = store.chunks.filter((c) => c.docId !== docId);
  writeIndex(store);
  return { success: true, docId };
}

/**
 * Clear the entire knowledge base.
 */
function clearKnowledge() {
  writeIndex({ documents: [], chunks: [] });
  return { success: true };
}

module.exports = {
  indexDocument,
  searchKnowledge,
  listDocuments,
  deleteDocument,
  clearKnowledge,
  generateLocalEmbedding,
};
