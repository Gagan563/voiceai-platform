import React, { useState } from "react";
import {
  Play,
  Plus,
  Trash2,
  Settings2,
  Sparkles,
  Search,
  Code2,
  FileCheck2,
  Share2,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { BACKEND_URL } from "../config";

const AGENT_TEMPLATES = [
  { id: "researcher", name: "Researcher Agent", icon: Search, color: "from-blue-500 to-cyan-500", desc: "Searches the web and synthesizes key domain insights." },
  { id: "coder", name: "Code Developer", icon: Code2, color: "from-indigo-500 to-violet-500", desc: "Builds full-stack components and functional scripts." },
  { id: "reviewer", name: "QA & Reviewer", icon: FileCheck2, color: "from-emerald-500 to-teal-500", desc: "Validates code quality, correctness, and security." },
  { id: "publisher", name: "Deployment & Docs", icon: Share2, color: "from-purple-500 to-pink-500", desc: "Packages documents, manifests, and release notes." },
];

export default function WorkflowBuilder() {
  const [pipeline, setPipeline] = useState([
    { id: "1", type: "researcher", name: "Market Research", prompt: "Gather the latest best practices for voice AI interfaces." },
    { id: "2", type: "coder", name: "Component Builder", prompt: "Build an interactive audio visualizer component using Canvas." },
    { id: "3", type: "reviewer", name: "Safety & QA", prompt: "Verify responsive design and mobile touch support." },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [executionLogs, setExecutionLogs] = useState([]);

  const addStep = (template) => {
    const newStep = {
      id: String(Date.now()),
      type: template.id,
      name: `${template.name} Step`,
      prompt: `Execute ${template.name.toLowerCase()} tasks.`,
    };
    setPipeline([...pipeline, newStep]);
  };

  const removeStep = (id) => {
    setPipeline(pipeline.filter((s) => s.id !== id));
  };

  const runWorkflow = async () => {
    setIsRunning(true);
    setExecutionLogs([]);

    for (let i = 0; i < pipeline.length; i++) {
      setCurrentStepIndex(i);
      const step = pipeline[i];

      setExecutionLogs((prev) => [
        ...prev,
        { stepIndex: i, name: step.name, status: "running", message: `Executing ${step.name}...` },
      ]);

      try {
        const res = await fetch(`${BACKEND_URL}/chat/direct`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `[Step: ${step.name}] ${step.prompt}` }),
        });
        const data = await res.json();

        setExecutionLogs((prev) =>
          prev.map((log, idx) =>
            idx === prev.length - 1
              ? { ...log, status: "success", message: data.answer || "Step completed successfully." }
              : log
          )
        );
      } catch (err) {
        setExecutionLogs((prev) =>
          prev.map((log, idx) =>
            idx === prev.length - 1
              ? { ...log, status: "error", message: `Step failed: ${err.message}` }
              : log
          )
        );
        break;
      }
    }

    setIsRunning(false);
    setCurrentStepIndex(-1);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Multi-Agent Workflow Canvas</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Chain specialized autonomous agents together into automated multistep pipelines.
          </p>
        </div>

        <button
          onClick={runWorkflow}
          disabled={isRunning || pipeline.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
        >
          <Play className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`} />
          <span>{isRunning ? "Running Pipeline..." : "Execute Workflow"}</span>
        </button>
      </div>

      {/* Available Agent Nodes Palette */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Add Agent Stage</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {AGENT_TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => addStep(t)}
                className="flex flex-col items-start p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-left transition group"
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${t.color} text-white mb-2 shadow-md`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-sm text-slate-200 group-hover:text-white">{t.name}</span>
                  <Plus className="w-4 h-4 text-slate-500 group-hover:text-indigo-400" />
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pipeline Sequence Canvas */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pipeline Sequence ({pipeline.length} steps)</h3>
        <div className="space-y-3">
          {pipeline.map((step, idx) => {
            const isActive = currentStepIndex === idx;
            return (
              <div
                key={step.id}
                className={`relative flex items-center gap-4 p-4 rounded-2xl bg-slate-900/60 border ${
                  isActive
                    ? "border-indigo-500 shadow-lg shadow-indigo-500/10 bg-slate-900"
                    : "border-slate-800/80"
                } transition-all`}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 font-bold text-xs text-slate-300">
                  {idx + 1}
                </div>

                <div className="flex-1 grid sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={step.name}
                    onChange={(e) => {
                      const updated = [...pipeline];
                      updated[idx].name = e.target.value;
                      setPipeline(updated);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={step.prompt}
                    onChange={(e) => {
                      const updated = [...pipeline];
                      updated[idx].prompt = e.target.value;
                      setPipeline(updated);
                    }}
                    placeholder="Instructions for this agent stage..."
                    className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  onClick={() => removeStep(step.id)}
                  className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                  title="Remove Step"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Execution Logs */}
      {executionLogs.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Execution Output</h3>
          <div className="space-y-3">
            {executionLogs.map((log, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1.5 animate-fade-in"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  {log.status === "running" ? (
                    <Clock className="w-4 h-4 text-indigo-400 animate-spin" />
                  ) : log.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span>{log.name}</span>
                </div>
                <p className="text-xs text-slate-400 whitespace-pre-wrap pl-6 font-mono leading-relaxed">
                  {log.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
