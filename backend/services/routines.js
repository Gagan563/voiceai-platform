const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const ROUTINES_FILE = path.join(DATA_DIR, "routines.json");

let timer = null;
let running = false;

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ROUTINES_FILE)) fs.writeFileSync(ROUTINES_FILE, "[]", "utf-8");
}

function readRoutines() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(ROUTINES_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRoutines(routines) {
  ensureStore();
  fs.writeFileSync(ROUTINES_FILE, JSON.stringify(routines, null, 2), "utf-8");
}

function minutesFromTime(time = "09:00") {
  const [hour, minute] = String(time).split(":").map((value) => Number(value));
  return (Number.isFinite(hour) ? hour : 9) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function nextRunFor(routine, from = new Date()) {
  const next = new Date(from);
  const schedule = routine.schedule || "daily";

  if (schedule === "interval") {
    const minutes = Math.max(5, Number(routine.interval_minutes) || 60);
    return new Date(from.getTime() + minutes * 60 * 1000).toISOString();
  }

  const minutes = minutesFromTime(routine.time);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (next <= from) next.setDate(next.getDate() + 1);

  if (schedule === "weekly") {
    const day = Math.max(0, Math.min(6, Number(routine.day_of_week ?? 1)));
    while (next.getDay() !== day || next <= from) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next.toISOString();
}

function listRoutines() {
  return readRoutines();
}

function createRoutine(input = {}) {
  const now = new Date();
  const routine = {
    id: randomUUID(),
    name: String(input.name || "New routine").trim(),
    prompt: String(input.prompt || "").trim(),
    schedule: input.schedule || "daily",
    time: input.time || "09:00",
    interval_minutes: Number(input.interval_minutes) || 60,
    day_of_week: input.day_of_week ?? null,
    enabled: input.enabled !== false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    nextRunAt: null,
    lastRunAt: null,
    lastResult: null,
    runs: [],
  };

  if (!routine.prompt) throw new Error("Routine prompt is required.");
  routine.nextRunAt = nextRunFor(routine, now);

  const routines = readRoutines();
  routines.unshift(routine);
  writeRoutines(routines);
  return routine;
}

function updateRoutine(id, updates = {}) {
  const routines = readRoutines();
  const index = routines.findIndex((routine) => routine.id === id);
  if (index < 0) return null;

  const next = {
    ...routines[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  if (updates.enabled !== undefined) next.enabled = Boolean(updates.enabled);
  if (updates.prompt !== undefined) next.prompt = String(updates.prompt || "").trim();
  if (!next.prompt) throw new Error("Routine prompt is required.");
  next.nextRunAt = next.enabled ? nextRunFor(next) : null;

  routines[index] = next;
  writeRoutines(routines);
  return next;
}

function deleteRoutine(id) {
  const routines = readRoutines();
  const next = routines.filter((routine) => routine.id !== id);
  writeRoutines(next);
  return routines.length - next.length;
}

function recordRoutineRun(id, result) {
  const routines = readRoutines();
  const index = routines.findIndex((routine) => routine.id === id);
  if (index < 0) return null;

  const now = new Date();
  const run = {
    id: randomUUID(),
    at: now.toISOString(),
    status: result?.status || (result?.success === false ? "failed" : "ok"),
    result,
  };

  const routine = {
    ...routines[index],
    lastRunAt: run.at,
    lastResult: result,
    nextRunAt: routines[index].enabled ? nextRunFor(routines[index], now) : null,
    runs: [run, ...(routines[index].runs || [])].slice(0, 20),
  };

  routines[index] = routine;
  writeRoutines(routines);
  return routine;
}

function startRoutineScheduler(onDue) {
  if (timer) return;

  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      const due = readRoutines().filter(
        (routine) => routine.enabled && routine.nextRunAt && Date.parse(routine.nextRunAt) <= now
      );

      for (const routine of due) {
        try {
          const result = await onDue(routine);
          recordRoutineRun(routine.id, result);
        } catch (error) {
          recordRoutineRun(routine.id, {
            status: "failed",
            error: error.message,
          });
        }
      }
    } finally {
      running = false;
    }
  }, 60_000);
}

module.exports = {
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  recordRoutineRun,
  startRoutineScheduler,
  nextRunFor,
};
