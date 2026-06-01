const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const ai = require("./ai");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://voiceai:voiceai_secret@localhost:5432/voiceai_db";
const LOCAL_DATA_DIR = path.join(__dirname, "..", "data");
const LOCAL_MEMORY_FILE = path.join(LOCAL_DATA_DIR, "memories.json");

let prisma = null;
let pool = null;

function preferLocalMemory() {
  return process.env.VOICEAI_MEMORY_MODE === "local";
}

function ensureLocalStore() {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_MEMORY_FILE)) {
    fs.writeFileSync(LOCAL_MEMORY_FILE, "[]", "utf-8");
  }
}

function readLocalMemories() {
  ensureLocalStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_MEMORY_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalMemories(memories) {
  ensureLocalStore();
  fs.writeFileSync(LOCAL_MEMORY_FILE, JSON.stringify(memories, null, 2), "utf-8");
}

function getPrisma() {
  if (preferLocalMemory()) {
    throw new Error("Local memory mode enabled.");
  }
  if (prisma) return prisma;

  pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
  return prisma;
}

async function ensureUser(userId) {
  const client = getPrisma();
  await client.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
}

async function generateEmbedding(text) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate memory embeddings.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text.slice(0, 24000),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embedding request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length !== 1536) {
    throw new Error("OpenAI did not return a 1536-dimension embedding.");
  }

  return embedding;
}

function toVectorLiteral(embedding) {
  return `[${embedding.join(",")}]`;
}

function keywordScore(queryText, content) {
  const words = queryText
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 2);
  const lower = content.toLowerCase();
  return words.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
}

async function saveMemoryLocal(userId, text) {
  const content = text?.trim();
  if (!content) return null;

  const memories = readLocalMemories();
  const memory = {
    id: randomUUID(),
    userId,
    content,
    createdAt: new Date().toISOString(),
    storage: "local",
  };
  memories.unshift(memory);
  writeLocalMemories(memories.slice(0, 1000));
  return memory;
}

async function recallMemoryLocal(userId, queryText, topK = 5) {
  const limit = Math.max(1, Math.min(Number(topK) || 5, 20));
  return readLocalMemories()
    .filter((memory) => memory.userId === userId)
    .map((memory) => ({
      ...memory,
      score: keywordScore(queryText, memory.content),
    }))
    .filter((memory) => memory.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map((memory) => memory.content);
}

async function saveMemory(userId, text) {
  const content = text?.trim();
  if (!userId) throw new Error("saveMemory requires a userId.");
  if (!content) return null;

  try {
    await ensureUser(userId);

    const id = randomUUID();
    const embedding = await generateEmbedding(content);
    const vector = toVectorLiteral(embedding);
    const client = getPrisma();

    const rows = await client.$queryRawUnsafe(
      `INSERT INTO "Memory" ("id", "userId", "content", "embedding", "createdAt")
       VALUES ($1, $2, $3, $4::vector, NOW())
       RETURNING "id", "userId", "content", "createdAt"`,
      id,
      userId,
      content,
      vector
    );

    return rows[0] || null;
  } catch (error) {
    console.warn("[Memory] Falling back to local save:", error.message);
    return saveMemoryLocal(userId, content);
  }
}

async function recallMemory(userId, queryText, topK = 5) {
  const cleanQuery = queryText?.trim();
  if (!userId || !cleanQuery) return [];

  try {
    const embedding = await generateEmbedding(cleanQuery);
    const vector = toVectorLiteral(embedding);
    const limit = Math.max(1, Math.min(Number(topK) || 5, 20));
    const client = getPrisma();

    const rows = await client.$queryRawUnsafe(
      `SELECT "content"
       FROM "Memory"
       WHERE "userId" = $1
       ORDER BY "embedding" <=> $2::vector
       LIMIT $3`,
      userId,
      vector,
      limit
    );

    return rows.map((row) => row.content);
  } catch (error) {
    console.warn("[Memory] Falling back to local recall:", error.message);
    return recallMemoryLocal(userId, cleanQuery, topK);
  }
}

async function extractFacts(conversationText) {
  const cleanConversation = conversationText?.trim();
  if (!cleanConversation) return [];

  if (!ai.isAvailable()) {
    return [];
  }

  const systemPrompt = `You extract durable user memories from conversations.

Return ONLY a JSON array of strings.
Remember facts such as names, preferences, deadlines, recurring tasks, long-term goals, important people, important places, and stable project context.
Do not remember one-off small talk, temporary UI state, secrets, passwords, API keys, or payment data.
Only include facts explicitly stated by the user.
If there is nothing worth remembering, return [].
Keep each memory concise and self-contained.
Return at most 5 memories.`;

  try {
    const facts = await ai.chatJSON(systemPrompt, cleanConversation);
    if (Array.isArray(facts)) {
      return facts.filter((fact) => typeof fact === "string" && fact.trim());
    }
    return [];
  } catch (err) {
    console.warn("[Memory] Fact extraction failed:", err.message);
    return [];
  }
}

async function getAllMemories(userId) {
  try {
    const client = getPrisma();
    return client.memory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, userId: true, content: true, createdAt: true },
    });
  } catch (error) {
    console.warn("[Memory] Falling back to local list:", error.message);
    return readLocalMemories()
      .filter((memory) => memory.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

async function deleteMemory(userId, memoryId) {
  try {
    const client = getPrisma();
    return client.memory.deleteMany({ where: { id: memoryId, userId } });
  } catch (error) {
    console.warn("[Memory] Falling back to local delete:", error.message);
    const memories = readLocalMemories();
    const next = memories.filter(
      (memory) => !(memory.id === memoryId && memory.userId === userId)
    );
    writeLocalMemories(next);
    return { count: memories.length - next.length };
  }
}

async function clearAllMemories(userId) {
  try {
    const client = getPrisma();
    return client.memory.deleteMany({ where: { userId } });
  } catch (error) {
    console.warn("[Memory] Falling back to local clear:", error.message);
    const memories = readLocalMemories();
    const next = memories.filter((memory) => memory.userId !== userId);
    writeLocalMemories(next);
    return { count: memories.length - next.length };
  }
}

async function ensureDefaultUser() {
  const userId = "default-user";
  try {
    await ensureUser(userId);
  } catch (error) {
    console.warn("[Memory] Default user using local store:", error.message);
    ensureLocalStore();
  }
  return userId;
}

function getMemoryStatus() {
  return {
    mode: preferLocalMemory() ? "local" : "postgres_with_local_fallback",
    local_file: LOCAL_MEMORY_FILE,
    embeddings_configured: Boolean(process.env.OPENAI_API_KEY),
    database_configured: Boolean(DATABASE_URL),
  };
}

module.exports = {
  saveMemory,
  recallMemory,
  extractFacts,
  getAllMemories,
  deleteMemory,
  clearAllMemories,
  ensureDefaultUser,
  getMemoryStatus,
  prisma,
};
