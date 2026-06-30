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

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

function inferDueAt(text = "", from = new Date()) {
  const value = String(text).toLowerCase();
  const next = new Date(from);
  let hasExplicitDate = false;

  const isoDate = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  const slashDate = value.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);

  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    if (!isValidDateParts(year, month, day)) return null;
    next.setFullYear(year, month - 1, day);
    hasExplicitDate = true;
  } else if (slashDate) {
    const year = slashDate[3]
      ? Number(slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3])
      : from.getFullYear();
    const month = Number(slashDate[1]);
    const day = Number(slashDate[2]);
    if (!isValidDateParts(year, month, day)) return null;
    next.setFullYear(year, month - 1, day);
    hasExplicitDate = true;
  } else if (/\btoday\b/.test(value)) {
    hasExplicitDate = true;
  } else if (/\btomorrow\b/.test(value)) {
    next.setDate(next.getDate() + 1);
    hasExplicitDate = true;
  }

  const timeMatch = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (timeMatch) {
    let hour = Number(timeMatch[1] || timeMatch[4]);
    const minute = Number(timeMatch[2] || timeMatch[5] || 0);
    const meridiem = timeMatch[3];
    if (minute > 59 || (meridiem && (hour < 1 || hour > 12)) || (!meridiem && hour > 23)) return null;

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

  if (next <= from && hasExplicitDate) {
    return null;
  }
  if (next <= from) {
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
    userId: input.userId,
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

function createReminderFromStep(step = {}, userId) {
  return createReminder({
    userId,
    title: titleFromStep(step),
    description: step.description || step.action || "",
    source: "plan_step",
  });
}

function listReminders(userId) {
  return readReminders().filter((reminder) => !userId || reminder.userId === userId);
}

function updateReminder(id, updates = {}, userId) {
  const reminders = readReminders();
  const index = reminders.findIndex((reminder) => reminder.id === id && (!userId || reminder.userId === userId));
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
