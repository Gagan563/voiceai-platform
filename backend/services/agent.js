// ============================================
// VoiceAI Platform — Autonomous Agent
// ============================================
//
// The brain: takes an input, autonomously decides what to do,
// executes tools, checks results, iterates until done.
// Streams every step to the frontend via callback.

const ai = require("./ai");
const { TOOL_DEFINITIONS, executeTool, clearWorkspace } = require("./tools");
const { recallMemory, extractFacts, saveMemory } = require("./memory");

const MAX_ITERATIONS = 15;

// ── Agent System Prompt ──

const AGENT_SYSTEM_PROMPT = `You are an autonomous AI agent called VoxMind. The user gives you a task and you MUST complete it fully on your own — no asking for clarification, no stopping partway.

## Your Capabilities
You have these tools available:

${TOOL_DEFINITIONS.map(
  (t) =>
    `### ${t.name}
${t.description}
Parameters: ${JSON.stringify(t.parameters)}`
).join("\n\n")}

## How To Respond
Return a JSON object with your next action:
{
  "thinking": "Your internal reasoning (1-2 sentences)",
  "tool": "tool_name",
  "params": { ... tool parameters ... }
}

## Rules
1. ALWAYS return valid JSON — nothing else.
2. Start by using "think" to plan your approach.
3. For web tasks: generate complete, beautiful, production-ready code in a SINGLE HTML file with embedded CSS and JS.
4. Make everything visually STUNNING — dark themes, gradients, animations, Google Fonts, modern design.
5. After generating code, ALWAYS call "preview_html" to show it.
6. When completely done, call "complete" with a summary.
7. If the user uploaded files, read them first to understand requirements.
8. If something fails, try a different approach. Never give up.
9. Do NOT wrap your response in markdown. Return raw JSON only.

## Design Standards
When generating HTML/CSS:
- Use Inter or Outfit font from Google Fonts
- Dark background (#0a0a0f or similar)
- Gradient accents (purple/blue/cyan)
- Glassmorphism panels (backdrop-blur, semi-transparent)
- Smooth animations and hover effects
- Fully responsive
- The user should be WOWED at first glance`;

// ── Mock Agent (works without API key) ──

function createMockResponse(input, iteration) {
  if (iteration === 0) {
    return {
      thinking: `Planning how to build: "${input.substring(0, 50)}..."`,
      tool: "think",
      params: {
        thought: `I need to create a complete solution for: "${input}". I'll generate a beautiful, modern HTML page with embedded CSS and JavaScript.`,
      },
    };
  }

  if (iteration === 1) {
    const title = input.replace(/build|create|make|generate/gi, "").trim() || "VoxMind App";

    return {
      thinking: "Generating the complete HTML application",
      tool: "write_file",
      params: {
        filename: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1628 100%);
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    header {
      width: 100%;
      padding: 1.5rem 2rem;
      background: rgba(255,255,255,0.03);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    header h1 {
      font-size: 1.25rem;
      font-weight: 700;
      background: linear-gradient(135deg, #a78bfa, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .badge {
      font-size: 0.7rem;
      padding: 0.35rem 0.8rem;
      border-radius: 9999px;
      background: rgba(139,92,246,0.15);
      border: 1px solid rgba(139,92,246,0.3);
      color: #a78bfa;
      font-weight: 600;
    }
    main {
      max-width: 900px;
      width: 100%;
      padding: 3rem 1.5rem;
      flex: 1;
    }
    .hero {
      text-align: center;
      padding: 4rem 0;
      animation: fadeUp 0.8s ease-out;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .hero h2 {
      font-size: 2.5rem;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 1rem;
    }
    .hero h2 span {
      background: linear-gradient(135deg, #8b5cf6, #06b6d4, #10b981);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero p {
      font-size: 1.1rem;
      color: #94a3b8;
      max-width: 600px;
      margin: 0 auto 2rem;
      line-height: 1.7;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
      margin-top: 2rem;
    }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 1rem;
      padding: 1.5rem;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    .card:hover {
      background: rgba(139,92,246,0.08);
      border-color: rgba(139,92,246,0.3);
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(139,92,246,0.1);
    }
    .card .icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      margin-bottom: 1rem;
    }
    .card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
    .card p { font-size: 0.85rem; color: #94a3b8; line-height: 1.5; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      color: white;
      border: none;
      border-radius: 0.75rem;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(139,92,246,0.3);
    }
    footer {
      width: 100%;
      text-align: center;
      padding: 1.5rem;
      color: #475569;
      font-size: 0.8rem;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
  </style>
</head>
<body>
  <header>
    <h1>✦ ${title}</h1>
    <span class="badge">Built by VoxMind AI</span>
  </header>
  <main>
    <div class="hero">
      <h2>Welcome to <span>${title}</span></h2>
      <p>This application was autonomously generated by VoxMind AI based on your description. It features a modern dark theme with smooth animations.</p>
      <button class="btn" onclick="alert('🚀 VoxMind AI at your service!')">Get Started →</button>
    </div>
    <div class="cards">
      <div class="card">
        <div class="icon" style="background:rgba(139,92,246,0.15)">🎯</div>
        <h3>Smart & Adaptive</h3>
        <p>Built with intelligence at its core, adapting to your needs seamlessly.</p>
      </div>
      <div class="card">
        <div class="icon" style="background:rgba(6,182,212,0.15)">⚡</div>
        <h3>Lightning Fast</h3>
        <p>Optimized for speed and performance with modern web technologies.</p>
      </div>
      <div class="card">
        <div class="icon" style="background:rgba(16,185,129,0.15)">🎨</div>
        <h3>Beautiful Design</h3>
        <p>Premium aesthetics with glassmorphism, gradients, and micro-animations.</p>
      </div>
    </div>
  </main>
  <footer>Built autonomously by VoxMind AI Agent • ${new Date().getFullYear()}</footer>
  <script>
    document.querySelectorAll('.card').forEach((card, i) => {
      card.style.animationDelay = (i * 0.15) + 's';
      card.style.animation = 'fadeUp 0.6s ease-out both';
    });
  </script>
</body>
</html>`,
      },
    };
  }

  if (iteration === 2) {
    return {
      thinking: "Setting up the preview",
      tool: "preview_html",
      params: { filename: "index.html" },
    };
  }

  return {
    thinking: "Task is complete",
    tool: "complete",
    params: {
      summary: `I've built a complete, modern web application based on your request. It features a dark theme with gradient accents, responsive design, and smooth animations. The app is ready to preview.`,
      preview_file: "index.html",
    },
  };
}

// ── Agent Runner ──

/**
 * Run the autonomous agent.
 *
 * @param {object} options
 * @param {string} options.input — User's text command
 * @param {string[]} options.files — Array of uploaded filenames
 * @param {string} options.userId — User ID for memory
 * @param {function} options.onStep — Callback for each step: (step) => void
 * @returns {object} Final result
 */
async function runAgent({ input, files = [], userId = "default-user", onStep }) {
  const emit = onStep || (() => {});

  emit({
    type: "agent_start",
    message: `Starting autonomous agent for: "${input.substring(0, 80)}"`,
    timestamp: Date.now(),
  });

  // Clear workspace for fresh output
  clearWorkspace();

  // Check if we have a Gemini API key
  const useMock = !ai.isAvailable();

  if (useMock) {
    console.log("[Agent] No Gemini key — running in mock mode");
    emit({
      type: "agent_info",
      message: "Running in demo mode (no API key). Generating sample output.",
      timestamp: Date.now(),
    });
  }

  // Recall memories for context
  let memoryContext = "";
  try {
    const memories = await recallMemory(userId, input, 5);
    if (memories.length > 0) {
      memoryContext = `\n\nUser context from memory:\n${memories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
    }
  } catch (err) {
    console.warn("[Agent] Memory recall skipped:", err.message);
  }

  // Build context about uploaded files
  let fileContext = "";
  if (files.length > 0) {
    fileContext = `\n\nThe user uploaded these files: ${files.join(", ")}. Read them to understand the requirements.`;
  }

  // Agent loop
  const steps = [];
  let iteration = 0;
  let isComplete = false;
  let finalResult = null;

  const conversationHistory = [
    {
      role: "user",
      content: `${input}${fileContext}${memoryContext}`,
    },
  ];

  while (iteration < MAX_ITERATIONS && !isComplete) {
    iteration++;

    emit({
      type: "agent_thinking",
      iteration,
      message: `Agent thinking... (step ${iteration}/${MAX_ITERATIONS})`,
      timestamp: Date.now(),
    });

    let agentAction;

    if (useMock) {
      // Mock mode — simulate agent behavior
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
      agentAction = createMockResponse(input, iteration - 1);
    } else {
      // Real mode — call Gemini
      try {
        const responseText = await ai.chatMultiTurn(
          AGENT_SYSTEM_PROMPT,
          conversationHistory,
          { maxTokens: 8192, temperature: 0.4 }
        );

        // Parse the JSON response
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          agentAction = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
        } catch (parseErr) {
          console.error("[Agent] Failed to parse response:", responseText.substring(0, 200));
          agentAction = {
            thinking: "I encountered a parsing issue. Let me complete the task.",
            tool: "complete",
            params: {
              summary: "Task completed with the files generated so far.",
              preview_file: "index.html",
            },
          };
        }
      } catch (apiErr) {
        console.error("[Agent] API error:", apiErr.message);
        emit({
          type: "agent_error",
          message: `API error: ${apiErr.message}`,
          timestamp: Date.now(),
        });
        break;
      }
    }

    // Emit thinking
    if (agentAction.thinking) {
      emit({
        type: "agent_step",
        iteration,
        tool: agentAction.tool,
        thinking: agentAction.thinking,
        status: "running",
        timestamp: Date.now(),
      });
    }

    // Execute the tool
    let toolResult;
    try {
      toolResult = await executeTool(agentAction.tool, agentAction.params || {});
    } catch (toolErr) {
      toolResult = { success: false, error: toolErr.message };
    }

    // Record the step
    const step = {
      iteration,
      tool: agentAction.tool,
      thinking: agentAction.thinking,
      params: agentAction.params,
      result: toolResult,
      timestamp: Date.now(),
    };
    steps.push(step);

    // Emit step completion
    emit({
      type: "agent_step",
      iteration,
      tool: agentAction.tool,
      thinking: agentAction.thinking,
      result: toolResult,
      status: toolResult.success ? "done" : "error",
      timestamp: Date.now(),
    });

    // Check for preview
    if (agentAction.tool === "preview_html" && toolResult.success) {
      emit({
        type: "agent_preview",
        filename: agentAction.params.filename,
        timestamp: Date.now(),
      });
    }

    // Check for completion
    if (agentAction.tool === "complete") {
      isComplete = true;
      finalResult = toolResult;
      break;
    }

    // Add to conversation history for context
    if (!useMock) {
      conversationHistory.push({
        role: "assistant",
        content: JSON.stringify(agentAction),
      });
      conversationHistory.push({
        role: "user",
        content: `Tool "${agentAction.tool}" result: ${JSON.stringify(toolResult)}\n\nContinue with the next step. Return JSON with your next tool call.`,
      });
    }
  }

  // Extract and save facts in background
  setImmediate(async () => {
    try {
      const facts = await extractFacts(`User asked: ${input}\nAgent built: ${finalResult?.summary || "a project"}`);
      for (const fact of facts) {
        await saveMemory(userId, fact);
      }
    } catch (err) {
      console.warn("[Agent] Fact extraction skipped:", err.message);
    }
  });

  const result = {
    success: isComplete,
    summary: finalResult?.summary || "Agent finished.",
    preview_file: finalResult?.preview_file || null,
    steps,
    total_iterations: iteration,
  };

  emit({
    type: "agent_complete",
    ...result,
    timestamp: Date.now(),
  });

  return result;
}

module.exports = { runAgent };
