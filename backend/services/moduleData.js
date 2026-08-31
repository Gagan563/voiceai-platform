/**
 * Module Data Service
 *
 * CRUD operations for persistent module data models:
 *   Task, MoodLog, FinanceRecord, EmergencyContact, GeneratedDocument, ModuleRecord
 *
 * Each function expects a userId (from req.user.id) and returns plain objects.
 * Prisma is lazily initialised so the server boots even without a database.
 */

let prisma = null;
let pool = null;

function db() {
  if (prisma) return prisma;
  try {
    const { PrismaClient } = require("@prisma/client");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const { Pool } = require("pg");
    const config = require("../config");

    pool = new Pool({ connectionString: config.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
    return prisma;
  } catch {
    return null;
  }
}

function requireDb() {
  const client = db();
  if (!client) throw new Error("Database is not available. Configure DATABASE_URL and run prisma migrate.");
  return client;
}

function requireUserId(userId) {
  if (!userId) throw new Error("Authenticated user is required.");
  return userId;
}

// ══════════════════════════════════════════
//  TASKS
// ══════════════════════════════════════════

async function listTasks(userId, filters = {}) {
  userId = requireUserId(userId);
  const where = { userId };
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  return requireDb().task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filters.limit || 100,
  });
}

async function createTask(userId, data) {
  userId = requireUserId(userId);
  return requireDb().task.create({
    data: {
      userId,
      title: data.title,
      description: data.description || null,
      status: data.status || "todo",
      priority: data.priority || "medium",
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      tags: data.tags || null,
    },
  });
}

async function updateTask(userId, taskId, data) {
  userId = requireUserId(userId);
  const task = await requireDb().task.findFirst({ where: { id: taskId, userId } });
  if (!task) return null;

  const update = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.status !== undefined) {
    update.status = data.status;
    update.completedAt = data.status === "done" ? new Date() : null;
  }
  if (data.priority !== undefined) update.priority = data.priority;
  if (data.dueAt !== undefined) update.dueAt = data.dueAt ? new Date(data.dueAt) : null;
  if (data.tags !== undefined) update.tags = data.tags;

  return requireDb().task.update({ where: { id: taskId }, data: update });
}

async function deleteTask(userId, taskId) {
  userId = requireUserId(userId);
  const task = await requireDb().task.findFirst({ where: { id: taskId, userId } });
  if (!task) return null;
  return requireDb().task.delete({ where: { id: taskId } });
}

// ══════════════════════════════════════════
//  MOOD LOGS
// ══════════════════════════════════════════

async function listMoodLogs(userId, limit = 30) {
  userId = requireUserId(userId);
  return requireDb().moodLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

async function createMoodLog(userId, data) {
  userId = requireUserId(userId);
  const mood = Number(data.mood);
  if (!Number.isFinite(mood) || mood < 1 || mood > 10) {
    throw new Error("Mood must be between 1 and 10");
  }
  return requireDb().moodLog.create({
    data: {
      userId,
      mood,
      note: data.note || null,
      metrics: data.metrics || null,
    },
  });
}

// ══════════════════════════════════════════
//  FINANCE RECORDS
// ══════════════════════════════════════════

async function listFinanceRecords(userId, filters = {}) {
  userId = requireUserId(userId);
  const where = { userId };
  if (filters.type) where.type = filters.type;
  if (filters.category) where.category = filters.category;
  return requireDb().financeRecord.findMany({
    where,
    orderBy: { date: "desc" },
    take: filters.limit || 100,
  });
}

async function createFinanceRecord(userId, data) {
  userId = requireUserId(userId);
  const amount = Number(data.amount);
  if (!Number.isFinite(amount)) throw new Error("Amount must be a number");
  if (!data.type || !["income", "expense"].includes(data.type)) {
    throw new Error("Type must be 'income' or 'expense'");
  }
  return requireDb().financeRecord.create({
    data: {
      userId,
      type: data.type,
      amount,
      currency: data.currency || "USD",
      category: data.category || null,
      description: data.description || null,
      date: data.date ? new Date(data.date) : new Date(),
      recurring: Boolean(data.recurring),
      metadata: data.metadata || null,
    },
  });
}

async function updateFinanceRecord(userId, recordId, data) {
  userId = requireUserId(userId);
  const record = await requireDb().financeRecord.findFirst({ where: { id: recordId, userId } });
  if (!record) return null;

  const update = {};
  if (data.type !== undefined) update.type = data.type;
  if (data.amount !== undefined) update.amount = Number(data.amount);
  if (data.currency !== undefined) update.currency = data.currency;
  if (data.category !== undefined) update.category = data.category;
  if (data.description !== undefined) update.description = data.description;
  if (data.date !== undefined) update.date = new Date(data.date);
  if (data.recurring !== undefined) update.recurring = Boolean(data.recurring);
  if (data.metadata !== undefined) update.metadata = data.metadata;

  return requireDb().financeRecord.update({ where: { id: recordId }, data: update });
}

async function deleteFinanceRecord(userId, recordId) {
  userId = requireUserId(userId);
  const record = await requireDb().financeRecord.findFirst({ where: { id: recordId, userId } });
  if (!record) return null;
  return requireDb().financeRecord.delete({ where: { id: recordId } });
}

// ══════════════════════════════════════════
//  EMERGENCY CONTACTS
// ══════════════════════════════════════════

async function listEmergencyContacts(userId) {
  userId = requireUserId(userId);
  return requireDb().emergencyContact.findMany({
    where: { userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

async function createEmergencyContact(userId, data) {
  userId = requireUserId(userId);
  if (!data.name || !data.phone) throw new Error("Name and phone are required");
  return requireDb().emergencyContact.create({
    data: {
      userId,
      name: data.name,
      phone: data.phone,
      relationship: data.relationship || null,
      isPrimary: Boolean(data.isPrimary),
    },
  });
}

async function updateEmergencyContact(userId, contactId, data) {
  userId = requireUserId(userId);
  const contact = await requireDb().emergencyContact.findFirst({ where: { id: contactId, userId } });
  if (!contact) return null;

  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.relationship !== undefined) update.relationship = data.relationship;
  if (data.isPrimary !== undefined) update.isPrimary = Boolean(data.isPrimary);

  return requireDb().emergencyContact.update({ where: { id: contactId }, data: update });
}

async function deleteEmergencyContact(userId, contactId) {
  userId = requireUserId(userId);
  const contact = await requireDb().emergencyContact.findFirst({ where: { id: contactId, userId } });
  if (!contact) return null;
  return requireDb().emergencyContact.delete({ where: { id: contactId } });
}

// ══════════════════════════════════════════
//  GENERATED DOCUMENTS
// ══════════════════════════════════════════

async function listGeneratedDocuments(userId, type = null) {
  userId = requireUserId(userId);
  const where = { userId };
  if (type) where.type = type;
  return requireDb().generatedDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

async function createGeneratedDocument(userId, data) {
  userId = requireUserId(userId);
  if (!data.title || !data.content) throw new Error("Title and content are required");
  return requireDb().generatedDocument.create({
    data: {
      userId,
      type: data.type || "report",
      title: data.title,
      content: data.content,
      country: data.country || null,
      language: data.language || "en",
      metadata: data.metadata || null,
    },
  });
}

// ══════════════════════════════════════════
//  MODULE RECORDS (generic per-module store)
// ══════════════════════════════════════════

async function listModuleRecords(userId, module = null) {
  userId = requireUserId(userId);
  const where = { userId };
  if (module) where.module = module;
  return requireDb().moduleRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

async function createModuleRecord(userId, data) {
  userId = requireUserId(userId);
  return requireDb().moduleRecord.create({
    data: {
      userId,
      module: data.module || "chat",
      title: data.title || "Untitled",
      data: data.data || null,
      status: data.status || "active",
    },
  });
}

async function updateModuleRecord(userId, recordId, data) {
  userId = requireUserId(userId);
  const record = await requireDb().moduleRecord.findFirst({ where: { id: recordId, userId } });
  if (!record) return null;

  const update = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.data !== undefined) update.data = data.data;
  if (data.status !== undefined) update.status = data.status;

  return requireDb().moduleRecord.update({ where: { id: recordId }, data: update });
}

// ══════════════════════════════════════════
//  DELETE ALL USER DATA (cascading)
// ══════════════════════════════════════════

async function deleteAllUserData(userId) {
  userId = requireUserId(userId);
  const client = requireDb();
  // Prisma cascade handles children, but we explicitly delete each model
  // to ensure no orphans if cascade rules change.
  await client.$transaction([
    client.moodLog.deleteMany({ where: { userId } }),
    client.financeRecord.deleteMany({ where: { userId } }),
    client.emergencyContact.deleteMany({ where: { userId } }),
    client.generatedDocument.deleteMany({ where: { userId } }),
    client.moduleRecord.deleteMany({ where: { userId } }),
    client.task.deleteMany({ where: { userId } }),
    client.message.deleteMany({ where: { session: { userId } } }),
    client.memory.deleteMany({ where: { userId } }),
    client.session.deleteMany({ where: { userId } }),
    client.user.deleteMany({ where: { id: userId } }),
  ]);
  return true;
}

module.exports = {
  // Tasks
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  // Mood
  listMoodLogs,
  createMoodLog,
  // Finance
  listFinanceRecords,
  createFinanceRecord,
  updateFinanceRecord,
  deleteFinanceRecord,
  // Emergency
  listEmergencyContacts,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  // Documents
  listGeneratedDocuments,
  createGeneratedDocument,
  // Module Records
  listModuleRecords,
  createModuleRecord,
  updateModuleRecord,
  // Account
  deleteAllUserData,
};
