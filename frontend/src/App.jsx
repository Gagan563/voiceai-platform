import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import HeroPrompt from "@/components/HeroPrompt";
import BuilderView from "@/components/BuilderView";
import ConversationView from "@/components/ConversationView";
import InputBar from "@/components/InputBar";
import MemoryView from "@/components/MemoryView";
import VoiceActivation from "@/components/VoiceActivation";
import HistoryPanel from "@/components/HistoryPanel";
import Onboarding from "@/components/Onboarding";
import LoginPage from "@/components/LoginPage";
import SettingsPanel from "@/components/SettingsPanel";
import RoutinesPanel from "@/components/RoutinesPanel";
import RequirementsPanel from "@/components/RequirementsPanel";
import ToastStack from "@/components/ToastStack";
import NovaModules from "@/components/NovaModules";
import DashboardView from "@/components/DashboardView";
import ProjectsView from "@/components/ProjectsView";
import TemplatesView from "@/components/TemplatesView";
import AgentProgressPanel from "@/components/AgentProgressPanel";
import BackgroundAgentsPanel from "@/components/BackgroundAgentsPanel";
import RemindersPanel from "@/components/RemindersPanel";
import { healthCheck } from "@/api/client";
import useAppStore from "@/store/appStore";
import useSocket from "@/hooks/useSocket";
import "./App.css";

export default function App() {
  const [backendOnline, setBackendOnline] = useState(null);
  const [activeView, setActiveView] = useState("playground");

  // Panel states
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [routinesPanelOpen, setRoutinesPanelOpen] = useState(false);
  const [requirementsPanelOpen, setRequirementsPanelOpen] = useState(false);
  const [agentProgressOpen, setAgentProgressOpen] = useState(false);
  const [bgAgentsOpen, setBgAgentsOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);

  // Store
  const messages = useAppStore((s) => s.messages);
  const isLoading = useAppStore((s) => s.isLoading);
  const processUserInput = useAppStore((s) => s.processUserInput);
  const settings = useAppStore((s) => s.settings);
  const error = useAppStore((s) => s.error);
  const auth = useAppStore((s) => s.auth);

  // Connect to Socket.IO for real-time agent/orchestrator events
  useSocket();

  // Health check
  useEffect(() => {
    const check = async () => {
      try {
        await healthCheck();
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Accessibility and display modes
  useEffect(() => {
    document.documentElement.classList.remove(
      "fs-small",
      "fs-medium",
      "fs-large",
      "access-large-text",
      "high-contrast"
    );
    document.documentElement.classList.add(`fs-${settings.fontSize || "medium"}`);
    if (settings.largeTextMode) {
      document.documentElement.classList.add("access-large-text");
    }
    if (settings.highContrastMode) {
      document.documentElement.classList.add("high-contrast");
    }
  }, [settings.fontSize, settings.highContrastMode, settings.largeTextMode]);

  const handlePrompt = (prompt) => {
    if (!isLoading) processUserInput(prompt);
  };

  const handleOpenPanel = (panel) => {
    switch (panel) {
      case "memory": setMemoryPanelOpen(true); break;
      case "history": setHistoryPanelOpen(true); break;
      case "settings": setSettingsPanelOpen(true); break;
      case "routines": setRoutinesPanelOpen(true); break;
      case "requirements": setRequirementsPanelOpen(true); break;
      case "modules": setActiveView("wellness"); break;
      case "agents": setAgentProgressOpen(true); break;
      case "background-agents": setBgAgentsOpen(true); break;
      case "reminders": setRemindersOpen(true); break;
    }
  };

  // Template selection fires a prompt immediately
  const handleSelectTemplate = (prompt) => {
    setActiveView("build");
    if (!isLoading) processUserInput(prompt, { build: true });
  };

  const handleBackToStart = () => {
    setActiveView("playground");
  };

  if (!auth?.isAuthenticated) {
    return <LoginPage />;
  }

  const hasConversation = messages.length > 0 || isLoading;
  const novaModules = ["wellness", "legal", "farm", "emergency"];
  const isNovaModule = novaModules.includes(activeView);

  return (
    <div className="App flex h-full bg-[var(--vox-bg)] text-text">
      {/* Left sidebar — hidden in builder mode for more space */}
      {activeView !== "build" && (
        <Sidebar
          activeView={activeView}
          onNavigate={setActiveView}
          user={auth.user}
          onOpenPanel={handleOpenPanel}
        />
      )}

      {/* Main area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {activeView === "build" ? (
          /* ── Builder mode ── */
          <BuilderView onBack={handleBackToStart} onOpenPanel={handleOpenPanel} />
        ) : isNovaModule ? (
          /* ── NOVA Life Module ── */
          <NovaModules
            activeModule={activeView}
            onSelectModule={setActiveView}
            onClose={() => setActiveView("playground")}
          />
        ) : activeView === "dashboard" ? (
          /* ── Dashboard ── */
          <DashboardView />
        ) : activeView === "apps" ? (
          /* ── My Projects ── */
          <ProjectsView />
        ) : activeView === "gallery" ? (
          /* ── Templates ── */
          <TemplatesView onSelectTemplate={handleSelectTemplate} />
        ) : (
          /* ── Idle / Hero mode ── */
          <>
            {/* Top bar */}
            <header className="flex h-[52px] shrink-0 items-center justify-end border-b border-[rgba(255,255,255,0.06)] px-4 lg:px-6">
              <div className="flex items-center gap-2">
                <VoiceActivation />
                <button
                  type="button"
                  onClick={() => setSettingsPanelOpen(true)}
                  className="grid h-9 w-9 place-items-center rounded-full text-text-muted transition hover:bg-white/[0.06] hover:text-text"
                  title="Settings"
                  aria-label="Settings"
                >
                  <SettingsIcon className="h-[18px] w-[18px]" />
                </button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {hasConversation ? <ConversationView /> : <HeroPrompt onSubmit={handlePrompt} />}
              {hasConversation ? <InputBar /> : null}
            </div>
          </>
        )}
      </div>

      {/* Slide-over panels */}
      <MemoryView isOpen={memoryPanelOpen} onClose={() => setMemoryPanelOpen(false)} />
      <HistoryPanel isOpen={historyPanelOpen} onClose={() => setHistoryPanelOpen(false)} />
      <RoutinesPanel isOpen={routinesPanelOpen} onClose={() => setRoutinesPanelOpen(false)} />
      <RequirementsPanel isOpen={requirementsPanelOpen} onClose={() => setRequirementsPanelOpen(false)} />
      <SettingsPanel isOpen={settingsPanelOpen} onClose={() => setSettingsPanelOpen(false)} />
      <AgentProgressPanel isOpen={agentProgressOpen} onClose={() => setAgentProgressOpen(false)} />
      <BackgroundAgentsPanel isOpen={bgAgentsOpen} onClose={() => setBgAgentsOpen(false)} />
      <RemindersPanel isOpen={remindersOpen} onClose={() => setRemindersOpen(false)} />
      <Onboarding />
      <ToastStack backendOnline={backendOnline} error={error} />
    </div>
  );
}
