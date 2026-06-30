const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const REMINDERS_FILE = path.join(DATA_DIR, "reminders.json");

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REMINDERS_FILE)) fs.writeFileSync(REMINDERS_FILE, "[]", "utf-8");
}

function readReminders() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(REMINDERS_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReminders(reminders) {
  ensureStore();
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2), "utf-8");
}

function inferDueAt(text = "", from = new Date()) {
  const value = String(text).toLowerCase();
  const next = new Date(from);

  const timeMatch = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || 0);
    const meridiem = timeMatch[3];

    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (!meridiem && hour < 8) hour += 12;

    next.setHours(hour, minute, 0, 0);
  } else if (/\bmorning\b/.test(value)) {
    next.setHours(9, 0, 0, 0);
  } else if (/\b(afternoon|noon)\b/.test(value)) {
    next.setHours(13, 0, 0, 0);
  } else if (/\b(evening|tonight)\b/.test(value)) {
    next.setHours(18, 0, 0, 0);
  } else {
    return null;
  }

  if (/\btomorrow\b/.test(value)) {
    next.setDate(next.getDate() + 1);
  } else if (next <= from) {
    next.setDate(next.getDate() + 1);
  }

  return next.toISOString();
}

function titleFromStep(step = {}) {
  const text = String(step.description || step.goal || step.action || "Reminder").trim();
  return text
    .replace(/^create a reminder titled\s*/i, "")
    .replace(/^schedule a notification( for| at)?\s*/i, "")
    .replace(/^remind me to\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim() || "Reminder";
}

function createReminder(input = {}) {
  const now = new Date();
  const sourceText = String(input.sourceText || input.description || "").trim();
  const reminder = {
    id: randomUUID(),
    title: String(input.title || "Reminder").trim(),
    description: sourceText,
    dueAt: input.dueAt || inferDueAt(sourceText, now),
    status: "scheduled",
    source: input.source || "local_executor",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const reminders = readReminders();
  reminders.unshift(reminder);
  writeReminders(reminders);
  return reminder;
}

function createReminderFromStep(step = {}) {
  return createReminder({
    title: titleFromStep(step),
    description: step.description || step.action || "",
    source: "plan_step",
  });
}

function listReminders() {
  return readReminders();
}

function updateReminder(id, updates = {}) {
  const reminders = readReminders();
  const index = reminders.findIndex((reminder) => reminder.id === id);
  if (index < 0) return null;

  reminders[index] = {
    ...reminders[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  writeReminders(reminders);
  return reminders[index];
}

module.exports = {
  createReminder,
  createReminderFromStep,
  inferDueAt,
  listReminders,
  updateReminder,
};
