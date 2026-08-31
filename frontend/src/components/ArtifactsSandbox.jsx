import { useState } from "react";
import {
  Code,
  Eye,
  Download,
  Copy,
  Check,
  Smartphone,
  Tablet,
  Monitor,
  RefreshCw,
  Sparkles,
} from "lucide-react";

/**
 * ArtifactsSandbox — Live interactive preview and code sandbox (Claude Artifacts / v0 style).
 * Renders agent-generated HTML/CSS/JS, React components, dashboards, and charts in real-time.
 */
export default function ArtifactsSandbox({
  code = `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6">
  <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
    <div class="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto text-2xl font-bold">✨</div>
    <h2 class="text-xl font-bold text-white">Live Artifact Sandbox</h2>
    <p class="text-slate-400 text-sm">Ask NOVA to generate code, web dashboards, games, or charts to view them rendered live here.</p>
    <button onclick="alert('Interactive click works!')" class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition">Test Interaction</button>
  </div>
</body>
</html>`,
  title = "Generated Artifact",
}) {
  const [activeTab, setActiveTab] = useState("preview"); // preview | code
  const [viewport, setViewport] = useState("desktop"); // desktop | tablet | mobile
  const [copied, setCopied] = useState(false);
  const [editableCode, setEditableCode] = useState(code);
  const [reloadKey, setReloadKey] = useState(0);

  const handleCopy = () => {
    navigator.clipboard.writeText(editableCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([editableCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getViewportWidth = () => {
    switch (viewport) {
      case "mobile":
        return "max-w-[375px]";
      case "tablet":
        return "max-w-[768px]";
      default:
        return "w-full";
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Sandbox Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>{title}</span>
          </div>
        </div>

        {/* Viewport & Tab Switchers */}
        <div className="flex items-center gap-3">
          {activeTab === "preview" && (
            <div className="hidden sm:flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewport("desktop")}
                className={`p-1.5 rounded-md ${viewport === "desktop" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
                title="Desktop View"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewport("tablet")}
                className={`p-1.5 rounded-md ${viewport === "tablet" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
                title="Tablet View"
              >
                <Tablet className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewport("mobile")}
                className={`p-1.5 rounded-md ${viewport === "mobile" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
                title="Mobile View"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-medium">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition ${activeTab === "preview" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition ${activeTab === "code" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Reload Sandbox"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Copy Code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Download Artifact"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-slate-950">
        {activeTab === "preview" ? (
          <div className={`w-full h-full flex items-center justify-center p-4 transition-all duration-300`}>
            <div className={`h-full ${getViewportWidth()} transition-all duration-300 bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-800`}>
              <iframe
                key={reloadKey}
                srcDoc={editableCode}
                title={title}
                sandbox="allow-scripts allow-modals allow-same-origin"
                className="w-full h-full border-0 bg-white"
              />
            </div>
          </div>
        ) : (
          <div className="w-full h-full p-4 overflow-auto font-mono text-xs text-slate-200 bg-slate-950">
            <textarea
              value={editableCode}
              onChange={(e) => setEditableCode(e.target.value)}
              className="w-full h-full bg-slate-900/80 border border-slate-800 rounded-xl p-4 font-mono text-sm text-sky-200 resize-none focus:outline-none focus:border-indigo-500/50"
              spellCheck="false"
            />
          </div>
        )}
      </div>
    </div>
  );
}
