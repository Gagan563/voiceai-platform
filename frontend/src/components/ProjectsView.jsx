import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { apiClient } from "@/api/client";

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/api$/, "") ||
  window.location.origin.replace(":3000", ":3001");

function ProjectCard({ file, onPreview }) {
  const name = file.name.replace(/\/index\.html$/, "").replace(/\/$/, "") || file.name;
  const isHtml = file.name.endsWith(".html");
  const ext = file.name.split(".").pop().toLowerCase();

  const extColors = {
    html: "text-orange-400 border-orange-400/20 bg-orange-400/10",
    js: "text-yellow-400 border-yellow-400/20 bg-yellow-400/10",
    css: "text-blue-400 border-blue-400/20 bg-blue-400/10",
    py: "text-green-400 border-green-400/20 bg-green-400/10",
    md: "text-text-muted border-line bg-white/[0.03]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="nova-card group flex items-start gap-3 hover:border-aqua/15 transition-colors"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aqua/10 text-aqua">
        <FileCode2 className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${extColors[ext] || "text-text-muted border-line bg-white/[0.03]"}`}>
            .{ext}
          </span>
          <span className="text-[11px] text-text-muted">
            {(file.size / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
        {isHtml && (
          <button
            type="button"
            onClick={() => onPreview(file.name)}
            title="Preview"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-aqua/10 hover:text-aqua transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function ProjectsView() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get("/agent/files");
      setFiles(data.files || []);
    } catch (err) {
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(fetchFiles);
  }, []);

  const handlePreview = (filename) => {
    const url = `${BACKEND_BASE}/agent/output/${encodeURIComponent(filename)}`;
    setPreview(url);
  };

  // Group files by top-level folder
  const grouped = files.reduce((acc, file) => {
    const parts = file.name.split("/");
    const group = parts.length > 1 ? parts[0] : "root";
    if (!acc[group]) acc[group] = [];
    acc[group].push(file);
    return acc;
  }, {});

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6">
        <div className="flex items-center gap-2.5">
          <Code2 className="h-4 w-4 text-aqua" />
          <h1 className="font-heading text-sm font-bold text-text">My Projects</h1>
          {!loading && (
            <span className="rounded-full bg-aqua/10 px-2 py-0.5 text-[10px] font-bold text-aqua">
              {files.length} files
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={fetchFiles}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading && files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Loader2 className="h-6 w-6 animate-spin mb-3" />
            <span className="text-sm">Loading projects…</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-coral/25 bg-coral/10 p-4 text-sm text-coral">
            {error}
          </div>
        )}

        {!loading && !error && files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-line mb-4">
              <FolderOpen className="h-8 w-8 text-text-muted" />
            </div>
            <h2 className="text-sm font-semibold text-text">No projects yet</h2>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-text-muted">
              Ask NOVA to build something and your projects will appear here. Try:
              <span className="block mt-2 rounded-lg border border-line bg-white/[0.03] px-3 py-2 font-mono text-aqua">
                "Build me a weather app"
              </span>
            </p>
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(grouped).map(([group, groupFiles]) => (
            <div key={group}>
              <div className="mb-2 flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-text-muted" />
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
                  {group}
                </span>
                <span className="text-[11px] text-text-muted/60">
                  {groupFiles.length} file{groupFiles.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {groupFiles.map((file) => (
                  <ProjectCard key={file.name} file={file} onPreview={handlePreview} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {preview && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreview(null)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-6 z-50 flex flex-col rounded-2xl border border-line bg-[var(--vox-surface-1)] overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="text-sm font-semibold text-text">Preview</span>
                <div className="flex items-center gap-2">
                  <a
                    href={preview}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nova-btn-sm"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open tab
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:text-text"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <iframe
                src={preview}
                title="Project preview"
                className="flex-1 w-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
