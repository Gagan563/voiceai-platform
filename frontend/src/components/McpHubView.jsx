import { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  Server,
} from "lucide-react";
import { BACKEND_URL } from "../config";

export default function McpHubView() {
  const [connectors, setConnectors] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testingId, setTestingId] = useState(null);

  // Form for custom MCP connector
  const [newConnector, setNewConnector] = useState({
    id: "",
    name: "",
    description: "",
    endpoint: "",
    actions: "query, execute, fetch",
  });

  const loadConnectors = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/mcp/connectors`);
      const data = await res.json();
      if (data.connectors) {
        setConnectors(data.connectors);
      }
    } catch (err) {
      console.warn("Failed to fetch connectors:", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetch(`${BACKEND_URL}/mcp/connectors`)
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.connectors) {
          setConnectors(data.connectors);
        }
      })
      .catch((err) => console.warn("Failed to fetch connectors:", err));

    return () => {
      mounted = false;
    };
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newConnector.id || !newConnector.name) return;

    try {
      const actionsList = newConnector.actions
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const res = await fetch(`${BACKEND_URL}/mcp/connectors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newConnector.id,
          name: newConnector.name,
          description: newConnector.description,
          endpoint: newConnector.endpoint || undefined,
          actions: actionsList,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewConnector({ id: "", name: "", description: "", endpoint: "", actions: "query, execute" });
        loadConnectors();
      }
    } catch (err) {
      alert("Failed to register connector: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${BACKEND_URL}/mcp/connectors/${id}`, { method: "DELETE" });
      loadConnectors();
    } catch (err) {
      console.warn("Delete connector error:", err);
    }
  };

  const handleTestCall = async (connectorId, action) => {
    setTestingId(connectorId);
    setTestResult(null);

    try {
      const res = await fetch(`${BACKEND_URL}/mcp/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorId, action, params: { test: true } }),
      });
      const data = await res.json();
      setTestResult({ connectorId, action, response: data });
    } catch (err) {
      setTestResult({ connectorId, action, response: { error: err.message } });
    }
    setTestingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Model Context Protocol (MCP) Hub</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Connect external tools, APIs, and custom MCP servers to empower the autonomous agent.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom MCP Server</span>
        </button>
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connectors.map((c) => (
          <div
            key={c.id}
            className="flex flex-col justify-between p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition space-y-4"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-slate-800 text-indigo-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{c.name}</h3>
                    <span className="text-xs text-slate-500 font-mono">ID: {c.id}</span>
                  </div>
                </div>

                <span
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                    c.configured
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}
                >
                  {c.configured ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {c.configured ? "Active" : "Demo Mode"}
                </span>
              </div>

              <p className="text-xs text-slate-400 mt-3">
                {c.description || (c.custom ? "Custom user-registered MCP endpoint." : "Built-in integration capability.")}
              </p>

              {/* Action badges */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {c.actions?.map((act) => (
                  <button
                    key={act}
                    onClick={() => handleTestCall(c.id, act)}
                    disabled={testingId === c.id}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800/80 hover:bg-indigo-600 hover:text-white text-slate-300 transition font-mono"
                    title={`Test action: ${act}`}
                  >
                    <Play className="w-2.5 h-2.5" />
                    <span>{act}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs">
              <span className="text-slate-500">
                {c.custom ? "Custom Server" : "Standard MCP Tool"}
              </span>

              {c.custom && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                  title="Remove Connector"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Live Tool Execution Result Playground */}
      {testResult && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>
              Test Result for <code className="text-indigo-400">{testResult.connectorId}</code> ➔{" "}
              <code className="text-sky-400">{testResult.action}</code>
            </span>
            <button onClick={() => setTestResult(null)} className="text-slate-500 hover:text-white">
              Dismiss
            </button>
          </div>
          <pre className="text-xs font-mono text-slate-300 bg-slate-950 p-3 rounded-xl overflow-x-auto">
            {JSON.stringify(testResult.response, null, 2)}
          </pre>
        </div>
      )}

      {/* Add Custom MCP Server Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">Register Custom MCP Server</h2>
            <form onSubmit={handleRegister} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Server ID</label>
                <input
                  type="text"
                  placeholder="e.g. notion_mcp"
                  value={newConnector.id}
                  onChange={(e) => setNewConnector({ ...newConnector, id: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Server Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Notion Workspace"
                  value={newConnector.name}
                  onChange={(e) => setNewConnector({ ...newConnector, name: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">HTTP / SSE Endpoint (Optional)</label>
                <input
                  type="url"
                  placeholder="https://api.myserver.com/mcp"
                  value={newConnector.endpoint}
                  onChange={(e) => setNewConnector({ ...newConnector, endpoint: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Actions (Comma separated)</label>
                <input
                  type="text"
                  value={newConnector.actions}
                  onChange={(e) => setNewConnector({ ...newConnector, actions: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Register Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
