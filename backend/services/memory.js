const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const ai = require("./ai");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://voiceai:voiceai_secret@localhost:5432/voiceai_db";

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function ensureUser(userId) {
  await prisma.user.upsert({
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

async function saveMemory(userId, text) {
  const content = text?.trim();
  if (!userId) throw new Error("saveMemory requires a userId.");
  if (!content) return null;

  await ensureUser(userId);

  const id = randomUUID();
  const embedding = await generateEmbedding(content);
  const vector = toVectorLiteral(embedding);

  const rows = await prisma.$queryRawUnsafe(
    `INSERT INTO "Memory" ("id", "userId", "content", "embedding", "createdAt")
     VALUES ($1, $2, $3, $4::vector, NOW())
     RETURNING "id", "userId", "content", "createdAt"`,
    id,
    userId,
    content,
    vector
  );

  return rows[0] || null;
}

async function recallMemory(userId, queryText, topK = 5) {
  const cleanQuery = queryText?.trim();
  if (!userId || !cleanQuery) return [];

  const embedding = await generateEmbedding(cleanQuery);
  const vector = toVectorLiteral(embedding);
  const limit = Math.max(1, Math.min(Number(topK) || 5, 20));

  const rows = await prisma.$queryRawUnsafe(
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
}

async function extractFacts(conversationText) {
  const cleanConversation = conversationText?.trim();
  if (!cleanConversation) return [];

  if (!ai.isAvailable()) {
    console.warn("[Memory] No AI key — skipping fact extraction");
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
      return facts.filter((f) => typeof f === "string" && f.trim());
    }
    return [];
  } catch (err) {
    console.warn("[Memory] Fact extraction failed:", err.message);
    return [];
  }
}


async function getAllMemories(userId) {
  return prisma.memory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, content: true, createdAt: true },
  });
}

async function deleteMemory(userId, memoryId) {
  return prisma.memory.deleteMany({
    where: { id: memoryId, userId },
  });
}

async function clearAllMemories(userId) {
  return prisma.memory.deleteMany({ where: { userId } });
}

async function ensureDefaultUser() {
  const userId = "default-user";
  await ensureUser(userId);
  return userId;
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
