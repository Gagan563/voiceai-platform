import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Trash2, Wifi, WifiOff, Zap } from "lucide-react";
import ConversationView from "./components/ConversationView";
import InputBar from "./components/InputBar";
import PlanCards from "./components/PlanCards";
import useAppStore from "./store/appStore";
import { healthCheck } from "./api/client";

export default function App() {
  const [backendOnline, setBackendOnline] = useState(null);
  const messages = useAppStore((s) => s.messages);
  const clearMessages = useAppStore((s) => s.clearMessages);

  // Check backend health on mount
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

  return (
    <div className="h-full flex flex-col bg-[var(--color-dark-900)] relative overflow-hidden">
      {/* Background ambient gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-purple)]/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent-cyan)]/[0.03] blur-[120px]" />
      </div>

      {/* ── Top Bar ── */}
      <header className="shrink-0 glass border-t-0 border-l-0 border-r-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-cyan)] flex items-center justify-center shadow-lg shadow-purple-500/20"
            >
              <Zap className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h1 className="text-sm font-bold gradient-text leading-tight">
                VoiceAI Platform
              </h1>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                Voice-first AI Assistant
              </p>
            </div>
          </div>

          {/* Status & Actions */}
          <div className="flex items-center gap-3">
            {/* Backend status indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5"
            >
              {backendOnline === null ? (
                <Activity className="w-3.5 h-3.5 text-[var(--color-text-muted)] animate-pulse" />
              ) : backendOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-[var(--color-accent-green)]" />
                  <span className="text-[10px] text-[var(--color-accent-green)] font-medium">
                    Online
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-[var(--color-accent-red)]" />
                  <span className="text-[10px] text-[var(--color-accent-red)] font-medium">
                    Offline
                  </span>
                </>
              )}
            </motion.div>

            {/* Clear chat button */}
            {messages.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={clearMessages}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent-red)] hover:bg-red-500/10 transition-all duration-200"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      </header>

      {/* ── Center: Conversation Area ── */}
      <ConversationView />

      {/* ── Plan Cards (shown between conversation and input when a plan exists) ── */}
      <AnimatePresence>
        <PlanCards />
      </AnimatePresence>

      {/* ── Bottom: Input Bar ── */}
      <InputBar />

      {/* Backend offline warning banner */}
      <AnimatePresence>
        {backendOnline === false && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-[var(--color-accent-red)] flex items-center gap-2 backdrop-blur-lg"
          >
            <WifiOff className="w-3.5 h-3.5" />
            Backend server is offline. Make sure it's running on port 3001.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
