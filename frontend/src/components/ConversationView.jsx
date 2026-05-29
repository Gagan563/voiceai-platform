import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  User,
  AlertCircle,
  Sparkles,
  Target,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import useAppStore from "../store/appStore";

/** Animation variants for message entry */
const messageVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

/** Renders a structured intent object as a styled mini-card */
function IntentDisplay({ intent }) {
  if (!intent) return null;

  const typeColors = {
    schedule: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    create: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    search: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    remind: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    automate: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    answer: "text-pink-400 bg-pink-500/10 border-pink-500/20",
    control: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  };

  const colorClass = typeColors[intent.action_type] || typeColors.answer;

  return (
    <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-3.5 h-3.5 text-[var(--color-accent-purple)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Intent Analysis
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-muted)] w-20 shrink-0">Goal</span>
          <span className="text-[var(--color-text-primary)]">{intent.goal}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-muted)] w-20 shrink-0">Action</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
            {intent.action_type}
          </span>
        </div>
        {intent.confidence != null && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)] w-20 shrink-0">Confidence</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-accent-cyan)]"
                  style={{ width: `${intent.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {(intent.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}
        {Object.keys(intent.entities || {}).length > 0 && (
          <div className="flex gap-2">
            <span className="text-[var(--color-text-muted)] w-20 shrink-0 pt-0.5">Entities</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(intent.entities).map(([key, val]) => (
                <span
                  key={key}
                  className="px-2 py-0.5 rounded-md text-xs bg-white/[0.06] text-[var(--color-text-secondary)]"
                >
                  {key}: <span className="text-[var(--color-text-primary)]">{val}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {(intent.missing_info || []).length > 0 && (
          <div className="flex gap-2">
            <span className="text-[var(--color-text-muted)] w-20 shrink-0 pt-0.5">Missing</span>
            <div className="flex flex-wrap gap-1.5">
              {intent.missing_info.map((info, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20"
                >
                  {info}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Typing indicator (three bouncing dots) */
function TypingIndicator({ stage }) {
  const stageText = {
    intent: "Analyzing intent",
    plan: "Generating plan",
    execute: "Executing plan",
  };

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className="flex items-start gap-3 px-6"
    >
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-blue)] flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="glass rounded-2xl rounded-tl-md px-4 py-3 pulse-glow">
        <div className="flex items-center gap-3">
          <div className="dot-loader">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="text-sm text-[var(--color-text-muted)]">
            {stageText[stage] || "Thinking"}...
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/** Icon for message type */
function MessageIcon({ role, type }) {
  if (role === "user") {
    return (
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-accent-cyan)] to-[var(--color-accent-blue)] flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
        <User className="w-4 h-4 text-white" />
      </div>
    );
  }

  if (role === "system" || type === "error") {
    return (
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-accent-red)] to-[var(--color-accent-pink)] flex items-center justify-center shrink-0 shadow-lg shadow-red-500/20">
        <AlertCircle className="w-4 h-4 text-white" />
      </div>
    );
  }

  if (type === "execution_confirmation") {
    return (
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-accent-green)] to-emerald-600 flex items-center justify-center shrink-0 shadow-lg shadow-green-500/20">
        <CheckCircle2 className="w-4 h-4 text-white" />
      </div>
    );
  }

  if (type === "plan_cancelled") {
    return (
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-dark-400)] to-[var(--color-dark-500)] flex items-center justify-center shrink-0">
        <XCircle className="w-4 h-4 text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-blue)] flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
      <Bot className="w-4 h-4 text-white" />
    </div>
  );
}

export default function ConversationView() {
  const messages = useAppStore((s) => s.messages);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingStage = useAppStore((s) => s.loadingStage);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isLoading]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 space-y-4">
      {/* Empty state */}
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-cyan)] flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/25"
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl font-bold gradient-text mb-2"
          >
            What can I help you with?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[var(--color-text-muted)] max-w-md text-sm leading-relaxed"
          >
            Try something like{" "}
            <span className="text-[var(--color-accent-purple)]">"Schedule a meeting with Sarah tomorrow at 3pm"</span>{" "}
            or{" "}
            <span className="text-[var(--color-accent-cyan)]">"Remind me to call the dentist"</span>
          </motion.p>
        </div>
      )}

      {/* Messages */}
      <AnimatePresence mode="popLayout">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            variants={messageVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            className={`flex items-start gap-3 px-6 ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <MessageIcon role={msg.role} type={msg.type} />

            <div
              className={`max-w-[75%] ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-blue)] rounded-2xl rounded-tr-md shadow-lg shadow-purple-500/15"
                  : msg.type === "error"
                  ? "glass rounded-2xl rounded-tl-md border-red-500/30"
                  : "glass rounded-2xl rounded-tl-md"
              } px-4 py-3`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {msg.content}
              </p>

              {/* Show intent analysis for intent messages */}
              {msg.type === "intent" && msg.intent && (
                <IntentDisplay intent={msg.intent} />
              )}

              <span
                className={`block text-[10px] mt-2 ${
                  msg.role === "user"
                    ? "text-white/50 text-right"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Typing indicator */}
      {isLoading && <TypingIndicator stage={loadingStage} />}
    </div>
  );
}
