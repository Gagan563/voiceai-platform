import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Search,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  Clock,
} from "lucide-react";
import {
  getMemories,
  deleteMemory as apiDeleteMemory,
  clearAllMemories as apiClearAll,
} from "@/api/client";

const panelVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.04, type: "spring", stiffness: 280, damping: 24 },
  }),
  exit: { opacity: 0, x: 60, transition: { duration: 0.15 } },
};

export default function MemoryView({ isOpen, onClose }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(new Set());
  const [query, setQuery] = useState("");

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMemories();
      setMemories(result.memories || []);
    } catch (err) {
      setError(err.message || "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => setQuery(""));
      queueMicrotask(fetchMemories);
    }
  }, [isOpen, fetchMemories]);

  // Client-side filter (backend semantic search available when pgvector configured)
  const filtered = useMemo(() => {
    if (!query.trim()) return memories;
    const q = query.trim().toLowerCase();
    return memories.filter((m) =>
      (m.content || "").toLowerCase().includes(q)
    );
  }, [memories, query]);

  const handleDelete = async (memoryId) => {
    setDeleting((prev) => new Set(prev).add(memoryId));
    try {
      await apiDeleteMemory(memoryId);
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    } catch (err) {
      setError(err.message || "Delete failed");
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(memoryId);
        return next;
      });
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Clear all memories? This cannot be undone.")) return;

    setLoading(true);
    try {
      await apiClearAll();
      setMemories([]);
    } catch (err) {
      setError(err.message || "Clear failed");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          {/* Slide-out panel */}
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-line bg-ink-950/95 backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/15 text-brand ring-1 ring-brand/25">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-text">
                    Memory Bank
                  </h2>
                  <p className="text-xs text-text-muted">
                    {memories.length} stored {memories.length === 1 ? "memory" : "memories"}
                    {query && filtered.length !== memories.length && (
                      <span className="ml-1 text-aqua">· {filtered.length} match{filtered.length !== 1 ? "es" : ""}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {memories.length > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClearAll}
                    disabled={loading}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-danger/25 bg-danger/10 px-3 text-[11px] font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear all memories
                  </motion.button>
                )}

                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/[0.06] hover:text-text"
                  aria-label="Close memory panel"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="border-b border-line px-5 py-2">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search memories…"
                  className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-text-muted hover:text-text"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Loading state */}
              {loading && memories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                  <Loader2 className="h-6 w-6 animate-spin mb-3" />
                  <span className="text-sm">Loading memories...</span>
                </div>
              )}

              {/* Error state */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 p-3"
                >
                  <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-danger">{error}</p>
                    <button
                      onClick={fetchMemories}
                      className="mt-1 text-[11px] text-danger/70 underline hover:text-danger"
                    >
                      Retry
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Empty state */}
              {!loading && !error && memories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-line mb-4">
                    <Sparkles className="h-6 w-6 text-text-muted" />
                  </div>
                  <h3 className="text-sm font-semibold text-text">
                    No memories yet
                  </h3>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-text-muted">
                    When you chat with VoxMind, it will automatically remember
                    important facts like names, preferences, and deadlines.
                  </p>
                </div>
              )}

              {/* No search results */}
              {!loading && query && filtered.length === 0 && memories.length > 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-8 w-8 text-text-muted mb-3" />
                  <p className="text-sm font-semibold text-text">No results for &ldquo;{query}&rdquo;</p>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="mt-2 text-xs text-aqua underline hover:no-underline"
                  >
                    Clear search
                  </button>
                </div>
              )}

              {/* Memory cards */}
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {filtered.map((memory, i) => (
                    <motion.div
                      key={memory.id}
                      custom={i}
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className="group rounded-xl border border-line bg-panel/60 p-3 transition hover:border-brand/20 hover:bg-panel/80"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed text-text-soft">
                            {memory.content}
                          </p>
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-text-muted">
                            <Clock className="h-3 w-3" />
                            {formatDate(memory.createdAt)}
                          </div>
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(memory.id)}
                          disabled={deleting.has(memory.id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted opacity-0 transition group-hover:opacity-100 hover:bg-danger/15 hover:text-danger disabled:opacity-50"
                          title="Delete memory"
                          aria-label="Delete memory"
                        >
                          {deleting.has(memory.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-line px-5 py-3">
              <p className="text-[10px] leading-relaxed text-text-muted">
                Memories are stored in PostgreSQL with vector embeddings for
                semantic recall. Facts are extracted automatically from
                conversations using Claude.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
