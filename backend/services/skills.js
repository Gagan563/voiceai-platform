// ============================================
// VoiceAI Platform — Skill Registry & Framework
// ============================================
//
// Replaces the monolithic IntentParser-does-everything model with
// a pluggable skill framework. Each domain (calendar, email,
// shopping, smart home, finance) is a self-contained module with
// its own auth, plan template, and RISK LEVEL.
//
// Skill handlers now call through real MCP connectors instead of
// returning static placeholder text.

const path = require("path");
const fs = require("fs");
const { callConnector } = require("./mcp");

// ── Risk Levels ──

const RISK_LEVELS = {
  LOW: "low",       // One-tap approval or auto-approve
  MEDIUM: "medium", // Full plan shown before execution
  HIGH: "high",     // Explicit double-confirmation required
};

// ── Skill Registry ──

class SkillRegistry {
  constructor() {
    /** @type {Map<string, Skill>} */
    this.skills = new Map();
    this.loadOrder = [];
  }

  /**
   * Register a skill in the registry.
   * @param {Skill} skill
   */
  register(skill) {
    if (!skill.id || !skill.name || !skill.riskLevel) {
      throw new Error(`Skill registration failed: missing required fields (id, name, riskLevel). Got: ${JSON.stringify({ id: skill.id, name: skill.name })}`);
    }

    if (!Object.values(RISK_LEVELS).includes(skill.riskLevel)) {
      throw new Error(`Invalid risk level "${skill.riskLevel}" for skill "${skill.id}". Must be one of: ${Object.values(RISK_LEVELS).join(", ")}`);
    }

    this.skills.set(skill.id, skill);
    this.loadOrder.push(skill.id);
    console.log(`[Skills] Registered: ${skill.name} (${skill.id}) — risk: ${skill.riskLevel}`);
  }

  /**
   * Get a skill by ID.
   * @param {string} id
   * @returns {Skill|undefined}
   */
  get(id) {
    return this.skills.get(id);
  }

  /**
   * Find the best skill to handle a given module + action_type from intent.
   * @param {string} module — The module from intent extraction
   * @param {string} actionType — The action_type from intent extraction
   * @returns {Skill|null}
   */
  resolve(module, actionType) {
    // First try exact module match
    for (const skill of this.skills.values()) {
      if (skill.modules?.includes(module)) {
        return skill;
      }
    }

    // Fallback: try action type match
    for (const skill of this.skills.values()) {
      if (skill.actions?.includes(actionType)) {
        return skill;
      }
    }

    return null;
  }

  /**
   * List all registered skills with their metadata.
   * @returns {Array<{ id, name, description, riskLevel, modules, actions, configured }>}
   */
  listAll() {
    return Array.from(this.skills.values()).map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description || "",
      icon: skill.icon || "⚙️",
      riskLevel: skill.riskLevel,
      modules: skill.modules || [],
      actions: skill.actions || [],
      configured: typeof skill.isConfigured === "function" ? skill.isConfigured() : true,
      buildPriority: skill.buildPriority || 99,
    }));
  }

  /**
   * List skills in recommended build order.
   * @returns {Array}
   */
  listByBuildOrder() {
    return this.listAll().sort((a, b) => a.buildPriority - b.buildPriority);
  }

  /**
   * Get the risk level for a given skill ID.
   * @param {string} skillId
   * @returns {string} "low" | "medium" | "high"
   */
  getRiskLevel(skillId) {
    const skill = this.skills.get(skillId);
    return skill ? skill.riskLevel : RISK_LEVELS.MEDIUM;
  }

  /**
   * Check if a skill requires double confirmation.
   * @param {string} skillId
   * @returns {boolean}
   */
  requiresDoubleConfirm(skillId) {
    const skill = this.skills.get(skillId);
    return skill ? skill.riskLevel === RISK_LEVELS.HIGH : false;
  }

  /**
   * Execute a skill's handler.
   * @param {string} skillId
   * @param {object} intent — Structured intent from the extraction
   * @param {object} context — Additional context (userId, memories, etc.)
   * @returns {Promise<object>}
   */
  async execute(skillId, intent, context = {}) {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return { success: false, error: `Skill "${skillId}" not found` };
    }

    if (typeof skill.handler !== "function") {
      return { success: false, error: `Skill "${skillId}" has no handler` };
    }

    try {
      return await skill.handler(intent, context);
    } catch (error) {
      console.error(`[Skills] Execution error in "${skillId}":`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-discover and load skills from the skills directory.
   * @param {string} skillsDir — Absolute path to the skills directory
   */
  loadFromDirectory(skillsDir) {
    if (!fs.existsSync(skillsDir)) {
      console.log(`[Skills] Skills directory not found: ${skillsDir}`);
      return;
    }

    const files = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".js"));

    for (const file of files) {
      try {
        const skillModule = require(path.join(skillsDir, file));

        if (skillModule && skillModule.skill) {
          this.register(skillModule.skill);
        } else if (typeof skillModule === "object" && skillModule.id) {
          this.register(skillModule);
        }
      } catch (error) {
        console.warn(`[Skills] Failed to load skill from ${file}:`, error.message);
      }
    }
  }
}

// ── Skill Base Class / Factory ──

/**
 * Create a skill definition object.
 * @param {object} config
 * @returns {Skill}
 */
function createSkill({
  id,
  name,
  description = "",
  icon = "⚙️",
  riskLevel = RISK_LEVELS.MEDIUM,
  modules = [],
  actions = [],
  buildPriority = 99,
  isConfigured = () => true,
  planTemplate = null,
  handler = null,
}) {
  return {
    id,
    name,
    description,
    icon,
    riskLevel,
    modules,
    actions,
    buildPriority,
    isConfigured,
    planTemplate,
    handler,
  };
}

// ── Global Registry Singleton ──

const registry = new SkillRegistry();

// ── Register Built-in Skills ──

// 1. Answering & Search (Priority 1 — LOW risk)
registry.register(
  createSkill({
    id: "search",
    name: "Answering & Search",
    description: "Web search, Q&A, factual queries, calculations, general knowledge",
    icon: "🔍",
    riskLevel: RISK_LEVELS.LOW,
    modules: ["chat", "search"],
    actions: ["answer", "search"],
    buildPriority: 1,
    handler: async (intent, context) => {
      const query = intent.goal || intent.entities?.topic || "general search";

      // Call real web_search connector (DuckDuckGo free, Brave if configured)
      const searchResult = await callConnector({
        connectorId: "web_search",
        action: "search",
        params: { query, limit: 5 },
      });

      if (searchResult.success) {
        const results = searchResult.results || [];
        const summary = results.length > 0
          ? results.map((r, i) => `${i + 1}. **${r.title}** — ${r.snippet || ""}${r.url ? ` (${r.url})` : ""}`).join("\n")
          : "No results found for that query.";

        return {
          success: true,
          result: {
            type: "search",
            content: summary,
            sources: results,
            engine: searchResult.engine || "web_search",
            spoken_response: intent.spoken_response || `I found ${results.length} result${results.length === 1 ? "" : "s"} for "${query}".`,
          },
        };
      }

      // Fallback: return the AI's spoken response
      return {
        success: true,
        result: {
          type: "answer",
          content: intent.spoken_response || `I'll help you with: ${query}`,
          spoken_response: intent.spoken_response,
        },
      };
    },
  })
);

// 2. Scheduling (Priority 2 — MEDIUM risk)
registry.register(
  createSkill({
    id: "schedule",
    name: "Scheduling",
    description: "Calendar events, meetings, reminders, time-based tasks",
    icon: "📅",
    riskLevel: RISK_LEVELS.MEDIUM,
    modules: ["task"],
    actions: ["schedule", "remind"],
    buildPriority: 2,
    isConfigured: () =>
      Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN),
    handler: async (intent, context) => {
      const entities = intent.entities || {};
      const actionType = intent.action_type || "schedule";

      // List events
      if (/list|show|what('s| is)|upcoming|today|this week/i.test(intent.goal || "")) {
        const result = await callConnector({
          connectorId: "calendar",
          action: "list_events",
          params: {
            date_range_start: entities.time || new Date().toISOString(),
            date_range_end: entities.time
              ? new Date(new Date(entities.time).getTime() + 7 * 86400000).toISOString()
              : new Date(Date.now() + 7 * 86400000).toISOString(),
          },
        });

        if (result.success) {
          const events = result.events || [];
          const eventList = events.length > 0
            ? events.map((e) => `• **${e.summary}** — ${e.start}`).join("\n")
            : "No upcoming events found.";

          return {
            success: true,
            result: {
              type: "calendar_list",
              content: eventList,
              events,
              spoken_response: events.length > 0
                ? `You have ${events.length} upcoming event${events.length === 1 ? "" : "s"}.`
                : "Your calendar looks clear.",
            },
          };
        }

        return { success: true, result: { type: "schedule", content: result.error || "Could not access calendar.", requiresApproval: false } };
      }

      // Create event — use the user's timezone from context, not the server's
      const result = await callConnector({
        connectorId: "calendar",
        action: "create_event",
        params: {
          title: intent.goal || "Meeting",
          datetime: entities.time || null,
          duration_minutes: 30,
          attendees: entities.person ? [entities.person] : [],
          timezone: context.timezone || entities.location || null,
        },
      });

      if (result.success && result.event) {
        return {
          success: true,
          result: {
            type: "calendar_create",
            content: `Created event: **${result.event.summary}**${result.event.link ? ` — [Open in Calendar](${result.event.link})` : ""}`,
            event: result.event,
            spoken_response: `Done, I've scheduled "${result.event.summary}" on your calendar.`,
          },
        };
      }

      // If demo mode, still return useful info
      if (result.status === "demo") {
        return {
          success: true,
          result: {
            type: "schedule",
            content: `Scheduled (demo): ${intent.goal}. Connect Google Calendar in Settings to create real events.`,
            demo: true,
            requiresApproval: true,
            spoken_response: `I've prepared the schedule for "${intent.goal}". Connect Google Calendar to make it real.`,
          },
        };
      }

      return {
        success: true,
        result: {
          type: "schedule",
          content: result.error || `Scheduling task: ${intent.goal}`,
          requiresApproval: true,
        },
      };
    },
  })
);

// 3. Communication (Priority 3 — HIGH risk)
// NOTE: This skill does NOT claim the "write" module to avoid hijacking
// document/essay/code requests. It matches only via action types.
registry.register(
  createSkill({
    id: "communicate",
    name: "Communication",
    description: "Email, messaging, contacting people on user's behalf",
    icon: "✉️",
    riskLevel: RISK_LEVELS.HIGH,
    modules: [],
    actions: ["message", "email"],
    buildPriority: 3,
    isConfigured: () =>
      Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN),
    handler: async (intent, context) => {
      const entities = intent.entities || {};
      const goal = (intent.goal || "").toLowerCase();

      // ── Read inbox — returns immediately, never falls through to send ──
      if (/\b(read|check|inbox|unread)\b/i.test(goal) || /\blatest\s+(email|mail)s?\b/i.test(goal)) {
        const result = await callConnector({
          connectorId: "email",
          action: "read_inbox",
          params: { limit: 10 },
        });

        const messages = (result.success && result.messages) || [];
        const emailList = messages.length > 0
          ? messages.map((m) => `• **${m.subject}** from ${m.from} — ${m.snippet || ""}`).join("\n")
          : "Your inbox is empty.";

        return {
          success: true,
          result: {
            type: "email_inbox",
            content: emailList,
            messages,
            spoken_response: messages.length > 0
              ? `You have ${messages.length} recent message${messages.length === 1 ? "" : "s"}.`
              : "Your inbox looks empty.",
          },
        };
      }

      // ── Search emails — returns immediately ──
      if (/\b(search|find)\b.*\b(email|mail)s?\b/i.test(goal)) {
        const result = await callConnector({
          connectorId: "email",
          action: "search_emails",
          params: { query: entities.topic || intent.goal, limit: 10 },
        });

        return {
          success: true,
          result: {
            type: "email_search",
            content: `Found ${result.resultCount || 0} matching emails.`,
            messageIds: result.messageIds || [],
            spoken_response: `I found ${result.resultCount || 0} matching emails.`,
          },
        };
      }

      // ── Send / draft email (HIGH risk — double confirmation required) ──
      const to = entities.person || "";

      // Validate recipient looks like an email address
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return {
          success: true,
          result: {
            type: "email_needs_recipient",
            content: to
              ? `"${to}" doesn't look like a valid email address. Please provide a valid recipient.`
              : "I need a recipient email address to send this message. Who should I send it to?",
            requiresDoubleConfirm: true,
            spoken_response: to
              ? `"${to}" doesn't look like a valid email. Could you give me the full address?`
              : "Who should I send this to? I need an email address.",
          },
        };
      }

      const subject = entities.topic || intent.goal || "Message from NOVA";

      // Use AI to generate email body if available
      let body = `Regarding: ${intent.goal}`;
      try {
        const ai = require("./ai");
        if (ai.isAvailable()) {
          body = await ai.chat(
            "You are a professional email writer. Write a clear, concise email body based on the user's request. No subject line, no greeting/closing — just the body text.",
            intent.goal,
            { task: "chat", maxTokens: 500, temperature: 0.3 }
          );
        }
      } catch (err) {
        console.warn("[Communicate] AI body generation failed:", err.message);
      }

      const result = await callConnector({
        connectorId: "email",
        action: "send_email",
        params: { to, subject, body },
      });

      if (result.success && result.messageId) {
        return {
          success: true,
          result: {
            type: "email_sent",
            content: `Email sent to **${to}** — Subject: "${subject}"`,
            messageId: result.messageId,
            requiresDoubleConfirm: true,
            spoken_response: `Done, I've sent the email to ${to}.`,
          },
        };
      }

      if (result.status === "demo") {
        return {
          success: true,
          result: {
            type: "email_draft",
            content: `Draft prepared (demo): To: ${to}, Subject: "${subject}"\n\n${body}\n\nConnect Gmail in Settings to send real emails.`,
            draft: { to, subject, body },
            demo: true,
            requiresDoubleConfirm: true,
            spoken_response: `I've drafted the email. Connect Gmail to actually send it.`,
          },
        };
      }

      return {
        success: true,
        result: {
          type: "communication",
          content: `Draft prepared: ${intent.goal}`,
          draft: { to, subject, body },
          requiresDoubleConfirm: true,
        },
      };
    },
  })
);

// 4. Documents (Priority 4 — MEDIUM risk)
registry.register(
  createSkill({
    id: "documents",
    name: "Documents",
    description: "File creation, editing, document generation, analysis",
    icon: "📄",
    riskLevel: RISK_LEVELS.MEDIUM,
    modules: ["write", "learn"],
    actions: ["create"],
    buildPriority: 4,
    handler: async (intent, context) => {
      const goal = intent.goal || "Generate a document";
      let content = "";

      // Use AI to generate document content
      try {
        const ai = require("./ai");
        if (ai.isAvailable()) {
          content = await ai.chat(
            "You are a professional document writer. Generate the requested content in clean markdown format. Be thorough but concise. Include proper headings, sections, and formatting.",
            goal,
            { task: "chat", maxTokens: 4096, temperature: 0.4 }
          );
        } else {
          content = `# ${goal}\n\nThis document was created by NOVA.\n\n## Content\n\nConfigure an AI provider (Gemini/Groq/Anthropic) to generate real document content.`;
        }
      } catch {
        content = `# ${goal}\n\nDocument generation requires an AI provider. Please configure one in Settings.`;
      }

      // Save to agent-output directory
      const { getUserOutputDir } = require("./tools");
      const userId = context.userId || "default-user";
      const outputDir = getUserOutputDir(userId);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const fileName = `${goal.replace(/[^a-zA-Z0-9]+/g, "_").substring(0, 50).toLowerCase()}_${Date.now()}.md`;
      const filePath = path.join(outputDir, fileName);

      fs.writeFileSync(filePath, content, "utf-8");

      return {
        success: true,
        result: {
          type: "document",
          content: content.substring(0, 500) + (content.length > 500 ? "\n\n...(document continues)" : ""),
          filePath,
          fileName,
          fullContent: content,
          requiresApproval: true,
          spoken_response: `I've created the document "${goal}" and saved it to your output folder.`,
        },
      };
    },
  })
);

// 5. Smart Home (Priority 6 — MEDIUM-HIGH risk)
registry.register(
  createSkill({
    id: "smart_home",
    name: "Smart Home",
    description: "IoT device control, scenes, automations",
    icon: "🏠",
    riskLevel: RISK_LEVELS.MEDIUM,
    modules: ["home"],
    actions: ["control", "automate"],
    buildPriority: 6,
    isConfigured: () => Boolean(process.env.HA_BASE_URL && process.env.HA_TOKEN),
    handler: async (intent, context) => {
      const goal = (intent.goal || "").toLowerCase();
      const entities = intent.entities || {};

      // List devices
      if (/list|show|devices|what('s| is) (on|off|connected)|status/i.test(goal)) {
        const result = await callConnector({
          connectorId: "home_assistant",
          action: "get_devices",
          params: {},
        });

        if (result.success) {
          const devices = result.devices || [];
          const deviceList = devices.length > 0
            ? devices.map((d) => `• **${d.name}** (${d.type}) — ${d.state}`).join("\n")
            : "No devices found.";

          return {
            success: true,
            result: {
              type: "home_devices",
              content: deviceList,
              devices,
              spoken_response: `Found ${devices.length} device${devices.length === 1 ? "" : "s"} in your home.`,
            },
          };
        }
      }

      // Get device state
      if (/state|status|check/i.test(goal) && entities.topic) {
        const entityId = inferEntityId(entities.topic);
        const result = await callConnector({
          connectorId: "home_assistant",
          action: "get_state",
          params: { entity_id: entityId },
        });

        if (result.success) {
          return {
            success: true,
            result: {
              type: "home_state",
              content: `**${result.name || entityId}** is currently **${result.state}**.`,
              entity: result,
              spoken_response: `${result.name || entityId} is ${result.state}.`,
            },
          };
        }
      }

      // Control device
      const entityId = inferEntityId(entities.topic || goal);
      const action = /turn off|switch off|disable/i.test(goal)
        ? "turn_off"
        : /turn on|switch on|enable/i.test(goal)
          ? "turn_on"
          : "toggle";

      const result = await callConnector({
        connectorId: "home_assistant",
        action: "control_device",
        params: {
          entity_id: entityId,
          action,
          value: entities.amount ? Number(entities.amount) : undefined,
        },
      });

      if (result.success) {
        return {
          success: true,
          result: {
            type: "home_control",
            content: result.message || `${action.replace("_", " ")} executed on ${entityId}.`,
            requiresApproval: true,
            spoken_response: result.message || `Done, I've ${action.replace("_", " ")} the ${entities.topic || "device"}.`,
          },
        };
      }

      if (result.status === "demo") {
        return {
          success: true,
          result: {
            type: "home_control",
            content: `Smart home command accepted (demo): ${intent.goal}. Connect Home Assistant in Settings for real control.`,
            demo: true,
            requiresApproval: true,
            spoken_response: `I've prepared the smart home command. Connect Home Assistant to make it real.`,
          },
        };
      }

      return {
        success: true,
        result: {
          type: "home_control",
          content: result.error || `Home command: ${intent.goal}`,
          requiresApproval: true,
        },
      };
    },
  })
);

// 6. Finance (Priority 7 — HIGH risk, last to build)
registry.register(
  createSkill({
    id: "finance",
    name: "Finance",
    description: "Budget tracking, expenses, payments, financial records",
    icon: "💰",
    riskLevel: RISK_LEVELS.HIGH,
    modules: ["finance"],
    actions: ["create", "search"],
    buildPriority: 7,
    handler: async (intent, context) => {
      const goal = (intent.goal || "").toLowerCase();
      const entities = intent.entities || {};
      const userId = context.userId || "default-user";

      // Try to use moduleData for local finance tracking
      let moduleData;
      try {
        moduleData = require("./moduleData");
      } catch {
        moduleData = null;
      }

      // List/query expenses
      if (/list|show|expenses|spending|budget|how much|total|summary/i.test(goal)) {
        if (moduleData) {
          try {
            const records = await moduleData.listFinanceRecords(userId, {
              type: "expense",
              limit: 20,
            });

            const total = records.reduce((sum, r) => sum + (r.amount || 0), 0);
            const recordList = records.length > 0
              ? records.map((r) => `• **${r.category || "Other"}** — $${r.amount} — ${r.note || ""}`).join("\n")
              : "No expense records found.";

            return {
              success: true,
              result: {
                type: "finance_summary",
                content: `${recordList}\n\n**Total: $${total.toFixed(2)}**`,
                records,
                total,
                spoken_response: records.length > 0
                  ? `You have ${records.length} expense records totaling $${total.toFixed(2)}.`
                  : "No expenses recorded yet.",
              },
            };
          } catch (err) {
            console.warn("[Finance] DB query failed (listFinanceRecords):", err.message);
          }
        }

        return {
          success: true,
          result: {
            type: "finance_summary",
            content: "Finance tracking requires a database. Configure DATABASE_URL and run `npx prisma migrate dev` to enable.",
            spoken_response: "I need a database connection to track finances. Check the setup guide.",
          },
        };
      }

      // Track new expense
      if (/track|add|log|record|spent|expense|paid/i.test(goal)) {
        const amount = entities.amount ? parseFloat(String(entities.amount).replace(/[^0-9.]/g, "")) : null;

        if (moduleData && amount) {
          try {
            const record = await moduleData.createFinanceRecord(userId, {
              type: "expense",
              amount,
              category: entities.topic || "general",
              note: intent.goal,
            });

            return {
              success: true,
              result: {
                type: "finance_recorded",
                content: `Expense recorded: **$${amount}** for ${entities.topic || "general"}.`,
                record,
                requiresDoubleConfirm: true,
                spoken_response: `Logged $${amount} expense for ${entities.topic || "general"}.`,
              },
            };
          } catch (err) {
            console.warn("[Finance] DB write failed (createFinanceRecord):", err.message);
          }
        }

        return {
          success: true,
          result: {
            type: "finance",
            content: amount
              ? `Would track: $${amount} for ${entities.topic || "general"}. Database required for persistence.`
              : `Financial action: ${intent.goal}. Specify an amount to track.`,
            requiresDoubleConfirm: true,
            warning: "This involves financial data. Please review carefully.",
            spoken_response: amount
              ? `I'd track $${amount}. Connect a database to save it.`
              : "I need an amount to track that expense.",
          },
        };
      }

      // Currency/stock lookup via finance_data connector (if added)
      if (/\b(currency|exchange\s*rate|stock|price|crypto)\b/i.test(goal)) {
        const result = await callConnector({
          connectorId: "finance_data",
          action: /\bstock\b/i.test(goal) ? "stock_price" : /\bcrypto\b/i.test(goal) ? "crypto_price" : "currency_convert",
          params: { query: entities.topic || intent.goal },
        });

        if (result.success) {
          // Format the data as human-readable text instead of raw JSON
          const data = result.data || result;
          const lines = [];
          if (data.symbol) lines.push(`**${data.symbol}**`);
          if (data.price != null) lines.push(`Price: $${Number(data.price).toFixed(2)}`);
          if (data.change != null) lines.push(`Change: ${data.change > 0 ? "+" : ""}${Number(data.change).toFixed(2)}%`);
          if (data.from && data.to && data.rate != null) lines.push(`${data.from} → ${data.to}: ${data.rate}`);
          const content = lines.length > 0 ? lines.join(" | ") : `Financial data for: ${entities.topic || intent.goal}`;

          return {
            success: true,
            result: {
              type: "finance_data",
              content,
              data,
              spoken_response: content,
            },
          };
        }
      }

      return {
        success: true,
        result: {
          type: "finance",
          content: `Financial action: ${intent.goal}`,
          requiresDoubleConfirm: true,
          warning: "This involves financial data. Please review carefully.",
        },
      };
    },
  })
);

// 7. Safety Review (special internal skill)
registry.register(
  createSkill({
    id: "safety_review",
    name: "Safety Review",
    description: "Internal skill for handling flagged content",
    icon: "🛡️",
    riskLevel: RISK_LEVELS.HIGH,
    modules: ["safety_review"],
    actions: [],
    buildPriority: 0,
    handler: async (intent) => {
      console.warn(`[Safety] Blocked request: ${intent.goal || "unknown"}`);
      return {
        success: true,
        result: {
          type: "safety_block",
          content: "This request has been flagged for safety review and cannot be processed.",
          spoken_response: "I'm not able to help with that request. Let me know if there's something else I can assist with.",
        },
      };
    },
  })
);

// ── Helper: Infer Home Assistant entity ID from natural language ──

function inferEntityId(text = "") {
  const value = text.toLowerCase().replace(/[^a-z0-9_. ]/g, "");

  // Direct entity ID format (e.g. "light.living_room")
  if (/^[a-z_]+\.[a-z0-9_]+$/.test(value)) return value;

  // Common device mappings — anchored with \b to prevent substring matches
  const mappings = [
    [/\bliving\s*room\s*lights?\b/i, "light.living_room"],
    [/\bbedroom\s*lights?\b/i, "light.bedroom"],
    [/\bkitchen\s*lights?\b/i, "light.kitchen"],
    [/\bbathroom\s*lights?\b/i, "light.bathroom"],
    [/\bhallway\s*lights?\b/i, "light.hallway"],
    [/\bgarage\s*lights?\b/i, "light.garage"],
    [/\bporch\s*lights?\b/i, "light.porch"],
    [/\bthermostat\b/i, "climate.thermostat"],
    [/\b(ac|air\s*condition(?:er|ing)?)\b/i, "climate.ac"],
    [/\bfan\b/i, "fan.living_room"],
    [/\b(tv|television)\b/i, "media_player.tv"],
    [/\b(?:front\s*)?(?:door\s*)?lock\b/i, "lock.front_door"],
  ];

  for (const [pattern, entityId] of mappings) {
    if (pattern.test(text)) return entityId;
  }

  // Fallback: construct entity_id from text
  const domain = /\blight/i.test(text) ? "light" : /\bswitch\b/i.test(text) ? "switch" : /\b(climate|temp)\b/i.test(text) ? "climate" : "light";
  const name = value.replace(/\s+/g, "_").replace(/^(turn|switch|toggle)_*/, "");
  return `${domain}.${name || "default"}`;
}

module.exports = {
  registry,
  SkillRegistry,
  createSkill,
  RISK_LEVELS,
};
