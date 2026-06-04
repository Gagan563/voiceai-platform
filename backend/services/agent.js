const ai = require("./ai");
const { TOOL_DEFINITIONS, executeTool, clearWorkspace } = require("./tools");
const { recallMemory, extractFacts, saveMemory } = require("./memory");

const MAX_ITERATIONS = 18;

const AGENT_SYSTEM_PROMPT = `You are NOVA, an autonomous app-building agent with the judgment and tone of a senior human collaborator.

The user gives one command. You complete it without asking follow-up questions unless a legal, payment, credential, destructive, or developer approval action is required.
Work decisively, use sensible defaults, and keep summaries natural and specific.

Available tools:
${TOOL_DEFINITIONS.map(
  (tool) =>
    `### ${tool.name}
${tool.description}
Parameters: ${JSON.stringify(tool.parameters)}`
).join("\n\n")}

Return ONLY valid JSON:
{
  "thinking": "Short reason for this next step",
  "tool": "tool_name",
  "params": {}
}

Rules:
1. Do not ask for prompts again. Infer sensible defaults and build.
2. For web apps, create a complete runnable app in index.html with embedded CSS and JS, then call preview_html.
3. For calculator requests, create a fully working calculator, not a generic landing page.
4. For Android requests, generate a complete Android Gradle project: settings.gradle, root build.gradle, app/build.gradle, AndroidManifest.xml, MainActivity.kt, styles.xml, and README build/install instructions.
5. If Android SDK/Gradle is not available as a tool, still produce the complete project scaffold and explain the APK build command in the completion summary.
6. Always call complete when finished.
7. If a tool fails, try a simpler file structure and continue.
8. For computer access, use list_local_directory/read_local_file/write_local_file only when the user has configured approved local roots. If access is unavailable, finish with the best generated output and explain what permission is needed.
9. Never wrap JSON in markdown.`;

function inferBuildKind(input = "") {
  const value = input.toLowerCase();
  if (/\bandroid\b|\bapk\b|\bmobile app\b/.test(value)) return "android";
  if (/\bcalculator\b/.test(value)) return "calculator-web";
  return "web";
}

function calculatorHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VoxCalc</title>
  <link rel="manifest" href="manifest.webmanifest" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Inter, system-ui, sans-serif;
      background: radial-gradient(circle at 15% 10%, #273657, transparent 32%), #080b12;
      color: #f8fafc;
    }
    .calculator {
      width: min(390px, calc(100vw - 32px));
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 28px;
      padding: 22px;
      background: rgba(15,23,42,.86);
      box-shadow: 0 30px 90px rgba(0,0,0,.5);
      backdrop-filter: blur(18px);
    }
    .top { display: flex; justify-content: space-between; color: #94a3b8; font-size: 13px; font-weight: 800; margin-bottom: 18px; }
    .display {
      min-height: 120px;
      padding: 18px;
      border-radius: 22px;
      background: #050816;
      border: 1px solid rgba(255,255,255,.08);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: flex-end;
      overflow: hidden;
    }
    .expression { min-height: 22px; color: #94a3b8; font-size: 16px; word-break: break-all; }
    .result { font-size: 44px; font-weight: 800; letter-spacing: 0; word-break: break-all; }
    .keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 18px; }
    button {
      height: 64px;
      border: 0;
      border-radius: 18px;
      color: #f8fafc;
      background: #1e293b;
      font-size: 22px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      transition: transform .15s ease, filter .15s ease;
    }
    button:hover { transform: translateY(-2px); filter: brightness(1.12); }
    .op { background: #2563eb; }
    .soft { background: #334155; color: #cbd5e1; }
    .equals { grid-column: span 2; background: linear-gradient(135deg, #16a34a, #22c55e); color: #03120a; }
    .zero { grid-column: span 2; }
  </style>
</head>
<body>
  <main class="calculator">
    <div class="top"><span>VoxCalc</span><span>Installable PWA</span></div>
    <section class="display">
      <div class="expression" id="expression"></div>
      <div class="result" id="result">0</div>
    </section>
    <div class="keys">
      <button class="soft" data-action="clear">AC</button>
      <button class="soft" data-action="backspace">DEL</button>
      <button class="soft" data-value="%">%</button>
      <button class="op" data-value="/">/</button>
      <button data-value="7">7</button><button data-value="8">8</button><button data-value="9">9</button><button class="op" data-value="*">x</button>
      <button data-value="4">4</button><button data-value="5">5</button><button data-value="6">6</button><button class="op" data-value="-">-</button>
      <button data-value="1">1</button><button data-value="2">2</button><button data-value="3">3</button><button class="op" data-value="+">+</button>
      <button class="zero" data-value="0">0</button><button data-value=".">.</button><button class="equals" data-action="equals">=</button>
    </div>
  </main>
  <script>
    const expression = document.getElementById("expression");
    const result = document.getElementById("result");
    let current = "";
    const safe = (value) => /^[0-9+\\-*/%. ()]+$/.test(value);
    const render = () => {
      expression.textContent = current;
      result.textContent = current || "0";
    };
    document.querySelector(".keys").addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.value) current += button.dataset.value;
      if (button.dataset.action === "clear") current = "";
      if (button.dataset.action === "backspace") current = current.slice(0, -1);
      if (button.dataset.action === "equals") {
        try {
          current = safe(current) ? String(Function("return (" + current + ")")()) : "Error";
        } catch {
          current = "Error";
        }
      }
      render();
    });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  </script>
</body>
</html>`;
}

function webManifest() {
  return JSON.stringify(
    {
      name: "VoxCalc",
      short_name: "VoxCalc",
      start_url: "./index.html",
      display: "standalone",
      background_color: "#080b12",
      theme_color: "#2563eb",
      icons: [],
    },
    null,
    2
  );
}

function serviceWorker() {
  return `const CACHE = "voxcalc-v1";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["./index.html", "./manifest.webmanifest"])));
});
self.addEventListener("fetch", event => {
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
`;
}

function androidFiles(input) {
  const packageName = "com.voiceai.generated";
  return [
    {
      filename: "settings.gradle",
      content: `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }
rootProject.name = 'VoxMindGeneratedApp'
include ':app'
`,
    },
    {
      filename: "build.gradle",
      content: `plugins {
    id 'com.android.application' version '8.5.2' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.24' apply false
}
`,
    },
    {
      filename: "app/build.gradle",
      content: `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace '${packageName}'
    compileSdk 35
    defaultConfig {
        applicationId '${packageName}'
        minSdk 23
        targetSdk 35
        versionCode 1
        versionName '1.0'
    }
}
`,
    },
    {
      filename: "app/src/main/AndroidManifest.xml",
      content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:theme="@style/AppTheme" android:label="VoxMind App" android:allowBackup="true">
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
`,
    },
    {
      filename: "app/src/main/res/values/styles.xml",
      content: `<resources>
  <style name="AppTheme" parent="android:style/Theme.Material.Light.NoActionBar">
    <item name="android:fontFamily">sans</item>
    <item name="android:colorAccent">#2563eb</item>
  </style>
</resources>
`,
    },
    {
      filename: "app/src/main/java/com/voiceai/generated/MainActivity.kt",
      content: `package ${packageName}

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(32, 32, 32, 32)
            setBackgroundColor(Color.rgb(10, 15, 30))
        }
        val title = TextView(this).apply {
            text = "VoxMind Android App"
            textSize = 28f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        val body = TextView(this).apply {
            text = ${JSON.stringify(input)}
            textSize = 16f
            setTextColor(Color.rgb(203, 213, 225))
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 24)
        }
        val button = Button(this).apply { text = "Ready to install" }
        root.addView(title)
        root.addView(body)
        root.addView(button)
        setContentView(root)
    }
}
`,
    },
    {
      filename: "README.md",
      content: `# VoxMind Generated Android App

Generated from:

${input}

## Build the installable APK

Run this on a machine with Android SDK and Gradle configured:

\`\`\`bash
./gradlew assembleDebug
\`\`\`

APK output:

\`\`\`
app/build/outputs/apk/debug/app-debug.apk
\`\`\`
`,
    },
  ];
}

function mockAction(input, iteration) {
  const kind = inferBuildKind(input);

  if (iteration === 0) {
    return {
      thinking: `Planning the full build for: "${input.substring(0, 70)}"`,
      tool: "think",
      params: {
        thought:
          kind === "android"
            ? "Create a complete Android project scaffold with APK build instructions."
            : "Create a complete runnable web app and live preview.",
      },
    };
  }

  if (kind === "android") {
    const file = androidFiles(input)[iteration - 1];
    if (file) {
      return {
        thinking: `Writing ${file.filename}`,
        tool: "write_file",
        params: file,
      };
    }

    return {
      thinking: "Android project is complete",
      tool: "complete",
      params: {
        summary:
          "Generated a complete Android Gradle/Kotlin project. Build the APK with ./gradlew assembleDebug on a machine with Android SDK installed.",
        preview_file: null,
      },
    };
  }

  const webFiles = [
    { filename: "index.html", content: calculatorHtml() },
    { filename: "manifest.webmanifest", content: webManifest() },
    { filename: "sw.js", content: serviceWorker() },
  ];
  const file = webFiles[iteration - 1];

  if (file) {
    return {
      thinking: `Writing ${file.filename}`,
      tool: "write_file",
      params: file,
    };
  }

  if (iteration === webFiles.length + 1) {
    return {
      thinking: "Preparing live preview",
      tool: "preview_html",
      params: { filename: "index.html" },
    };
  }

  return {
    thinking: "Web app is complete",
    tool: "complete",
    params: {
      summary: "Built a complete installable PWA calculator with offline support and live preview.",
      preview_file: "index.html",
    },
  };
}

async function runAgent({ input, files = [], userId = "default-user", onStep }) {
  const emit = onStep || (() => {});
  const useMock = !ai.isAvailable();
  const steps = [];
  let finalResult = null;
  let isComplete = false;

  clearWorkspace();

  emit({
    type: "agent_start",
    message: `I am starting the build for: "${input.substring(0, 80)}"`,
    timestamp: Date.now(),
  });

  let memoryContext = "";
  try {
    const memories = await recallMemory(userId, input, 5);
    if (memories.length) {
      memoryContext = `\n\nUser memory:\n${memories.map((memory, index) => `${index + 1}. ${memory}`).join("\n")}`;
    }
  } catch (error) {
    console.warn("[Agent] Memory recall skipped:", error.message);
  }

  const fileContext = files.length
    ? `\n\nUploaded files: ${files.join(", ")}. Read them before building when relevant.`
    : "";

  const conversationHistory = [
    {
      role: "user",
      content: `${input}${fileContext}${memoryContext}`,
    },
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS && !isComplete; iteration += 1) {
    emit({
      type: "agent_thinking",
      iteration: iteration + 1,
      message: `Working through step ${iteration + 1}`,
      timestamp: Date.now(),
    });

    let action;

    if (useMock) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      action = mockAction(input, iteration);
    } else {
      const responseText = await ai.chatMultiTurn(AGENT_SYSTEM_PROMPT, conversationHistory, {
        task: "agent",
        maxTokens: 8192,
        temperature: 0.35,
      });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      action = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    }

    emit({
      type: "agent_step",
      iteration: iteration + 1,
      tool: action.tool,
      thinking: action.thinking,
      status: "running",
      timestamp: Date.now(),
    });

    let toolResult;
    try {
      toolResult = await executeTool(action.tool, action.params || {});
    } catch (error) {
      toolResult = { success: false, error: error.message };
    }

    steps.push({
      iteration: iteration + 1,
      tool: action.tool,
      thinking: action.thinking,
      params: action.params,
      result: toolResult,
      timestamp: Date.now(),
    });

    emit({
      type: action.tool === "preview_html" ? "agent_preview" : "agent_step",
      iteration: iteration + 1,
      tool: action.tool,
      thinking: action.thinking,
      result: toolResult,
      filename: action.params?.filename,
      status: toolResult.success ? "done" : "error",
      timestamp: Date.now(),
    });

    if (action.tool === "complete") {
      isComplete = true;
      finalResult = toolResult;
      break;
    }

    if (!useMock) {
      conversationHistory.push({ role: "assistant", content: JSON.stringify(action) });
      conversationHistory.push({
        role: "user",
        content: `Tool result: ${JSON.stringify(toolResult)}. Continue with the next JSON tool call.`,
      });
    }
  }

  const result = {
    success: isComplete,
    summary: finalResult?.summary || "Build finished.",
    preview_file: finalResult?.preview_file || null,
    steps,
    total_iterations: steps.length,
  };

  emit({
    type: "agent_complete",
    ...result,
    timestamp: Date.now(),
  });

  setImmediate(async () => {
    try {
      const facts = await extractFacts(`User asked: ${input}\nAgent built: ${result.summary}`);
      await Promise.all(facts.map((fact) => saveMemory(userId, fact)));
    } catch (error) {
      console.warn("[Agent] Fact extraction skipped:", error.message);
    }
  });

  return result;
}

module.exports = { runAgent };
