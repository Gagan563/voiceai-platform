const ai = require("./ai");
const { TOOL_DEFINITIONS, executeTool, clearWorkspace } = require("./tools");
const { recallMemory, extractFacts, saveMemory } = require("./memory");
const config = require("../config");

const MAX_ITERATIONS = 18;

function errorMessage(error, fallback = "Unexpected error") {
  return error instanceof Error ? error.message : fallback;
}

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
  if (/\bgame\b|\bplatformer\b|\bpuzzle\b|\barcade\b|\bsnake\b|\btic[- ]?tac[- ]?toe\b/.test(value)) return "game-web";
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

function weatherHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SkyCast Weather</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #101828, #143d59 48%, #f6b17a);
      color: #f8fafc;
    }
    main {
      width: min(1120px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
    }
    h1 { margin: 0; font-size: clamp(28px, 5vw, 56px); letter-spacing: 0; }
    .search {
      display: flex;
      gap: 8px;
      width: min(420px, 100%);
      padding: 8px;
      border: 1px solid rgba(255,255,255,.22);
      border-radius: 14px;
      background: rgba(15,23,42,.45);
      backdrop-filter: blur(16px);
    }
    input, button {
      font: inherit;
      border: 0;
      border-radius: 10px;
    }
    input {
      min-width: 0;
      flex: 1;
      padding: 12px;
      color: #f8fafc;
      background: rgba(255,255,255,.08);
      outline: none;
    }
    button {
      padding: 0 16px;
      font-weight: 800;
      color: #07111f;
      background: #7dd3fc;
      cursor: pointer;
    }
    .hero, .card {
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(15,23,42,.52);
      box-shadow: 0 24px 80px rgba(0,0,0,.28);
      backdrop-filter: blur(18px);
    }
    .hero {
      display: grid;
      grid-template-columns: 1.2fr .8fr;
      gap: 24px;
      border-radius: 24px;
      padding: 28px;
    }
    .temp { font-size: clamp(72px, 13vw, 150px); font-weight: 900; line-height: .9; }
    .condition { margin-top: 8px; color: #bae6fd; font-size: 20px; font-weight: 800; }
    .meta { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 10px; }
    .pill { padding: 10px 12px; border-radius: 999px; background: rgba(255,255,255,.1); color: #dbeafe; font-weight: 700; }
    .side { display: grid; gap: 12px; }
    .card { border-radius: 18px; padding: 18px; }
    .label { color: #cbd5e1; font-size: 13px; font-weight: 800; text-transform: uppercase; }
    .value { margin-top: 6px; font-size: 28px; font-weight: 900; }
    .forecast {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .day { min-height: 150px; display: flex; flex-direction: column; justify-content: space-between; }
    .icon { font-size: 36px; }
    @media (max-width: 780px) {
      header, .hero { grid-template-columns: 1fr; flex-direction: column; align-items: stretch; }
      .forecast { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>SkyCast</h1>
        <p id="subtitle">Live-style weather dashboard for Bengaluru</p>
      </div>
      <form class="search" id="searchForm">
        <input id="cityInput" placeholder="Search city" value="Bengaluru" />
        <button type="submit">Update</button>
      </form>
    </header>
    <section class="hero">
      <div>
        <div class="temp" id="temp">27°</div>
        <div class="condition" id="condition">Partly cloudy</div>
        <div class="meta">
          <span class="pill" id="feels">Feels like 29°</span>
          <span class="pill" id="wind">Wind 13 km/h</span>
          <span class="pill" id="humidity">Humidity 68%</span>
        </div>
      </div>
      <div class="side">
        <article class="card"><div class="label">Air quality</div><div class="value">Good</div></article>
        <article class="card"><div class="label">Sunset</div><div class="value">6:49 PM</div></article>
      </div>
    </section>
    <section class="forecast" id="forecast"></section>
  </main>
  <script>
    const data = {
      Bengaluru: { temp: 27, condition: "Partly cloudy", feels: 29, wind: 13, humidity: 68 },
      Mumbai: { temp: 30, condition: "Humid with showers", feels: 35, wind: 18, humidity: 82 },
      Delhi: { temp: 34, condition: "Hazy sunshine", feels: 37, wind: 10, humidity: 42 },
      London: { temp: 18, condition: "Light rain", feels: 17, wind: 21, humidity: 74 },
      Tokyo: { temp: 26, condition: "Clear evening", feels: 27, wind: 9, humidity: 60 }
    };
    const days = ["Today", "Tue", "Wed", "Thu", "Fri"];
    function render(city) {
      const weather = data[city] || data.Bengaluru;
      document.getElementById("subtitle").textContent = "Live-style weather dashboard for " + city;
      document.getElementById("temp").textContent = weather.temp + "°";
      document.getElementById("condition").textContent = weather.condition;
      document.getElementById("feels").textContent = "Feels like " + weather.feels + "°";
      document.getElementById("wind").textContent = "Wind " + weather.wind + " km/h";
      document.getElementById("humidity").textContent = "Humidity " + weather.humidity + "%";
      document.getElementById("forecast").innerHTML = days.map((day, index) => {
        const temp = weather.temp + index - 1;
        const icon = index % 3 === 0 ? "☀" : index % 3 === 1 ? "☁" : "☂";
        return '<article class="card day"><strong>' + day + '</strong><span class="icon">' + icon + '</span><span>' + temp + '° / ' + (temp - 5) + '°</span></article>';
      }).join("");
    }
    document.getElementById("searchForm").addEventListener("submit", event => {
      event.preventDefault();
      const raw = document.getElementById("cityInput").value.trim();
      const city = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      render(city || "Bengaluru");
    });
    render("Bengaluru");
  </script>
</body>
</html>`;
}

function weatherHtmlFixed() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SkyCast Weather</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #101828, #143d59 48%, #f6b17a);
      color: #f8fafc;
    }
    main { width: min(1120px, calc(100vw - 32px)); margin: 0 auto; padding: 28px 0; }
    header {
      display: grid;
      grid-template-columns: 1fr minmax(280px, 420px);
      align-items: start;
      gap: 16px;
      margin-bottom: 24px;
    }
    h1 { margin: 0; font-size: clamp(28px, 5vw, 56px); letter-spacing: 0; }
    .search {
      display: flex;
      gap: 8px;
      width: 100%;
      padding: 8px;
      border: 1px solid rgba(255,255,255,.22);
      border-radius: 14px;
      background: rgba(15,23,42,.45);
      backdrop-filter: blur(16px);
    }
    input, button { font: inherit; border: 0; border-radius: 10px; }
    input {
      min-width: 0;
      flex: 1;
      padding: 12px;
      color: #f8fafc;
      background: rgba(255,255,255,.08);
      outline: none;
    }
    button {
      padding: 0 16px;
      font-weight: 800;
      color: #07111f;
      background: #7dd3fc;
      cursor: pointer;
      transition: transform .15s ease, filter .15s ease;
    }
    button:hover { transform: translateY(-1px); filter: brightness(1.08); }
    .status {
      grid-column: 2;
      margin: -6px 0 0;
      min-height: 20px;
      color: #bae6fd;
      font-size: 14px;
      font-weight: 700;
    }
    .hero, .card {
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(15,23,42,.52);
      box-shadow: 0 24px 80px rgba(0,0,0,.28);
      backdrop-filter: blur(18px);
    }
    .hero {
      display: grid;
      grid-template-columns: 1.2fr .8fr;
      gap: 24px;
      border-radius: 24px;
      padding: 28px;
    }
    .temp { font-size: clamp(72px, 13vw, 150px); font-weight: 900; line-height: .9; }
    .condition { margin-top: 8px; color: #bae6fd; font-size: 20px; font-weight: 800; }
    .meta { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 10px; }
    .pill { padding: 10px 12px; border-radius: 999px; background: rgba(255,255,255,.1); color: #dbeafe; font-weight: 700; }
    .side { display: grid; gap: 12px; }
    .card { border-radius: 18px; padding: 18px; }
    .label { color: #cbd5e1; font-size: 13px; font-weight: 800; text-transform: uppercase; }
    .value { margin-top: 6px; font-size: 28px; font-weight: 900; }
    .forecast { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
    .day { min-height: 150px; display: flex; flex-direction: column; justify-content: space-between; }
    .icon { font-size: 20px; font-weight: 900; color: #bae6fd; }
    @media (max-width: 780px) {
      header, .hero { grid-template-columns: 1fr; }
      .status { grid-column: 1; }
      .forecast { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>SkyCast</h1>
        <p id="subtitle">Live-style weather dashboard for Bengaluru</p>
      </div>
      <form class="search" id="searchForm">
        <input id="cityInput" placeholder="Search city" value="Bengaluru" />
        <button type="submit">Update</button>
      </form>
      <p class="status" id="status" aria-live="polite"></p>
    </header>

    <section class="hero">
      <div>
        <div class="temp" id="temp">27&deg;</div>
        <div class="condition" id="condition">Partly cloudy</div>
        <div class="meta">
          <span class="pill" id="feels">Feels like 29&deg;</span>
          <span class="pill" id="wind">Wind 13 km/h</span>
          <span class="pill" id="humidity">Humidity 68%</span>
        </div>
      </div>
      <div class="side">
        <article class="card"><div class="label">Air quality</div><div class="value" id="airQuality">Good</div></article>
        <article class="card"><div class="label">Sunset</div><div class="value" id="sunset">6:49 PM</div></article>
      </div>
    </section>

    <section class="forecast" id="forecast"></section>
  </main>

  <script>
    const data = {
      Bengaluru: { temp: 27, condition: "Partly cloudy", feels: 29, wind: 13, humidity: 68, air: "Good", sunset: "6:49 PM" },
      Mumbai: { temp: 30, condition: "Humid with showers", feels: 35, wind: 18, humidity: 82, air: "Moderate", sunset: "7:18 PM" },
      Delhi: { temp: 34, condition: "Hazy sunshine", feels: 37, wind: 10, humidity: 42, air: "Poor", sunset: "7:23 PM" },
      London: { temp: 18, condition: "Light rain", feels: 17, wind: 21, humidity: 74, air: "Good", sunset: "9:19 PM" },
      Tokyo: { temp: 26, condition: "Clear evening", feels: 27, wind: 9, humidity: 60, air: "Good", sunset: "7:01 PM" }
    };
    const days = ["Today", "Tue", "Wed", "Thu", "Fri"];
    const degree = "\\u00B0";

    function findCity(raw) {
      const normalized = raw.trim().toLowerCase();
      return Object.keys(data).find((city) => city.toLowerCase() === normalized);
    }

    function render(city, requestedCity = city) {
      const known = Boolean(data[city]);
      const shownCity = known ? city : "Bengaluru";
      const weather = data[shownCity];
      const status = document.getElementById("status");

      status.textContent = known
        ? "Showing sample weather for " + shownCity + "."
        : requestedCity + " is not in this demo yet. Try Bengaluru, Mumbai, Delhi, London, or Tokyo.";

      document.getElementById("subtitle").textContent = "Live-style weather dashboard for " + shownCity;
      document.getElementById("temp").textContent = weather.temp + degree;
      document.getElementById("condition").textContent = weather.condition;
      document.getElementById("feels").textContent = "Feels like " + weather.feels + degree;
      document.getElementById("wind").textContent = "Wind " + weather.wind + " km/h";
      document.getElementById("humidity").textContent = "Humidity " + weather.humidity + "%";
      document.getElementById("airQuality").textContent = weather.air;
      document.getElementById("sunset").textContent = weather.sunset;

      document.getElementById("forecast").innerHTML = days.map((day, index) => {
        const temp = weather.temp + index - 1;
        const icon = index % 3 === 0 ? "Sunny" : index % 3 === 1 ? "Cloudy" : "Rain";
        return '<article class="card day"><strong>' + day + '</strong><span class="icon">' + icon + '</span><span>' + temp + degree + ' / ' + (temp - 5) + degree + '</span></article>';
      }).join("");
    }

    document.getElementById("searchForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const raw = document.getElementById("cityInput").value.trim();
      const city = findCity(raw || "Bengaluru");
      render(city || "Bengaluru", raw || "Bengaluru");
    });

    render("Bengaluru");
  </script>
</body>
</html>`;
}

function gameHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Star Runner</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at 20% 10%, #274472, transparent 34%), linear-gradient(135deg, #08111f, #152238 58%, #432818);
      color: #f8fafc;
      overflow: hidden;
    }
    .shell {
      width: min(920px, calc(100vw - 28px));
      display: grid;
      gap: 14px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    h1 { margin: 0; font-size: clamp(28px, 5vw, 48px); letter-spacing: 0; }
    .stats { display: flex; gap: 10px; flex-wrap: wrap; }
    .pill {
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 999px;
      background: rgba(15,23,42,.58);
      padding: 10px 14px;
      font-weight: 800;
      backdrop-filter: blur(14px);
    }
    canvas {
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 22px;
      background: #07111f;
      box-shadow: 0 26px 90px rgba(0,0,0,.4);
    }
    .controls {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: #cbd5e1;
      font-weight: 700;
    }
    button {
      border: 0;
      border-radius: 12px;
      background: #7dd3fc;
      color: #07111f;
      padding: 12px 16px;
      font: inherit;
      font-weight: 900;
      cursor: pointer;
    }
    @media (max-width: 720px) {
      header, .controls { flex-direction: column; align-items: stretch; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <h1>Star Runner</h1>
      <div class="stats">
        <span class="pill">Score <b id="score">0</b></span>
        <span class="pill">Best <b id="best">0</b></span>
      </div>
    </header>
    <canvas id="game" width="960" height="540" aria-label="Star Runner game canvas"></canvas>
    <div class="controls">
      <span>Move with arrow keys or A/D. Collect stars, avoid comets.</span>
      <button id="restart">Restart</button>
    </div>
  </main>
  <script>
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const scoreEl = document.getElementById("score");
    const bestEl = document.getElementById("best");
    const keys = new Set();
    let best = Number(localStorage.getItem("star-runner-best") || 0);
    let score = 0;
    let running = true;
    let player, stars, comets, frame;
    bestEl.textContent = best;

    function reset() {
      player = { x: 430, y: 455, w: 72, h: 28, speed: 8 };
      stars = Array.from({ length: 5 }, () => spawn("star"));
      comets = Array.from({ length: 4 }, () => spawn("comet"));
      score = 0;
      frame = 0;
      running = true;
      scoreEl.textContent = score;
    }

    function spawn(type) {
      return {
        type,
        x: Math.random() * 900 + 20,
        y: -Math.random() * 480,
        r: type === "star" ? 13 : 18,
        speed: type === "star" ? 2.4 + Math.random() * 2.2 : 3.2 + Math.random() * 3.2
      };
    }

    function hit(a, b) {
      return b.x > a.x - b.r && b.x < a.x + a.w + b.r && b.y > a.y - b.r && b.y < a.y + a.h + b.r;
    }

    function drawShip() {
      ctx.save();
      ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
      ctx.fillStyle = "#7dd3fc";
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(36, 22);
      ctx.lineTo(0, 8);
      ctx.lineTo(-36, 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-8, -3, 16, 14);
      ctx.restore();
    }

    function draw() {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#07111f");
      gradient.addColorStop(1, "#172554");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "rgba(255,255,255,.55)";
      for (let i = 0; i < 70; i++) {
        const x = (i * 137 + frame * .7) % canvas.width;
        const y = (i * 73 + frame * 1.4) % canvas.height;
        ctx.fillRect(x, y, 2, 2);
      }

      for (const item of stars) {
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const item of comets) {
        ctx.fillStyle = "#fb7185";
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(251,113,133,.25)";
        ctx.fillRect(item.x - 4, item.y - 50, 8, 38);
      }
      drawShip();

      if (!running) {
        ctx.fillStyle = "rgba(2,6,23,.72)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#f8fafc";
        ctx.font = "900 54px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 12);
        ctx.font = "700 22px Inter, sans-serif";
        ctx.fillText("Press Restart to play again", canvas.width / 2, canvas.height / 2 + 34);
      }
    }

    function update() {
      frame++;
      if (running) {
        if (keys.has("ArrowLeft") || keys.has("a")) player.x -= player.speed;
        if (keys.has("ArrowRight") || keys.has("d")) player.x += player.speed;
        player.x = Math.max(20, Math.min(canvas.width - player.w - 20, player.x));

        for (const item of [...stars, ...comets]) {
          item.y += item.speed;
          if (item.y > canvas.height + 40) Object.assign(item, spawn(item.type));
          if (hit(player, item)) {
            if (item.type === "star") {
              score += 10;
              scoreEl.textContent = score;
              Object.assign(item, spawn(item.type));
            } else {
              running = false;
              best = Math.max(best, score);
              localStorage.setItem("star-runner-best", String(best));
              bestEl.textContent = best;
            }
          }
        }
      }
      draw();
      requestAnimationFrame(update);
    }

    window.addEventListener("keydown", event => keys.add(event.key));
    window.addEventListener("keyup", event => keys.delete(event.key));
    document.getElementById("restart").addEventListener("click", reset);
    reset();
    update();
  </script>
</body>
</html>`;
}

function genericWebAppHtml(input) {
  const title = String(input || "Generated App")
    .replace(/\b(build|create|make|generate|develop)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Generated App";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: Inter, system-ui, sans-serif; background: #0f172a; color: #f8fafc; }
    main { width: min(980px, calc(100vw - 32px)); margin: 0 auto; padding: 48px 0; }
    h1 { font-size: clamp(36px, 7vw, 76px); letter-spacing: 0; margin: 0 0 14px; }
    p { color: #cbd5e1; font-size: 18px; line-height: 1.7; }
    .panel { margin-top: 28px; border: 1px solid rgba(255,255,255,.12); border-radius: 22px; background: rgba(15,23,42,.72); padding: 24px; box-shadow: 0 24px 80px rgba(0,0,0,.35); }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; }
    .card { border-radius: 16px; background: rgba(255,255,255,.08); padding: 18px; min-height: 120px; }
    button { border: 0; border-radius: 12px; background: #7dd3fc; color: #07111f; padding: 12px 16px; font: inherit; font-weight: 900; cursor: pointer; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>A working single-page prototype generated from your request. Use this as the first live preview, then ask for edits.</p>
    <section class="panel">
      <button id="action">Try it</button>
      <div class="grid">
        <article class="card"><strong>Fast</strong><p>Ready to preview instantly.</p></article>
        <article class="card"><strong>Responsive</strong><p>Designed for desktop and mobile.</p></article>
        <article class="card"><strong>Editable</strong><p>Ask NOVA to change behavior or styling.</p></article>
      </div>
    </section>
  </main>
  <script>
    document.getElementById("action").addEventListener("click", () => {
      alert("Prototype is running.");
    });
  </script>
</body>
</html>`;
}

function webManifest(appName = "VoxCalc", themeColor = "#2563eb") {
  return JSON.stringify(
    {
      name: appName,
      short_name: appName,
      start_url: "./index.html",
      display: "standalone",
      background_color: "#080b12",
      theme_color: themeColor,
      icons: [],
    },
    null,
    2
  );
}

function serviceWorker() {
  return `const CACHE = "nova-preview-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
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
  const isWeather = /\bweather\b/i.test(input);
  const isGame = kind === "game-web";

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

  const html = isWeather
    ? weatherHtmlFixed()
    : isGame
      ? gameHtml()
      : kind === "calculator-web"
        ? calculatorHtml()
        : genericWebAppHtml(input);
  const appName = isWeather ? "SkyCast" : isGame ? "Star Runner" : kind === "calculator-web" ? "VoxCalc" : "Generated App";
  const themeColor = isWeather || isGame ? "#7dd3fc" : "#2563eb";
  const webFiles = [
    { filename: "index.html", content: html },
    { filename: "manifest.webmanifest", content: webManifest(appName, themeColor) },
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
      summary: isWeather
        ? "Built a complete responsive weather application with city search, current conditions, and forecast cards."
        : isGame
          ? "Built a complete browser game with keyboard controls, scoring, collision, and restart."
          : kind === "calculator-web"
            ? "Built a complete installable PWA calculator with offline support and live preview."
            : "Built a complete responsive web app preview from the request.",
      preview_file: "index.html",
    },
  };
}

async function getNextAction({ input, iteration, useMock, conversationHistory }) {
  if (useMock) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return mockAction(input, iteration);
  }

  try {
    const responseText = await ai.chatMultiTurn(AGENT_SYSTEM_PROMPT, conversationHistory, {
      task: "agent",
      maxTokens: 8192,
      temperature: 0.35,
    });
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
  } catch (error) {
    console.warn("[Agent] AI action fallback:", errorMessage(error));
    return mockAction(input, iteration);
  }
}

async function runAgent({ input, files = [], userId = config.DEFAULT_USER_ID, onStep }) {
  const emit = onStep || (() => {});
  const useMock = !ai.isAvailable();
  const steps = [];
  let finalResult = null;
  let isComplete = false;

  clearWorkspace(userId);

  emit({
    type: "agent_start",
    message: "I am starting the build.",
    timestamp: Date.now(),
  });

  let memoryContext = "";
  try {
    const memories = await recallMemory(userId, input, 5);
    if (memories.length) {
      memoryContext = `\n\nUser memory:\n${memories.map((memory, index) => `${index + 1}. ${memory}`).join("\n")}`;
    }
  } catch (error) {
    console.warn("[Agent] Memory recall skipped:", errorMessage(error));
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

    const action = await getNextAction({ input, iteration, useMock, conversationHistory });

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
      toolResult = await executeTool(action.tool, action.params || {}, { userId });
    } catch (error) {
      toolResult = { success: false, error: errorMessage(error) };
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
      console.warn("[Agent] Fact extraction skipped:", errorMessage(error));
    }
  });

  return result;
}

module.exports = { runAgent };
