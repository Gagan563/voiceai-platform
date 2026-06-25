#!/usr/bin/env node

// ============================================
// NOVA CLI — Command-Line Interface
// ============================================
// Usage:
//   nova "build a todo app"
//   nova search "latest AI news"
//   nova translate "hello" --to spanish
//   nova health
//   nova emergency first-aid choking
//   nova agents

const http = require("http");
const https = require("https");

const BASE = process.env.NOVA_URL || "http://localhost:3001";
const args = process.argv.slice(2);

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

function c(color, text) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function banner() {
  console.log(`
  ${c("magenta", "✦")} ${c("bold", "NOVA")} ${c("dim", "— Natural Omni Voice Assistant")}
  ${c("dim", `  Server: ${BASE}`)}
`);
}

async function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const lib = url.protocol === "https:" ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json" },
      timeout: 120000,
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    banner();
    console.log(`  ${c("bold", "Usage:")}

    ${c("cyan", "nova")} ${c("yellow", '"build a todo app"')}          Run autonomous agent
    ${c("cyan", "nova")} ${c("yellow", "orchestrate")} ${c("dim", '"complex goal"')}   Multi-agent DAG execution
    ${c("cyan", "nova")} ${c("yellow", "search")} ${c("dim", '"query"')}               Web search
    ${c("cyan", "nova")} ${c("yellow", "translate")} ${c("dim", '"text" --to lang')}    Translate text
    ${c("cyan", "nova")} ${c("yellow", "intent")} ${c("dim", '"text"')}                Extract intent
    ${c("cyan", "nova")} ${c("yellow", "health")}                       Server health check
    ${c("cyan", "nova")} ${c("yellow", "agents")}                       List specialist agents
    ${c("cyan", "nova")} ${c("yellow", "connectors")}                   List MCP connectors
    ${c("cyan", "nova")} ${c("yellow", "emergency")} ${c("dim", "first-aid [type]")}    First aid guide
    ${c("cyan", "nova")} ${c("yellow", "emergency")} ${c("dim", "contacts")}            Emergency contacts
    ${c("cyan", "nova")} ${c("yellow", "wellness")} ${c("dim", "mood [1-5] [note]")}    Mood check-in
    ${c("cyan", "nova")} ${c("yellow", "wellness")} ${c("dim", "breathing")}            Breathing exercises
    ${c("cyan", "nova")} ${c("yellow", "farm")} ${c("dim", '"crop advice"')}            Agriculture advice
    ${c("cyan", "nova")} ${c("yellow", "legal")} ${c("dim", '"question"')}              Legal information

  ${c("bold", "Environment:")}
    ${c("dim", "NOVA_URL")}  Backend URL (default: http://localhost:3001)
`);
    return;
  }

  const command = args[0].toLowerCase();

  try {
    switch (command) {
      // ── Health ──
      case "health":
      case "status": {
        const res = await request("GET", "/health");
        console.log(`  ${c("green", "●")} Status: ${c("bold", res.status)}`);
        console.log(`  ${c("cyan", "●")} Engine: ${c("bold", res.ai_engine || "unknown")}`);
        console.log(`  ${c("dim", "●")} Version: ${res.version || "?"}`);
        console.log(`  ${c("dim", "●")} Uptime: ${Math.round(res.uptime || 0)}s`);
        break;
      }

      // ── Agents ──
      case "agents": {
        const res = await request("GET", "/agents");
        console.log(`  ${c("bold", "Specialist Agents:")}\n`);
        for (const agent of res.agents || []) {
          console.log(`  ${agent.icon} ${c("bold", agent.name)} ${c("dim", `(${agent.id})`)}`);
          console.log(`    Tools: ${c("dim", agent.tools.join(", "))}\n`);
        }
        break;
      }

      // ── Connectors ──
      case "connectors": {
        const res = await request("GET", "/mcp/connectors");
        console.log(`  ${c("bold", "MCP Connectors:")}\n`);
        for (const conn of res.connectors || []) {
          const status = conn.configured ? c("green", "● Connected") : c("red", "○ Not configured");
          console.log(`  ${status}  ${c("bold", conn.name)} ${c("dim", `(${conn.id})`)}`);
          console.log(`    Actions: ${c("dim", conn.actions.join(", "))}\n`);
        }
        break;
      }

      // ── Search ──
      case "search": {
        const query = args.slice(1).join(" ");
        if (!query) { console.log(c("red", "  Usage: nova search \"query\"")); return; }
        console.log(`  ${c("dim", "Searching...")} ${query}\n`);
        const res = await request("GET", `/modules/search?q=${encodeURIComponent(query)}`);
        if (res.results?.length) {
          for (const r of res.results) {
            console.log(`  ${c("bold", r.title)}`);
            console.log(`  ${c("dim", r.snippet?.substring(0, 120) || "")}`);
            if (r.url) console.log(`  ${c("cyan", r.url)}`);
            console.log();
          }
        } else {
          console.log(c("yellow", "  No results found."));
        }
        break;
      }

      // ── Translate ──
      case "translate": {
        const toIdx = args.indexOf("--to");
        const target = toIdx !== -1 ? args[toIdx + 1] : "es";
        const text = args.slice(1, toIdx !== -1 ? toIdx : undefined).join(" ");
        if (!text) { console.log(c("red", "  Usage: nova translate \"text\" --to language")); return; }
        const res = await request("POST", "/modules/translate", { text, target });
        console.log(`  ${c("dim", "Source:")} ${text}`);
        console.log(`  ${c("green", "Result:")} ${c("bold", res.translated || res.error)}`);
        console.log(`  ${c("dim", `Engine: ${res.engine || "unknown"}, Target: ${target}`)}`);
        break;
      }

      // ── Intent ──
      case "intent": {
        const text = args.slice(1).join(" ");
        if (!text) { console.log(c("red", "  Usage: nova intent \"what you want to do\"")); return; }
        const res = await request("POST", "/intent", { text });
        const i = res.intent || {};
        console.log(`  ${c("bold", "Intent:")} ${i.goal || text}`);
        console.log(`  ${c("cyan", "Module:")} ${i.module || "unknown"}`);
        console.log(`  ${c("yellow", "Action:")} ${i.action_type || "unknown"}`);
        console.log(`  ${c("dim", "Confidence:")} ${((i.confidence || 0) * 100).toFixed(0)}%`);
        console.log(`  ${c("dim", `Engine: ${res.metadata?.engine || "unknown"}`)}`);
        break;
      }

      // ── Emergency ──
      case "emergency": {
        const sub = args[1]?.toLowerCase();
        if (sub === "contacts") {
          const res = await request("GET", "/nova/emergency/contacts");
          console.log(`  ${c("bold", c("red", "⚠ Emergency Contacts:"))}\n`);
          for (const contact of res.global || []) {
            console.log(`  ${c("bold", contact.name)}: ${c("yellow", contact.number || contact.url)}`);
          }
        } else if (sub === "first-aid") {
          const condition = args[2]?.toLowerCase();
          if (condition) {
            const res = await request("GET", `/nova/emergency/first-aid/${condition}`);
            if (res.guide) {
              console.log(`\n  ${c("bold", c("red", `⚠ ${res.guide.title}`))}\n`);
              res.guide.steps.forEach((step, i) => {
                console.log(`  ${c("yellow", `${i + 1}.`)} ${step}`);
              });
              if (res.guide.warning) console.log(`\n  ${c("red", `⚠ ${res.guide.warning}`)}`);
              if (res.guide.call) console.log(`\n  ${c("bold", res.guide.call)}`);
            } else {
              console.log(`  Available: ${c("dim", (res.available || []).join(", "))}`);
            }
          } else {
            const res = await request("GET", "/nova/emergency/first-aid");
            console.log(`  ${c("bold", "First Aid Guides:")}\n`);
            for (const g of res.guides || []) {
              console.log(`  ${c("yellow", "●")} ${g.title} ${c("dim", `(nova emergency first-aid ${g.id})`)}`);
            }
          }
        } else {
          console.log(`  Usage:`);
          console.log(`    ${c("cyan", "nova emergency first-aid")}         List guides`);
          console.log(`    ${c("cyan", "nova emergency first-aid choking")} Specific guide`);
          console.log(`    ${c("cyan", "nova emergency contacts")}          Emergency numbers`);
        }
        break;
      }

      // ── Wellness ──
      case "wellness": {
        const sub = args[1]?.toLowerCase();
        if (sub === "mood") {
          const mood = parseInt(args[2]) || 3;
          const note = args.slice(3).join(" ");
          const res = await request("POST", "/nova/wellness/mood-checkin", { mood, note });
          if (res.crisis_detected) {
            console.log(`\n  ${c("red", c("bold", "⚠ We care about your safety"))}\n`);
            console.log(`  ${res.message}\n`);
            for (const r of res.resources || []) {
              console.log(`  ${c("bold", r.name)}: ${c("yellow", r.phone || r.url)}`);
            }
          } else {
            console.log(`  ${c("bold", "Mood:")} ${res.checkin?.mood_label} (${res.checkin?.mood}/5)`);
            console.log(`  ${c("green", res.response)}`);
          }
        } else if (sub === "breathing") {
          const res = await request("GET", "/nova/wellness/breathing");
          console.log(`  ${c("bold", "Breathing Exercises:")}\n`);
          for (const ex of res.exercises || []) {
            console.log(`  ${c("cyan", "●")} ${c("bold", ex.name)} — ${ex.description}`);
            console.log(`    ${c("dim", `${ex.cycles} cycles, ~${ex.total_seconds}s total`)}\n`);
          }
        } else {
          console.log(`  Usage:`);
          console.log(`    ${c("cyan", "nova wellness mood 4")} ${c("dim", '"feeling good today"')}`);
          console.log(`    ${c("cyan", "nova wellness breathing")}`);
        }
        break;
      }

      // ── Farm ──
      case "farm": {
        const text = args.slice(1).join(" ");
        if (!text) { console.log(c("red", "  Usage: nova farm \"crop or question\"")); return; }
        console.log(`  ${c("dim", "Getting farming advice...")}\n`);
        const res = await request("POST", "/nova/farm/crop-advice", { question: text });
        console.log(`  ${c("green", res.advice || res.error)}`);
        break;
      }

      // ── Legal ──
      case "legal": {
        const text = args.slice(1).join(" ");
        if (!text) { console.log(c("red", "  Usage: nova legal \"your question\"")); return; }
        console.log(`  ${c("dim", "Looking up legal information...")}\n`);
        const res = await request("POST", "/nova/legal/ask", { question: text });
        console.log(`  ${c("white", res.answer || res.error)}`);
        if (res.disclaimer) console.log(`\n  ${c("yellow", `⚠ ${res.disclaimer}`)}`);
        break;
      }

      // ── Orchestrate ──
      case "orchestrate": {
        const goal = args.slice(1).join(" ");
        if (!goal) { console.log(c("red", "  Usage: nova orchestrate \"complex goal\"")); return; }
        console.log(`  ${c("magenta", "✦")} ${c("bold", "Multi-Agent Orchestration")}`);
        console.log(`  ${c("dim", `Goal: ${goal}`)}\n`);
        const res = await request("POST", "/orchestrate", { goal });
        console.log(`  ${c("green", "✓")} Completed in ${c("bold", `${(res.duration_ms / 1000).toFixed(1)}s`)}`);
        console.log(`  ${c("dim", `Steps: ${res.totalSteps}, Iterations: ${res.totalIterations}`)}`);
        console.log(`  ${c("dim", `Agents used: ${(res.agents_used || []).join(", ")}`)}`);
        break;
      }

      // ── Default: Run Agent ──
      default: {
        const input = args.join(" ");
        console.log(`  ${c("magenta", "✦")} ${c("bold", "NOVA Agent")}`);
        console.log(`  ${c("dim", `Building: ${input}`)}\n`);
        const res = await request("POST", "/build", { input });
        if (res.success) {
          console.log(`  ${c("green", "✓")} ${res.summary || "Done"}`);
          if (res.preview_file) console.log(`  ${c("cyan", `Preview: ${BASE}/agent/output/${res.preview_file}`)}`);
          console.log(`  ${c("dim", `Steps: ${res.total_iterations || 0}`)}`);
        } else {
          console.log(`  ${c("red", "✗")} ${res.error || "Build failed"}`);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`  ${c("red", "✗")} ${err.message}`);
    if (err.message.includes("ECONNREFUSED")) {
      console.log(`  ${c("yellow", "→")} Is the NOVA backend running? Start it with: ${c("cyan", "cd backend && npm run dev")}`);
    }
  }
}

main();
