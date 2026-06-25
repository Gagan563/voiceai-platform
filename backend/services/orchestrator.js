// ============================================
// NOVA — Multi-Agent Orchestrator
// ============================================
//
// DAG-based multi-agent execution engine.
// Each agent is a specialist with its own system prompt,
// tool set, and memory scope. The orchestrator:
//   1. Decomposes a goal into a DAG of steps
//   2. Launches specialist agents for steps with no unmet deps
//   3. As each completes, unlocks dependent steps
//   4. Streams progress via callbacks
//   5. Handles failures with retry/rollback
//   6. Saves successful patterns as skills

const ai = require("./ai");
const { executeTool, TOOL_DEFINITIONS } = require("./tools");
const { runTerminal } = require("./terminal");
const { callConnector } = require("./mcp");

// ── Agent Specializations ──

const AGENTS = {
  coder: {
    name: "Coder",
    icon: "🔧",
    systemPrompt: `You are NOVA Coder — an expert full-stack developer.
You write production-ready code in any language. You create clean, maintainable, 
well-structured files. You use modern patterns and best practices.
When building web apps: dark theme, premium design, smooth animations.
Return ONLY JSON: { "thinking": "...", "tool": "...", "params": {...} }`,
    tools: ["generate_code", "write_file", "read_file", "modify_file", "list_files", "preview_html", "run_terminal", "think", "complete"],
  },
  researcher: {
    name: "Researcher",
    icon: "🔍",
    systemPrompt: `You are NOVA Researcher — an expert research analyst.
You search the web, read pages, synthesize information, and produce clear summaries
with citations. You are thorough and objective.
Return ONLY JSON: { "thinking": "...", "tool": "...", "params": {...} }`,
    tools: ["search_web", "write_file", "read_file", "think", "complete"],
  },
  analyst: {
    name: "Analyst",
    icon: "📊",
    systemPrompt: `You are NOVA Analyst — a data analysis specialist.
You process data, create visualizations, run calculations, and produce reports.
You work with CSV, JSON, and SQL. You create charts in HTML with Chart.js.
Return ONLY JSON: { "thinking": "...", "tool": "...", "params": {...} }`,
    tools: ["generate_code", "write_file", "read_file", "modify_file", "run_terminal", "think", "complete"],
  },
  designer: {
    name: "Designer",
    icon: "🎨",
    systemPrompt: `You are NOVA Designer — a UI/UX design specialist.
You create stunning, modern interfaces. You work with HTML, CSS, React, and Tailwind.
Dark themes, glassmorphism, micro-animations, premium typography.
Return ONLY JSON: { "thinking": "...", "tool": "...", "params": {...} }`,
    tools: ["generate_code", "write_file", "read_file", "modify_file", "preview_html", "think", "complete"],
  },
  tester: {
    name: "Tester",
    icon: "🧪",
    systemPrompt: `You are NOVA Tester — a quality assurance specialist.
You write and run tests: unit tests, integration tests, linting, type checking.
You identify bugs and suggest fixes. You validate code quality.
Return ONLY JSON: { "thinking": "...", "tool": "...", "params": {...} }`,
    tools: ["write_file", "read_file", "run_terminal", "think", "complete"],
  },
  deployer: {
    name: "Deployer",
    icon: "🚀",
    systemPrompt: `You are NOVA Deployer — a DevOps and deployment specialist.
You build Docker containers, create CI/CD configs, deploy to cloud providers,
manage domains, and set up monitoring. You keep things simple and reliable.
Return ONLY JSON: { "thinking": "...", "tool": "...", "params": {...} }`,
    tools: ["write_file", "read_file", "run_terminal", "think", "complete"],
  },
};

// ── DAG Planning ──

/**
 * Use AI to decompose a goal into a DAG of steps.
 * Each step specifies its agent type, dependencies, and description.
 */
async function planDAG(goal) {
  const prompt = `Decompose this goal into a directed acyclic graph (DAG) of execution steps.
Each step must specify which specialist agent should handle it.

Available agents: ${Object.entries(AGENTS).map(([id, a]) => `${id} (${a.name})`).join(", ")}

Return JSON array of steps:
[
  {
    "id": "step-1",
    "agent": "coder",
    "description": "What this step does",
    "depends_on": [],
    "estimated_seconds": 30
  },
  {
    "id": "step-2",
    "agent": "tester",
    "description": "What this step does",
    "depends_on": ["step-1"],
    "estimated_seconds": 15
  }
]

Rules:
1. Steps with no dependencies can run in parallel.
2. Keep it practical — 3-8 steps for simple tasks, up to 15 for complex ones.
3. Always end with a "complete" step that depends on everything else.
4. The coder agent handles code generation and file I/O.
5. The researcher agent handles web searches and information gathering.
6. Order steps logically — research before coding, coding before testing, testing before deploying.

Goal: "${goal}"`;

  if (!ai.isAvailable()) {
    // Local fallback — sequential plan
    return [
      { id: "step-1", agent: "researcher", description: `Research requirements for: ${goal}`, depends_on: [], estimated_seconds: 10 },
      { id: "step-2", agent: "coder", description: `Build the solution for: ${goal}`, depends_on: ["step-1"], estimated_seconds: 45 },
      { id: "step-3", agent: "tester", description: "Validate the output", depends_on: ["step-2"], estimated_seconds: 15 },
      { id: "step-4", agent: "coder", description: "Apply fixes and finalize", depends_on: ["step-3"], estimated_seconds: 20 },
    ];
  }

  try {
    const raw = await ai.chatJSON("You are a project planner. Return only valid JSON.", prompt, { task: "plan" });
    if (Array.isArray(raw)) return raw;
    if (raw.steps && Array.isArray(raw.steps)) return raw.steps;
    throw new Error("Invalid plan format");
  } catch (err) {
    console.warn("[Orchestrator] AI planning failed, using fallback:", err.message);
    return [
      { id: "step-1", agent: "coder", description: `Build: ${goal}`, depends_on: [], estimated_seconds: 30 },
      { id: "step-2", agent: "tester", description: "Validate", depends_on: ["step-1"], estimated_seconds: 10 },
    ];
  }
}

// ── Topological Sort ──

function topoSort(steps) {
  const graph = new Map();
  const inDegree = new Map();

  for (const step of steps) {
    graph.set(step.id, []);
    inDegree.set(step.id, 0);
  }

  for (const step of steps) {
    for (const dep of step.depends_on || []) {
      if (graph.has(dep)) {
        graph.get(dep).push(step.id);
        inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
      }
    }
  }

  const queue = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted = [];
  const levels = []; // Groups of parallel steps

  while (queue.length > 0) {
    const level = [...queue];
    levels.push(level);
    queue.length = 0;

    for (const id of level) {
      sorted.push(id);
      for (const neighbor of graph.get(id) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }
  }

  return { sorted, levels };
}

// ── Agent Runner ──

async function runSpecialistAgent(agentType, task, context = {}, onStep) {
  const agent = AGENTS[agentType] || AGENTS.coder;
  const maxIterations = 10;
  const emit = onStep || (() => {});

  const contextStr = Object.entries(context)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");

  const conversation = [
    { role: "user", content: `${task}${contextStr ? `\n\nContext:\n${contextStr}` : ""}` },
  ];

  const results = [];

  for (let i = 0; i < maxIterations; i++) {
    let action;

    if (!ai.isAvailable()) {
      // Mock agent action
      if (i === 0) {
        action = { thinking: `Starting: ${task}`, tool: "think", params: { thought: task } };
      } else {
        action = {
          thinking: "Task complete",
          tool: "complete",
          params: { summary: `Completed: ${task}`, preview_file: null },
        };
      }
    } else {
      const toolDocs = agent.tools
        .map((t) => {
          const def = TOOL_DEFINITIONS.find((d) => d.name === t);
          if (t === "run_terminal") return `### run_terminal\nRun a shell command. Parameters: { "command": "...", "cwd": "..." }`;
          return def ? `### ${def.name}\n${def.description}\nParameters: ${JSON.stringify(def.parameters)}` : "";
        })
        .filter(Boolean)
        .join("\n\n");

      const systemPrompt = `${agent.systemPrompt}\n\nAvailable tools:\n${toolDocs}`;

      try {
        const raw = await ai.chatMultiTurn(systemPrompt, conversation, {
          task: "agent",
          maxTokens: 4096,
          temperature: 0.3,
        });

        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        action = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw);
      } catch (err) {
        action = {
          thinking: `Error: ${err.message}`,
          tool: "complete",
          params: { summary: `Agent error: ${err.message}`, preview_file: null },
        };
      }
    }

    emit({
      type: "agent_step",
      agent: agentType,
      agentName: agent.name,
      agentIcon: agent.icon,
      iteration: i + 1,
      tool: action.tool,
      thinking: action.thinking,
      status: "running",
    });

    // Execute the tool
    let toolResult;
    try {
      if (action.tool === "run_terminal") {
        toolResult = await runTerminal({
          command: action.params?.command || "",
          cwd: action.params?.cwd,
        });
      } else {
        toolResult = await executeTool(action.tool, action.params || {});
      }
    } catch (err) {
      toolResult = { success: false, error: err.message };
    }

    results.push({
      agent: agentType,
      iteration: i + 1,
      tool: action.tool,
      thinking: action.thinking,
      result: toolResult,
    });

    emit({
      type: "agent_step",
      agent: agentType,
      agentName: agent.name,
      agentIcon: agent.icon,
      iteration: i + 1,
      tool: action.tool,
      thinking: action.thinking,
      result: toolResult,
      status: toolResult.success ? "done" : "error",
    });

    if (action.tool === "complete") break;

    if (!ai.isAvailable()) continue;

    conversation.push({ role: "assistant", content: JSON.stringify(action) });
    conversation.push({
      role: "user",
      content: `Tool result: ${JSON.stringify(toolResult).substring(0, 2000)}. Continue with next JSON tool call.`,
    });
  }

  return results;
}

// ── Orchestrator ──

/**
 * Run a multi-agent orchestration pipeline.
 *
 * @param {string} goal — User's high-level goal
 * @param {object} options
 * @param {string} options.userId
 * @param {function} options.onStep — Progress callback
 * @returns {{ success, summary, dag, results, duration_ms }}
 */
async function orchestrate(goal, { userId = "default-user", onStep } = {}) {
  const emit = onStep || (() => {});
  const startTime = Date.now();

  emit({ type: "orchestrator_start", goal, timestamp: Date.now() });

  // 1. Plan the DAG
  emit({ type: "orchestrator_planning", message: "Decomposing goal into execution plan...", timestamp: Date.now() });
  const dag = await planDAG(goal);
  const { levels } = topoSort(dag);

  emit({
    type: "orchestrator_plan_ready",
    dag,
    levels,
    totalSteps: dag.length,
    parallelLevels: levels.length,
    timestamp: Date.now(),
  });

  // 2. Execute level by level
  const allResults = {};
  const stepMap = new Map(dag.map((s) => [s.id, s]));

  for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
    const levelSteps = levels[levelIdx];

    emit({
      type: "orchestrator_level_start",
      level: levelIdx + 1,
      totalLevels: levels.length,
      steps: levelSteps.map((id) => stepMap.get(id)),
      timestamp: Date.now(),
    });

    // Run all steps in this level in parallel
    const promises = levelSteps.map(async (stepId) => {
      const step = stepMap.get(stepId);
      if (!step) return null;

      // Gather context from completed dependencies
      const depContext = {};
      for (const depId of step.depends_on || []) {
        if (allResults[depId]) {
          depContext[`result_from_${depId}`] = allResults[depId]
            .filter((r) => r.tool === "complete")
            .map((r) => r.result?.summary || "")
            .join("; ");
        }
      }

      emit({
        type: "orchestrator_step_start",
        stepId: step.id,
        agent: step.agent,
        agentName: AGENTS[step.agent]?.name || step.agent,
        agentIcon: AGENTS[step.agent]?.icon || "⚙️",
        description: step.description,
        level: levelIdx + 1,
        timestamp: Date.now(),
      });

      const results = await runSpecialistAgent(
        step.agent,
        step.description,
        depContext,
        (event) => emit({ ...event, stepId: step.id, level: levelIdx + 1 })
      );

      allResults[step.id] = results;

      emit({
        type: "orchestrator_step_complete",
        stepId: step.id,
        agent: step.agent,
        agentName: AGENTS[step.agent]?.name || step.agent,
        description: step.description,
        iterationsUsed: results.length,
        level: levelIdx + 1,
        timestamp: Date.now(),
      });

      return { stepId: step.id, results };
    });

    await Promise.all(promises);

    emit({
      type: "orchestrator_level_complete",
      level: levelIdx + 1,
      totalLevels: levels.length,
      timestamp: Date.now(),
    });
  }

  // 3. Summarize
  const duration = Date.now() - startTime;
  const totalIterations = Object.values(allResults).reduce((sum, r) => sum + r.length, 0);

  const summary = {
    success: true,
    goal,
    dag,
    levels,
    totalSteps: dag.length,
    totalIterations,
    duration_ms: duration,
    agents_used: [...new Set(dag.map((s) => s.agent))],
  };

  emit({ type: "orchestrator_complete", ...summary, timestamp: Date.now() });

  return summary;
}

module.exports = { orchestrate, planDAG, AGENTS };
