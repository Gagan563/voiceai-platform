// ============================================
// VoiceAI Platform — Memory Service
// ============================================

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const Anthropic = require("@anthropic-ai/sdk");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://voiceai:voiceai_secret@localhost:5432/voiceai_db",
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Embedding Helper ──

/**
 * Generate a 1536-dim embedding for the given text using OpenAI Ada.
 */
async function generateEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-xxxxx-your-openai-key-here") {
    throw new Error("OPENAI_API_KEY not configured — cannot generate embeddings.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text.substring(0, 8000), // Ada max is ~8k tokens
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.data[0].embedding; // float array of length 1536
}

// ── Memory Functions ──

/**
 * Save a memory with its vector embedding.
 *
 * @param {string} userId
 * @param {string} text — the fact/memory to store
 * @returns {object} the created memory record
 */
async function saveMemory(userId, text) {
  if (!text || !text.trim()) return null;

  const content = text.trim();
  console.log(`[Memory] Saving for user ${userId}: "${content.substring(0, 60)}..."`);

  try {
    const embedding = await generateEmbedding(content);
    const vectorStr = `[${embedding.join(",")}]`;

    // Use raw SQL because Prisma doesn't natively handle vector types
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO "Memory" (id, "userId", content, embedding, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3::vector, NOW())
       RETURNING id, "userId", content, "createdAt"`,
      userId,
      content,
      vectorStr
    );

    console.log(`[Memory] Saved memory ${result[0]?.id}`);
    return result[0];
  } catch (error) {
    console.error("[Memory] Save failed:", error.message);
    // Fallback: save without embedding if embedding fails
    try {
      const record = await prisma.memory.create({
        data: { userId, content },
      });
      console.log(`[Memory] Saved without embedding: ${record.id}`);
      return record;
    } catch (innerError) {
      console.error("[Memory] Fallback save failed:", innerError.message);
      return null;
    }
  }
}

/**
 * Recall the most relevant memories using cosine similarity.
 *
 * @param {string} userId
 * @param {string} queryText — the text to search against
 * @param {number} topK — number of results to return
 * @returns {string[]} array of memory content strings
 */
async function recallMemory(userId, queryText, topK = 5) {
  if (!queryText || !queryText.trim()) return [];

  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const vectorStr = `[${queryEmbedding.join(",")}]`;

    // Cosine similarity search using pgvector's <=> operator
    const results = await prisma.$queryRawUnsafe(
      `SELECT id, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM "Memory"
       WHERE "userId" = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      vectorStr,
      userId,
      topK
    );

    const memories = results.map((r) => r.content);
    console.log(`[Memory] Recalled ${memories.length} memories for user ${userId}`);
    return memories;
  } catch (error) {
    console.error("[Memory] Recall failed:", error.message);

    // Fallback: return recent memories without vector search
    try {
      const fallback = await prisma.memory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: topK,
        select: { content: true },
      });
      return fallback.map((m) => m.content);
    } catch {
      return [];
    }
  }
}

/**
 * Extract memorable facts from a conversation using Claude.
 *
 * @param {string} conversationText — the full exchange to analyze
 * @returns {string[]} array of fact strings worth remembering
 */
async function extractFacts(conversationText) {
  if (!conversationText || !conversationText.trim()) return [];

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are a memory extraction engine. Analyze the conversation and extract key facts worth remembering for future sessions.

RULES:
1. Return ONLY a valid JSON array of strings — no explanation, no markdown.
2. Extract facts like: names, preferences, deadlines, locations, relationships, goals, habits, important dates.
3. Each fact should be a concise, self-contained sentence.
4. Only extract facts that are explicitly stated, not inferred.
5. If no memorable facts are found, return an empty array: []
6. Maximum 5 facts per conversation.

EXAMPLES:
Input: "My name is Sarah and I prefer meetings before noon"
Output: ["The user's name is Sarah", "The user prefers meetings before noon"]

Input: "What's the weather like?"
Output: []`,
      messages: [{ role: "user", content: conversationText }],
    });

    const responseText = message.content[0]?.text || "[]";

    try {
      const facts = JSON.parse(responseText);
      if (Array.isArray(facts)) {
        console.log(`[Memory] Extracted ${facts.length} facts`);
        return facts.filter((f) => typeof f === "string" && f.trim());
      }
    } catch {
      console.warn("[Memory] Could not parse facts:", responseText);
    }

    return [];
  } catch (error) {
    console.error("[Memory] Fact extraction failed:", error.message);
    return [];
  }
}

/**
 * Get all memories for a user.
 */
async function getAllMemories(userId) {
  return prisma.memory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, createdAt: true },
  });
}

/**
 * Delete a specific memory.
 */
async function deleteMemory(memoryId) {
  return prisma.memory.delete({ where: { id: memoryId } });
}

/**
 * Delete all memories for a user.
 */
async function clearAllMemories(userId) {
  return prisma.memory.deleteMany({ where: { userId } });
}

/**
 * Ensure a default user exists (for single-user mode).
 */
async function ensureDefaultUser() {
  const DEFAULT_USER_ID = "default-user";
  const existing = await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID } });
  if (!existing) {
    await prisma.user.create({ data: { id: DEFAULT_USER_ID } });
    console.log("[Memory] Created default user");
  }
  return DEFAULT_USER_ID;
}

module.exports = {
  saveMemory,
  recallMemory,
  extractFacts,
  getAllMemories,
  deleteMemory,
  clearAllMemories,
  ensureDefaultUser,
  prisma,
};
