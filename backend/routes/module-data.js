/**
 * Module Data Routes
 *
 * REST endpoints for persistent module data:
 *   /api/tasks, /api/mood-logs, /api/finance-records,
 *   /api/emergency-contacts, /api/documents, /api/module-records,
 *   /api/account (delete all data)
 */

const express = require("express");
const moduleData = require("../services/moduleData");

const router = express.Router();

function userId(req) {
  return req.user?.id;
}

router.use((req, res, next) => {
  if (!userId(req)) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
});

function errorResponse(res, error, status = 400) {
  const message =
    status >= 500
      ? "The request could not be completed right now."
      : error.message || "Invalid request";
  return res.status(status).json({ error: message });
}

// ── Tasks ──

router.get("/tasks", async (req, res) => {
  try {
    const tasks = await moduleData.listTasks(userId(req), {
      status: req.query.status,
      priority: req.query.priority,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, tasks, count: tasks.length });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const task = await moduleData.createTask(userId(req), req.body);
    res.status(201).json({ success: true, task });
  } catch (error) {
    errorResponse(res, error);
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const task = await moduleData.updateTask(userId(req), req.params.id, req.body);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ success: true, task });
  } catch (error) {
    errorResponse(res, error);
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const task = await moduleData.deleteTask(userId(req), req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ success: true, deleted: true });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

// ── Mood Logs ──

router.get("/mood-logs", async (req, res) => {
  try {
    const logs = await moduleData.listMoodLogs(userId(req), req.query.limit ? Number(req.query.limit) : 30);
    res.json({ success: true, logs, count: logs.length });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

router.post("/mood-logs", async (req, res) => {
  try {
    const log = await moduleData.createMoodLog(userId(req), req.body);
    res.status(201).json({ success: true, log });
  } catch (error) {
    errorResponse(res, error);
  }
});

// ── Finance Records ──

router.get("/finance-records", async (req, res) => {
  try {
    const records = await moduleData.listFinanceRecords(userId(req), {
      type: req.query.type,
      category: req.query.category,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, records, count: records.length });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

router.post("/finance-records", async (req, res) => {
  try {
    const record = await moduleData.createFinanceRecord(userId(req), req.body);
    res.status(201).json({ success: true, record });
  } catch (error) {
    errorResponse(res, error);
  }
});

router.patch("/finance-records/:id", async (req, res) => {
  try {
    const record = await moduleData.updateFinanceRecord(userId(req), req.params.id, req.body);
    if (!record) return res.status(404).json({ error: "Finance record not found" });
    res.json({ success: true, record });
  } catch (error) {
    errorResponse(res, error);
  }
});

router.delete("/finance-records/:id", async (req, res) => {
  try {
    const record = await moduleData.deleteFinanceRecord(userId(req), req.params.id);
    if (!record) return res.status(404).json({ error: "Finance record not found" });
    res.json({ success: true, deleted: true });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

// ── Emergency Contacts ──

router.get("/emergency-contacts", async (req, res) => {
  try {
    const contacts = await moduleData.listEmergencyContacts(userId(req));
    res.json({ success: true, contacts, count: contacts.length });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

router.post("/emergency-contacts", async (req, res) => {
  try {
    const contact = await moduleData.createEmergencyContact(userId(req), req.body);
    res.status(201).json({ success: true, contact });
  } catch (error) {
    errorResponse(res, error);
  }
});

router.patch("/emergency-contacts/:id", async (req, res) => {
  try {
    const contact = await moduleData.updateEmergencyContact(userId(req), req.params.id, req.body);
    if (!contact) return res.status(404).json({ error: "Emergency contact not found" });
    res.json({ success: true, contact });
  } catch (error) {
    errorResponse(res, error);
  }
});

router.delete("/emergency-contacts/:id", async (req, res) => {
  try {
    const contact = await moduleData.deleteEmergencyContact(userId(req), req.params.id);
    if (!contact) return res.status(404).json({ error: "Emergency contact not found" });
    res.json({ success: true, deleted: true });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

// ── Generated Documents ──

router.get("/documents", async (req, res) => {
  try {
    const documents = await moduleData.listGeneratedDocuments(userId(req), req.query.type);
    res.json({ success: true, documents, count: documents.length });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

router.post("/documents", async (req, res) => {
  try {
    const document = await moduleData.createGeneratedDocument(userId(req), req.body);
    res.status(201).json({ success: true, document });
  } catch (error) {
    errorResponse(res, error);
  }
});

// ── Module Records (generic) ──

router.get("/module-records", async (req, res) => {
  try {
    const records = await moduleData.listModuleRecords(userId(req), req.query.module);
    res.json({ success: true, records, count: records.length });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

router.post("/module-records", async (req, res) => {
  try {
    const record = await moduleData.createModuleRecord(userId(req), req.body);
    res.status(201).json({ success: true, record });
  } catch (error) {
    errorResponse(res, error);
  }
});

router.patch("/module-records/:id", async (req, res) => {
  try {
    const record = await moduleData.updateModuleRecord(userId(req), req.params.id, req.body);
    if (!record) return res.status(404).json({ error: "Module record not found" });
    res.json({ success: true, record });
  } catch (error) {
    errorResponse(res, error);
  }
});

// ── Delete All Data ──

router.delete("/account", async (req, res) => {
  try {
    await moduleData.deleteAllUserData(userId(req));
    // Clear the auth cookie so the session is fully gone.
    res.clearCookie("nova_auth", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    res.json({ success: true, deleted: true });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

// ── Background Agents ──

router.get("/agents/background", (req, res) => {
  const bgAgent = require("../services/backgroundAgent");
  res.json({
    success: true,
    agents: bgAgent.listAgents(userId(req)),
    pending: bgAgent.listPendingApprovals(userId(req)),
  });
});

router.post("/agents/background/:id/approve", async (req, res) => {
  const bgAgent = require("../services/backgroundAgent");
  const result = await bgAgent.approveAction(req.params.id, userId(req));
  if (!result) return res.status(404).json({ error: "Approval not found or not authorized" });
  res.json({ success: true, ...result });
});

router.patch("/agents/background/:id", (req, res) => {
  const bgAgent = require("../services/backgroundAgent");
  const agent = bgAgent.setAgentEnabled(req.params.id, req.body.enabled, userId(req));
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json({
    success: true,
    agent: { id: agent.id, name: agent.name, enabled: bgAgent.isAgentEnabledForUser(agent.id, userId(req)) },
  });
});

router.post("/agents/background/:id/run", async (req, res) => {
  const bgAgent = require("../services/backgroundAgent");
  try {
    const result = await bgAgent.runAgent(req.params.id, userId(req));
    res.json({ success: true, result });
  } catch (error) {
    errorResponse(res, error, 500);
  }
});

module.exports = router;
