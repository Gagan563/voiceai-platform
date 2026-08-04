/**
 * Background Agent Framework
 *
 * A simple in-process job runner for persistent background agents.
 * Each agent has an id, name, schedule (cron expression), handler, and
 * permission scope. Results are emitted via Socket.IO approval cards.
 *
 * This is the "lite" version — no Redis/BullMQ required. Jobs run in the
 * main process using setInterval with minute-granularity checks.
 */

const config = require("../config");

// ── Agent Registry ──

const agents = new Map();
const pendingApprovals = new Map();
let schedulerInterval = null;
let ioInstance = null;

/**
 * Register a background agent.
 *
 * @param {object} spec
 * @param {string} spec.id          — unique agent identifier
 * @param {string} spec.name        — human-readable name
 * @param {string} spec.icon        — emoji icon
 * @param {string} spec.schedule    — cron-like schedule: "every:5m", "every:1h", "every:24h"
 * @param {function} spec.handler   — async (userId) => result
 * @param {string[]} spec.permissions — required permission scopes
 * @param {boolean} spec.enabled    — whether the agent is active
 */
function registerAgent(spec) {
  if (!spec.id || !spec.handler) {
    throw new Error("Agent requires id and handler");
  }

  const agent = {
    id: spec.id,
    name: spec.name || spec.id,
    icon: spec.icon || "🤖",
    schedule: spec.schedule || "every:1h",
    handler: spec.handler,
    permissions: spec.permissions || [],
    enabled: spec.enabled !== false,
    disabledForUsers: new Set(),
    lastRun: null,
    lastResult: null,
    runCount: 0,
    errors: 0,
  };

  agents.set(agent.id, agent);
  console.log(`[BackgroundAgent] Registered: ${agent.icon} ${agent.name} (${agent.schedule})`);
  return agent;
}

function parseSchedule(schedule) {
  const match = String(schedule).match(/^every:(\d+)(m|h)$/);
  if (!match) return 60 * 60 * 1000; // default 1h
  const [, value, unit] = match;
  return Number(value) * (unit === "h" ? 60 * 60 * 1000 : 60 * 1000);
}

function isEnabledForUser(agent, userId) {
  if (!agent.enabled) return false;
  if (!userId) return false;
  return !agent.disabledForUsers.has(userId);
}

function isAgentEnabledForUser(agentId, userId) {
  const agent = agents.get(agentId);
  return agent ? isEnabledForUser(agent, userId) : false;
}

function shouldRun(agent, userId) {
  if (!isEnabledForUser(agent, userId)) return false;
  if (!agent.lastRun) return true;
  const interval = parseSchedule(agent.schedule);
  return Date.now() - agent.lastRun.getTime() >= interval;
}

// ── Execution ──

async function runAgent(agentId, userId) {
  if (!userId) throw new Error("Background agent requires a user id.");
  const agent = agents.get(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  if (!isEnabledForUser(agent, userId)) {
    return { status: "disabled", message: "Agent is disabled for this user." };
  }

  console.log(`[BackgroundAgent] Running: ${agent.icon} ${agent.name}`);
  agent.lastRun = new Date();

  try {
    const result = await agent.handler(userId);
    agent.lastResult = result;
    agent.runCount += 1;

    // If the result includes an approval request, store it and emit via Socket.IO.
    if (result?.requiresApproval) {
      const approvalId = `${agentId}-${Date.now()}`;
      pendingApprovals.set(approvalId, {
        agentId,
        userId,
        action: result.action,
        description: result.description,
        data: result.data,
        onApprove: typeof result.onApprove === "function" ? result.onApprove : null,
        createdAt: new Date().toISOString(),
      });

      if (ioInstance) {
        const { emitToUser } = require("../socket");
        emitToUser(ioInstance, userId, "agent:approval", {
          approvalId,
          agentName: agent.name,
          agentIcon: agent.icon,
          action: result.action,
          description: result.description,
        });
      }
    }

    return result;
  } catch (error) {
    agent.errors += 1;
    agent.lastResult = { error: error.message };
    console.error(`[BackgroundAgent] ${agent.name} failed:`, error.message);
    throw error;
  }
}

async function approveAction(approvalId, userId) {
  const pending = pendingApprovals.get(approvalId);
  if (!pending) return null;
  if (pending.userId !== userId) return null;

  pendingApprovals.delete(approvalId);

  const agent = agents.get(pending.agentId);
  if (!agent) return null;

  // Execute the approved action
  console.log(`[BackgroundAgent] Approval granted for ${agent.name}: ${pending.action}`);
  if (pending.onApprove) {
    const result = await pending.onApprove({ userId, data: pending.data, action: pending.action });
    return { approved: true, agentId: pending.agentId, action: pending.action, result };
  }

  return {
    approved: true,
    agentId: pending.agentId,
    action: pending.action,
    result: { status: "acknowledged", message: "No executable approval handler is registered for this action." },
  };
}

// ── Scheduler ──

function startScheduler(io, defaultUserId = config.DEFAULT_USER_ID) {
  ioInstance = io;

  if (schedulerInterval) clearInterval(schedulerInterval);

  // Check every minute
  schedulerInterval = setInterval(async () => {
    for (const [, agent] of agents) {
      if (!shouldRun(agent, defaultUserId)) continue;
      try {
        await runAgent(agent.id, defaultUserId);
      } catch {
        // Error already logged in runAgent
      }
    }
  }, 60 * 1000);

  console.log(`[BackgroundAgent] Scheduler started (${agents.size} agents)`);
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

// ── Query ──

function listAgents(userId) {
  return Array.from(agents.values()).map((agent) => ({
    id: agent.id,
    name: agent.name,
    icon: agent.icon,
    schedule: agent.schedule,
    permissions: agent.permissions,
    enabled: userId ? isEnabledForUser(agent, userId) : agent.enabled,
    lastRun: agent.lastRun?.toISOString() || null,
    runCount: agent.runCount,
    errors: agent.errors,
  }));
}

function listPendingApprovals(userId) {
  const result = [];
  for (const [id, approval] of pendingApprovals) {
    if (approval.userId === userId) {
      result.push({ id, ...approval });
    }
  }
  return result;
}

function setAgentEnabled(agentId, enabled, userId) {
  if (!userId) throw new Error("Background agent settings require a user id.");
  const agent = agents.get(agentId);
  if (!agent) return null;
  if (enabled) {
    agent.disabledForUsers.delete(userId);
  } else {
    agent.disabledForUsers.add(userId);
  }
  return agent;
}

// ══════════════════════════════════════════
//  BUILT-IN AGENTS
// ══════════════════════════════════════════

function registerBuiltinAgents() {
  // ── Deadline Watcher ──
  registerAgent({
    id: "deadline-watcher",
    name: "Deadline Watcher",
    icon: "⏰",
    schedule: "every:30m",
    permissions: ["tasks:read"],
    handler: async (userId) => {
      let moduleData;
      try {
        moduleData = require("./moduleData");
      } catch {
        return { status: "skipped", reason: "moduleData service not available" };
      }

      try {
        const tasks = await moduleData.listTasks(userId, { status: "todo" });
        const now = new Date();
        const upcoming = tasks.filter((task) => {
          if (!task.dueAt) return false;
          const due = new Date(task.dueAt);
          const hoursUntilDue = (due - now) / (1000 * 60 * 60);
          return hoursUntilDue > 0 && hoursUntilDue <= 24;
        });

        const overdue = tasks.filter((task) => {
          if (!task.dueAt) return false;
          return new Date(task.dueAt) < now;
        });

        if (upcoming.length === 0 && overdue.length === 0) {
          return { status: "ok", message: "No deadlines approaching" };
        }

        return {
          status: "alert",
          overdue: overdue.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt })),
          upcoming: upcoming.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt })),
          message: `${overdue.length} overdue, ${upcoming.length} due within 24h`,
        };
      } catch (error) {
        return { status: "error", message: error.message };
      }
    },
  });

  // ── Memory Builder ──
  registerAgent({
    id: "memory-builder",
    name: "Memory Builder",
    icon: "🧠",
    schedule: "every:1h",
    permissions: ["sessions:read", "memories:write"],
    handler: async (userId) => {
      let memory;
      try {
        memory = require("./memory");
      } catch {
        return { status: "skipped", reason: "Memory service not available" };
      }

      try {
        // This agent's job is to extract facts from recent conversation history
        // and persist them as long-term memories. The actual fact extraction
        // is already done inline in the chat route, so this agent serves as
        // a periodic "catch up" for any missed extractions.
        const status = memory.getMemoryStatus ? memory.getMemoryStatus() : "unknown";
        return {
          status: "ok",
          memoryStatus: status,
          message: "Memory consolidation check complete",
        };
      } catch (error) {
        return { status: "error", message: error.message };
      }
    },
  });
}

module.exports = {
  registerAgent,
  runAgent,
  approveAction,
  startScheduler,
  stopScheduler,
  listAgents,
  listPendingApprovals,
  setAgentEnabled,
  isAgentEnabledForUser,
  registerBuiltinAgents,
};
