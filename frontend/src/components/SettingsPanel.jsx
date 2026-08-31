import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Accessibility,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Eye,
  Gauge,
  KeyRound,
  Palette,
  Plug,
  Save,
  Trash2,
  Timer,
  Volume2,
  X,
} from "lucide-react";
import useAppStore from "@/store/appStore";
import { apiClient } from "@/api/client";

const panelVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } },
};

const modelOptions = [
  { value: "claude-sonnet-4-20250514", label: "Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Opus 4" },
  { value: "claude-3-5-sonnet-20241022", label: "Sonnet 3.5" },
];

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-brand/40"
      />
    </label>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[var(--vox-surface-1)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand" />
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
          {title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ToggleRow({ icon: Icon, label, checked, onToggle }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] bg-[var(--vox-bg)] px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-brand" />
        <span className="truncate text-sm text-text">{label}</span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-brand" : "bg-[rgba(255,255,255,0.12)]"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function RangeField({ icon: Icon, label, value, min, max, step, suffix, onChange }) {
  return (
    <label className="grid gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[var(--vox-bg)] px-3 py-2.5">
      <span className="flex items-center justify-between gap-3 text-sm text-text">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand" />
          {label}
        </span>
        <span className="font-code text-xs text-text-muted">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-[var(--vox-primary)]"
      />
    </label>
  );
}

export default function SettingsPanel({ isOpen, onClose }) {
  const settings = useAppStore((state) => state.settings);
  const setApiKey = useAppStore((state) => state.setApiKey);
  const setSetting = useAppStore((state) => state.setSetting);
  const setSelectedModel = useAppStore((state) => state.setSelectedModel);
  const toggleTtsEnabled = useAppStore((state) => state.toggleTtsEnabled);
  const toggleTtsMode = useAppStore((state) => state.toggleTtsMode);
  const toggleAutopilot = useAppStore((state) => state.toggleAutopilot);
  const logout = useAppStore((state) => state.logout);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const markSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[rgba(255,255,255,0.06)] bg-[var(--vox-bg)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
              <div>
                <h2 className="font-display text-base font-semibold text-text">Settings</h2>
                <p className="text-xs text-text-muted">Keys, model, voice, and appearance</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/[0.06] hover:text-text"
                aria-label="Close settings"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Model & Autopilot */}
              <Section icon={Cpu} title="Model & Behavior">
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
                    AI Model
                  </span>
                  <select
                    value={settings.selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 py-2 text-sm text-text outline-none"
                    aria-label="Select AI model"
                  >
                    {modelOptions.map((model) => (
                      <option
                        key={model.value}
                        value={model.value}
                        className="bg-[var(--vox-bg)] text-text"
                      >
                        {model.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] bg-[var(--vox-bg)] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-leaf" />
                    <span className="text-sm text-text">Autopilot</span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAutopilot}
                    className={`relative h-6 w-11 rounded-full transition ${
                      settings.autopilotEnabled
                        ? "bg-leaf"
                        : "bg-[rgba(255,255,255,0.12)]"
                    }`}
                    aria-pressed={settings.autopilotEnabled}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        settings.autopilotEnabled
                          ? "translate-x-[22px]"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </Section>

              {/* API Keys */}
              <Section icon={KeyRound} title="API Keys">
                <Field
                  label="Gemini / backend key"
                  value={settings.apiKeys.anthropic}
                  onChange={(value) => setApiKey("anthropic", value)}
                  type="password"
                  placeholder="Stored locally for client metadata"
                />
                <Field
                  label="OpenAI Whisper key"
                  value={settings.apiKeys.openai}
                  onChange={(value) => setApiKey("openai", value)}
                  type="password"
                  placeholder="Also set OPENAI_API_KEY in backend/.env"
                />
                <Field
                  label="ElevenLabs key"
                  value={settings.apiKeys.elevenlabs}
                  onChange={(value) => setApiKey("elevenlabs", value)}
                  type="password"
                />
              </Section>

              {/* Voice & TTS */}
              <Section icon={Volume2} title="Voice & TTS">
                <ToggleRow
                  icon={Volume2}
                  label="Text-to-Speech"
                  checked={settings.ttsEnabled}
                  onToggle={toggleTtsEnabled}
                />
                <ToggleRow
                  icon={Accessibility}
                  label="Speak plans before execution"
                  checked={settings.speakPlansAloud}
                  onToggle={() => setSetting("speakPlansAloud", !settings.speakPlansAloud)}
                />

                <RangeField
                  icon={Timer}
                  label="Silence timeout"
                  value={Number(settings.vadSilenceTimeout || 2000) / 1000}
                  min={1}
                  max={5}
                  step={0.1}
                  suffix="s"
                  onChange={(value) => setSetting("vadSilenceTimeout", Math.round(value * 1000))}
                />
                <RangeField
                  icon={Gauge}
                  label="Speech rate"
                  value={Number(settings.speechRate || 1).toFixed(1)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  suffix="x"
                  onChange={(value) => setSetting("speechRate", value)}
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSetting("sttMode", "whisper")}
                    className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-bold text-brand"
                  >
                    Whisper STT
                  </button>
                  <button
                    type="button"
                    onClick={toggleTtsMode}
                    className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 py-2 text-xs font-bold text-text-soft"
                  >
                    TTS: {settings.ttsMode}
                  </button>
                </div>
              </Section>

              {/* Integrations */}
              <Section icon={Plug} title="Integrations">
                <Field
                  label="Home Assistant URL"
                  value={settings.homeAssistantUrl || ""}
                  onChange={(value) => setSetting("homeAssistantUrl", value)}
                  placeholder="http://homeassistant.local:8123"
                />
                <Field
                  label="Home Assistant token"
                  value={settings.homeAssistantToken || ""}
                  onChange={(value) => setSetting("homeAssistantToken", value)}
                  type="password"
                />
              </Section>

              {/* Appearance */}
              <Section icon={Palette} title="Appearance">
                <select
                  value={settings.fontSize}
                  onChange={(event) => setSetting("fontSize", event.target.value)}
                  className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 py-2 text-sm text-text outline-none"
                >
                  <option value="small">Small font</option>
                  <option value="medium">Medium font</option>
                  <option value="large">Large font</option>
                </select>
                <ToggleRow
                  icon={Accessibility}
                  label="Large text mode"
                  checked={settings.largeTextMode}
                  onToggle={() => setSetting("largeTextMode", !settings.largeTextMode)}
                />
                <ToggleRow
                  icon={Eye}
                  label="High contrast"
                  checked={settings.highContrastMode}
                  onToggle={() => setSetting("highContrastMode", !settings.highContrastMode)}
                />
              </Section>

              {/* Danger Zone */}
              <Section icon={AlertTriangle} title="Danger Zone">
                {showDeleteConfirm ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold leading-relaxed text-danger">
                      This will permanently delete your account and all associated
                      data (memories, sessions, tasks, mood logs, finance records,
                      emergency contacts, documents). This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={async () => {
                          setDeleting(true);
                          try {
                            await apiClient.delete("/account");
                            await apiClient.delete("/auth/session");
                            logout();
                          } catch (err) {
                            console.error("Delete failed:", err);
                            setDeleting(false);
                          }
                        }}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-danger px-3 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deleting ? "Deleting…" : "Yes, delete everything"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex h-9 flex-1 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] px-3 text-xs font-bold text-text-muted transition hover:text-text"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 text-xs font-bold text-danger transition hover:bg-danger/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete all my data
                  </button>
                )}
              </Section>
            </div>

            <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
              <button
                type="button"
                onClick={markSaved}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-[var(--vox-bg)] transition hover:brightness-110"
              >
                {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? "Saved" : "Save settings"}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
