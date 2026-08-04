import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  Clock,
  Cpu,
  Database,
  Layers,
  MessageSquare,
  RefreshCw,
  Server,
  TrendingUp,
  Zap,
} from "lucide-react";
import { apiClient } from "@/api/client";
import useAppStore from "@/store/appStore";

function StatCard({ icon: Icon, label, value, sub, color = "text-aqua", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 280, damping: 24 }}
      className="nova-card flex items-start gap-4"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-text">{value}</p>
        <p className="mt-0.5 text-xs font-semibold text-text-muted">{label}</p>
        {sub && <p className="mt-1 text-[11px] text-text-muted/70">{sub}</p>}
      </div>
    </motion.div>
  );
}

function StatusDot({ ok }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-leaf animate-pulse" : "bg-coral"}`}
    />
  );
}

function ServiceRow({ name, status, detail }) {
  const ok = status === "ready" || status === "whisper" || status === "ok";
  return (
    <div className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0">
      <div className="flex items-center gap-2.5">
        <StatusDot ok={ok} />
        <span className="text-sm text-text">{name}</span>
      </div>
      <span className={`text-xs font-mono ${ok ? "text-leaf" : "text-amber"}`}>
        {detail || status}
      </span>
    </div>
  );
}

export default function DashboardView() {
  const messages = useAppStore((s) => s.messages);
  const sessions = useAppStore((s) => s.sessions);
  const memories = useAppStore((s) => s.memories);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get("/status");
      setStatus(data);
      setLastRefresh(new Date());
    } catch {
      // backend offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(fetchStatus);
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const sessionCount = sessions?.length ?? 0;
  const memoryCount = memories?.length ?? 0;
  const msgCount = messages?.length ?? 0;
  const routineCount = status?.services?.routines?.count ?? 0;

  const aiRouter = status?.ai_router ?? {};
  const providers = Object.entries(aiRouter).filter(([, v]) => v && typeof v === "object");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {/* Header */}
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6">
        <div className="flex items-center gap-2.5">
          <Layers className="h-4 w-4 text-aqua" />
          <h1 className="font-heading text-sm font-bold text-text">Dashboard</h1>
        </div>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={MessageSquare} label="Messages today" value={msgCount} color="text-aqua" delay={0} />
          <StatCard icon={Brain} label="Memories stored" value={memoryCount} color="text-violet-400" delay={0.05} />
          <StatCard icon={Activity} label="Sessions" value={sessionCount} color="text-leaf" delay={0.1} />
          <StatCard icon={Clock} label="Routines" value={routineCount} sub="scheduled automations" color="text-amber" delay={0.15} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* System status */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 24 }}
            className="nova-card"
          >
            <div className="nova-card-title">
              <Server className="h-4 w-4 text-aqua" />
              System Status
              {lastRefresh && (
                <span className="ml-auto text-[10px] font-normal text-text-muted">
                  {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </div>

            {loading && !status ? (
              <div className="flex items-center gap-2 py-6 text-text-muted text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : status ? (
              <div>
                <ServiceRow name="API Server" status={status.services?.api} />
                <ServiceRow name="AI Engine" status={status.services?.ai} detail={status.services?.ai === "ready" ? "Gemini ✓" : "mock mode"} />
                <ServiceRow name="Transcription" status={status.services?.transcription} detail={status.keys?.whisper ? "Whisper ✓" : "needs OPENAI_API_KEY"} />
                <ServiceRow name="Memory" status={status.services?.memory?.mode} detail={status.services?.memory?.mode} />
                <ServiceRow name="ElevenLabs TTS" status={status.keys?.elevenlabs ? "ready" : "not configured"} />
              </div>
            ) : (
              <p className="text-sm text-coral py-4">Backend offline</p>
            )}
          </motion.div>

          {/* AI Router */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 260, damping: 24 }}
            className="nova-card"
          >
            <div className="nova-card-title">
              <Cpu className="h-4 w-4 text-violet-400" />
              AI Router
            </div>

            {providers.length === 0 ? (
              <p className="text-sm text-text-muted py-4">No provider data available.</p>
            ) : (
              providers.map(([name, info]) => (
                <div key={name} className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                  <div className="flex items-center gap-2">
                    <StatusDot ok={info.state === "closed"} />
                    <span className="text-sm capitalize text-text">{name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
                    <span className={info.state === "closed" ? "text-leaf" : "text-coral"}>
                      {info.state || "unknown"}
                    </span>
                    {info.failures > 0 && (
                      <span className="text-amber">{info.failures} fails</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        </div>

        {/* Connectors */}
        {status?.services?.connectors && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 24 }}
            className="nova-card"
          >
            <div className="nova-card-title">
              <Zap className="h-4 w-4 text-amber" />
              MCP Connectors
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 mt-2">
              {status.services.connectors.map((connector) => (
                <div
                  key={connector.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                    connector.configured
                      ? "border-leaf/20 bg-leaf/[0.07] text-leaf"
                      : "border-[rgba(255,255,255,0.06)] text-text-muted"
                  }`}
                >
                  <StatusDot ok={connector.configured} />
                  {connector.name}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quick tips */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 24 }}
          className="rounded-xl border border-aqua/10 bg-aqua/[0.04] p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-aqua" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-aqua">Quick Actions</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Say: \u201cBuild me a weather app\u201d", "Triggers one-command builder"],
              ["Say: \u201cRemind me to\u2026\u201d", "Creates a scheduled reminder"],
              ["Say: \u201cSearch for\u2026\u201d", "Launches web research agent"],
              ["Upload a PDF", "Auto-extracts requirements"],
              ["Open Wellness module", "Mood check-in & breathing"],
              ["Enable Autopilot", "Runs plans without confirmation"],
            ].map(([action, desc]) => (
              <div key={action} className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-white/[0.025] px-3 py-2.5">
                <p className="text-xs font-semibold text-text">{action}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">{desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Memory / DB stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 24 }}
          className="nova-card"
        >
          <div className="nova-card-title">
            <Database className="h-4 w-4 text-leaf" />
            Storage
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2 text-center">
            {[
              ["Messages", msgCount, "text-aqua"],
              ["Memories", memoryCount, "text-violet-400"],
              ["Sessions", sessionCount, "text-leaf"],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-white/[0.025] py-3">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
