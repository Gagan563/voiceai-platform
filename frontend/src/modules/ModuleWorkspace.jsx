import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BadgeDollarSign,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Clapperboard,
  ClipboardList,
  GraduationCap,
  HeartPulse,
  Home,
  Languages,
  MessageCircle,
  Mic,
  Plane,
  Plus,
  Search,
  Sparkles,
  WalletCards,
} from "lucide-react";
import useAppStore from "@/store/appStore";

const moduleDefinitions = [
  { id: "chat", label: "Chat", icon: MessageCircle, accent: "text-aqua" },
  { id: "task", label: "Tasks", icon: ClipboardList, accent: "text-amber" },
  { id: "write", label: "Write", icon: Sparkles, accent: "text-brand" },
  { id: "search", label: "Search", icon: Search, accent: "text-aqua" },
  { id: "health", label: "Health", icon: HeartPulse, accent: "text-danger" },
  { id: "finance", label: "Finance", icon: WalletCards, accent: "text-leaf" },
  { id: "learn", label: "Learn", icon: GraduationCap, accent: "text-amber" },
  { id: "home", label: "Home", icon: Home, accent: "text-aqua" },
  { id: "travel", label: "Travel", icon: Plane, accent: "text-brand" },
  { id: "media", label: "Media", icon: Clapperboard, accent: "text-coral" },
  { id: "translate", label: "Translate", icon: Languages, accent: "text-leaf" },
  { id: "business", label: "Business", icon: BriefcaseBusiness, accent: "text-brand" },
];

const moduleCopy = {
  chat: {
    title: "Conversation",
    summary: "Ask follow-up questions, keep context, and turn answers into plans.",
    metrics: ["Context ready", "Markdown friendly", "Follow-up prompts"],
    suggestions: ["Explain this simply", "Give me next steps", "Turn this into a checklist"],
  },
  task: {
    title: "Tasks & Schedule",
    summary: "Create tasks, reminders, priorities, and calendar-ready plans.",
    metrics: ["Today", "Upcoming", "Recurring"],
    suggestions: ["Call doctor Friday 10am", "Renew passport next month", "Weekly review every Monday"],
  },
  write: {
    title: "Writing Studio",
    summary: "Draft emails, reports, posts, cover letters, and structured documents.",
    metrics: ["Tone", "Length", "Templates"],
    suggestions: ["Professional email reply", "Meeting summary", "Blog post outline"],
  },
  search: {
    title: "Research Desk",
    summary: "Search, compare sources, summarize findings, and save research notes.",
    metrics: ["Sources", "Citations", "Deep research"],
    suggestions: ["Latest AI agent news", "Compare two tools", "Find sources about voice AI"],
  },
  health: {
    title: "Wellness Tracker",
    summary: "Track symptoms, sleep, water, mood, medication, and exercise locally.",
    metrics: ["Sleep", "Mood", "Water"],
    suggestions: ["Log headache mild", "Track 7 hours sleep", "Medication reminder"],
  },
  finance: {
    title: "Personal Finance",
    summary: "Track spending, budgets, bills, income, and currency notes locally.",
    metrics: ["Budget", "Expenses", "Bills"],
    suggestions: ["Log lunch 12 dollars", "Set rent bill", "Food budget this month"],
  },
  learn: {
    title: "Learning Lab",
    summary: "Create lessons, quizzes, flashcards, and progress notes for any topic.",
    metrics: ["Lessons", "Quiz", "Flashcards"],
    suggestions: ["Teach me React hooks", "Quiz me on history", "Make flashcards"],
  },
  home: {
    title: "Smart Home",
    summary: "Control rooms, devices, and scenes; demo mode works without Home Assistant.",
    metrics: ["Rooms", "Scenes", "Devices"],
    suggestions: ["Turn off living room lights", "Movie scene", "Set thermostat to 22"],
  },
  travel: {
    title: "Travel Planner",
    summary: "Build itineraries, packing lists, phrasebooks, and trip budgets.",
    metrics: ["Itinerary", "Packing", "Budget"],
    suggestions: ["Plan 3 days in Tokyo", "Packing list for Goa", "Paris phrasebook"],
  },
  media: {
    title: "Media Hub",
    summary: "Get movie, book, music, podcast, YouTube, and news recommendations.",
    metrics: ["Music", "Movies", "Books"],
    suggestions: ["Movies like Interstellar", "Tech headlines", "Focus music"],
  },
  translate: {
    title: "Translator",
    summary: "Translate text, prepare phrases, and support voice-to-voice workflows.",
    metrics: ["50+ languages", "Phrases", "Pronunciation"],
    suggestions: ["Translate hello to Spanish", "Hindi travel phrases", "Conversation mode"],
  },
  business: {
    title: "Business Tools",
    summary: "Create CRM notes, invoices, reports, meeting summaries, and CSV insights.",
    metrics: ["CRM", "Invoices", "Reports"],
    suggestions: ["Summarize meeting", "Create invoice", "Analyze CSV"],
  },
};

const demoDevices = [
  { name: "Living room lights", state: "on" },
  { name: "Bedroom lamp", state: "off" },
  { name: "Thermostat", state: "22 C" },
];

function ModulePicker({ activeModule, setActiveModule }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 py-3">
      {moduleDefinitions.map((module) => {
        const Icon = module.icon;
        const selected = activeModule === module.id;

        return (
          <button
            key={module.id}
            type="button"
            onClick={() => setActiveModule(module.id)}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-[11px] font-semibold transition ${
              selected
                ? "border-brand/35 bg-brand/15 text-text"
                : "border-line bg-white/[0.03] text-text-muted hover:border-aqua/30 hover:text-text"
            }`}
          >
            <Icon className={`h-4 w-4 ${selected ? module.accent : ""}`} />
            {module.label}
          </button>
        );
      })}
    </div>
  );
}

function RecordList({ records }) {
  if (!records.length) {
    return (
      <div className="rounded-2xl border border-line bg-white/[0.035] p-4 text-sm leading-relaxed text-text-muted">
        No saved results in this module yet. Speak, type, or use a quick action below.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {records.map((record) => (
        <div key={record.id} className="rounded-2xl border border-line bg-white/[0.035] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text">{record.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                {record.summary}
              </p>
            </div>
            <span className="rounded-full border border-leaf/25 bg-leaf/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-leaf">
              {record.status}
            </span>
          </div>

          {record.steps?.length ? (
            <div className="mt-3 grid gap-1.5">
              {record.steps.slice(0, 4).map((step) => (
                <div
                  key={step}
                  className="flex items-start gap-2 rounded-xl border border-line bg-ink-950/35 px-2 py-1.5 text-[11px] text-text-soft"
                >
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-leaf" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function QuickAdd({ moduleId }) {
  const [value, setValue] = useState("");
  const addModuleRecord = useAppStore((state) => state.addModuleRecord);

  const add = (text) => {
    const clean = text.trim();
    if (!clean) return;

    addModuleRecord({
      id: `${moduleId}-${Date.now()}`,
      module: moduleId,
      title: clean,
      goal: clean,
      status: "ready",
      createdAt: new Date().toISOString(),
      summary: `Saved locally in ${moduleCopy[moduleId].title}.`,
      steps: [
        "Captured request",
        "Prepared local module entry",
        "Ready for follow-up execution",
      ],
    });
    setValue("");
  };

  return (
    <div className="rounded-2xl border border-line bg-panel/65 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
        <Plus className="h-3.5 w-3.5 text-aqua" />
        Quick action
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add(value);
          }}
          placeholder={`Add to ${moduleCopy[moduleId].title}...`}
          className="min-w-0 flex-1 rounded-xl border border-line bg-ink-950/50 px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-aqua/40"
        />
        <button
          type="button"
          onClick={() => add(value)}
          className="rounded-xl bg-brand px-3 text-xs font-bold text-white transition hover:brightness-110"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function ModuleBody({ moduleId, records }) {
  const copy = moduleCopy[moduleId] || moduleCopy.chat;

  if (moduleId === "home") {
    return (
      <div className="space-y-3">
        <div className="grid gap-2">
          {demoDevices.map((device) => (
            <div key={device.name} className="flex items-center justify-between rounded-xl border border-line bg-white/[0.035] px-3 py-2">
              <span className="text-sm font-semibold text-text-soft">{device.name}</span>
              <span className="rounded-full border border-aqua/25 bg-aqua/10 px-2 py-1 text-xs font-bold text-aqua">
                {device.state}
              </span>
            </div>
          ))}
        </div>
        <QuickAdd moduleId={moduleId} />
        <RecordList records={records} />
      </div>
    );
  }

  if (moduleId === "finance") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {["Food", "Bills", "Savings"].map((label, index) => (
            <div key={label} className="rounded-xl border border-line bg-white/[0.035] p-3">
              <BadgeDollarSign className="mb-2 h-4 w-4 text-leaf" />
              <p className="text-xs font-bold text-text">{label}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-leaf" style={{ width: `${45 + index * 18}%` }} />
              </div>
            </div>
          ))}
        </div>
        <QuickAdd moduleId={moduleId} />
        <RecordList records={records} />
      </div>
    );
  }

  if (moduleId === "health") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber/25 bg-amber/10 p-3 text-xs leading-relaxed text-amber">
          This is not medical advice. For urgent or serious symptoms, contact a doctor or emergency service.
        </div>
        <QuickAdd moduleId={moduleId} />
        <RecordList records={records} />
      </div>
    );
  }

  if (moduleId === "translate") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-line bg-white/[0.035] p-3">
            <Languages className="mb-2 h-4 w-4 text-leaf" />
            <p className="text-xs font-bold text-text">Conversation mode</p>
            <p className="mt-1 text-[11px] text-text-muted">Speak in one language and hear another.</p>
          </div>
          <div className="rounded-xl border border-line bg-white/[0.035] p-3">
            <Mic className="mb-2 h-4 w-4 text-aqua" />
            <p className="text-xs font-bold text-text">Voice ready</p>
            <p className="mt-1 text-[11px] text-text-muted">Uses the global Whisper recorder.</p>
          </div>
        </div>
        <QuickAdd moduleId={moduleId} />
        <RecordList records={records} />
      </div>
    );
  }

  if (moduleId === "learn") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {["Lesson", "Quiz", "Flashcards"].map((label) => (
            <div key={label} className="rounded-xl border border-line bg-white/[0.035] p-3">
              <BookOpen className="mb-2 h-4 w-4 text-amber" />
              <p className="text-xs font-bold text-text">{label}</p>
            </div>
          ))}
        </div>
        <QuickAdd moduleId={moduleId} />
        <RecordList records={records} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <QuickAdd moduleId={moduleId} />
      <div className="grid gap-2">
        {copy.suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="rounded-xl border border-line bg-white/[0.035] px-3 py-2 text-left text-xs font-semibold text-text-soft transition hover:border-aqua/30 hover:text-text"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <RecordList records={records} />
    </div>
  );
}

export default function ModuleWorkspace() {
  const activeModule = useAppStore((state) => state.activeModule);
  const setActiveModule = useAppStore((state) => state.setActiveModule);
  const moduleRecords = useAppStore((state) => state.moduleRecords);
  const activeDef = moduleDefinitions.find((module) => module.id === activeModule) || moduleDefinitions[0];
  const copy = moduleCopy[activeModule] || moduleCopy.chat;
  const records = useMemo(
    () => moduleRecords[activeModule] || [],
    [activeModule, moduleRecords]
  );
  const ActiveIcon = activeDef.icon;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      className="hidden min-h-0 border-l border-line bg-ink-950/35 xl:flex xl:flex-col"
    >
      <div className="shrink-0 border-b border-line px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/15 text-brand ring-1 ring-brand/25">
            <ActiveIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-text">{copy.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{copy.summary}</p>
          </div>
        </div>
      </div>

      <ModulePicker activeModule={activeModule} setActiveModule={setActiveModule} />

      <div className="grid grid-cols-3 gap-2 border-y border-line px-4 py-3">
        {copy.metrics.map((metric) => (
          <div key={metric} className="rounded-xl border border-line bg-white/[0.035] px-2 py-2 text-center text-[11px] font-bold text-text-soft">
            {metric}
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ModuleBody moduleId={activeModule} records={records} />
      </div>

      <div className="shrink-0 border-t border-line px-4 py-3">
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-white/[0.035] px-3 py-2 text-xs font-semibold text-text-muted">
          <Activity className="h-4 w-4 text-aqua" />
          {records.length} saved result{records.length === 1 ? "" : "s"} in this module
        </div>
      </div>
    </motion.aside>
  );
}
