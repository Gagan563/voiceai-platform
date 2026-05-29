import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AudioLines,
  Bot,
  CheckCircle2,
  CircleAlert,
  DatabaseZap,
  History,
  MessageSquareText,
  Network,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import ConversationView from "@/components/ConversationView";
import InputBar from "@/components/InputBar";
import PlanCards from "@/components/PlanCards";
import { healthCheck } from "@/api/client";
import useAppStore from "@/store/appStore";
import "./App.css";

const promptChips = [
  "Schedule a meeting with Sarah tomorrow at 3pm",
  "Create a launch checklist for the voice assistant",
  "Remind me to review the demo notes Friday morning",
];

const sidebarItems = [
  { label: "Intent engine", icon: Sparkles, color: "text-brand" },
  { label: "Plan builder", icon: Network, color: "text-aqua" },
  { label: "Execution queue", icon: DatabaseZap, color: "text-amber" },
  { label: "Policy checks", icon: ShieldCheck, color: "text-leaf" },
];

function StatusPill({ online }) {
  const status = useMemo(() => {
    if (online === null) {
      return {
        label: "Checking",
        icon: Activity,
        className: "text-text-muted border-line bg-white/[0.04]",
      };
    }

    if (online) {
      return {
        label: "Online",
        icon: Wifi,
        className: "text-leaf border-leaf/25 bg-leaf/10",
      };
    }

    return {
      label: "Offline",
      icon: WifiOff,
      className: "text-danger border-danger/25 bg-danger/10",
    };
  }, [online]);

  const Icon = status.icon;

  return (
    <div
      className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${status.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {status.label}
    </div>
  );
}

function Sidebar({ backendOnline, onPrompt }) {
  return (
    <aside className="hidden min-h-0 border-r border-line bg-ink-950/55 px-4 py-5 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-text text-ink-950 shadow-lg shadow-black/20">
          <AudioLines className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-base font-semibold tracking-[0.01em] text-text">
            VoxMind
          </h1>
          <p className="text-xs font-medium text-text-muted">
            Voice control workspace
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-panel/70 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Backend
          </span>
          <StatusPill online={backendOnline} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-xl border border-line bg-white/[0.035] p-3"
              >
                <Icon className={`mb-3 h-4 w-4 ${item.color}`} />
                <p className="text-xs font-semibold leading-snug text-text-soft">
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
          <MessageSquareText className="h-3.5 w-3.5" />
          Prompts
        </div>
        {promptChips.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="w-full rounded-xl border border-line bg-panel/60 px-3 py-3 text-left text-xs font-medium leading-relaxed text-text-soft transition hover:border-aqua/35 hover:bg-aqua/10 hover:text-text"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-auto rounded-2xl border border-line bg-panel/70 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-soft">
          <History className="h-4 w-4 text-coral" />
          Local session
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-muted">
          Conversation state stays in this browser session.
        </p>
      </div>
    </aside>
  );
}

export default function App() {
  const [backendOnline, setBackendOnline] = useState(null);
  const messages = useAppStore((s) => s.messages);
  const currentPlan = useAppStore((s) => s.currentPlan);
  const isLoading = useAppStore((s) => s.isLoading);
  const processUserInput = useAppStore((s) => s.processUserInput);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const settings = useAppStore((s) => s.settings);
  const toggleTtsEnabled = useAppStore((s) => s.toggleTtsEnabled);
  const toggleTtsMode = useAppStore((s) => s.toggleTtsMode);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await healthCheck();
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handlePrompt = (prompt) => {
    if (!isLoading) {
      processUserInput(prompt);
    }
  };

  return (
    <div className="App workspace-grid h-full bg-ink-950 text-text">
      <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
        <Sidebar backendOnline={backendOnline} onPrompt={handlePrompt} />

        <main className="flex min-h-0 flex-col">
          <header className="shrink-0 border-b border-line bg-ink-950/55 px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-panel-raised ring-1 ring-line lg:hidden">
                  <Bot className="h-5 w-5 text-aqua" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-text sm:text-base">
                    VoxMind console
                  </p>
                  <div className="mt-1 hidden items-center gap-2 text-xs text-text-muted sm:flex">
                    <Zap className="h-3.5 w-3.5 text-amber" />
                    Intent to plan to execution
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* TTS Toggle */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={toggleTtsEnabled}
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
                    settings.ttsEnabled
                      ? "border-brand/25 bg-brand/10 text-brand"
                      : "border-line bg-white/[0.04] text-text-muted"
                  }`}
                  title={settings.ttsEnabled ? "Turn TTS off" : "Turn TTS on"}
                >
                  {settings.ttsEnabled ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                  TTS
                </motion.button>

                {/* TTS Mode Toggle (only visible when TTS is on) */}
                {settings.ttsEnabled && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={toggleTtsMode}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-3 text-xs font-semibold text-text-muted transition hover:border-brand/25 hover:text-text"
                    title="Switch TTS engine"
                  >
                    {settings.ttsMode === "browser" ? "Browser" : "ElevenLabs"}
                  </motion.button>
                )}

                <StatusPill online={backendOnline} />
                {messages.length > 0 && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={clearMessages}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white/[0.04] text-text-muted transition hover:border-danger/30 hover:bg-danger/10 hover:text-danger"
                    title="Clear conversation"
                    aria-label="Clear conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                )}
              </div>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="flex min-h-0 flex-col">
              <ConversationView prompts={promptChips} onPrompt={handlePrompt} />
              <InputBar />
            </section>

            <AnimatePresence mode="wait">
              {currentPlan?.length ? <PlanCards key="plan-panel" /> : null}
            </AnimatePresence>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {backendOnline === false && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-danger/25 bg-danger/15 px-4 py-2 text-xs font-semibold text-danger shadow-2xl shadow-black/30 backdrop-blur-xl"
          >
            <CircleAlert className="h-4 w-4" />
            Backend server is offline on port 3001.
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {backendOnline === true && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="pointer-events-none fixed bottom-4 right-4 hidden items-center gap-2 rounded-full border border-leaf/25 bg-leaf/10 px-3 py-2 text-xs font-semibold text-leaf backdrop-blur-xl md:flex"
          >
            <CheckCircle2 className="h-4 w-4" />
            Ready
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
