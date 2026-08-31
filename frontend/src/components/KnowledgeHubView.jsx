import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Upload,
  Search,
  Trash2,
  FileText,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  FilePlus,
} from "lucide-react";
import { BACKEND_URL } from "../config";

export default function KnowledgeHubView() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Manual doc form
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docTags, setDocTags] = useState("manual, docs");

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/knowledge/documents`);
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.warn("Failed to fetch knowledge docs:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleIndexManual = async (e) => {
    e.preventDefault();
    if (!docTitle || !docContent) return;

    try {
      const tagsList = docTags.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`${BACKEND_URL}/knowledge/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: docTitle,
          content: docContent,
          type: "manual_text",
          tags: tagsList,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setDocTitle("");
        setDocContent("");
        fetchDocuments();
      }
    } catch (err) {
      alert("Failed to index document: " + err.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);

    try {
      const res = await fetch(`${BACKEND_URL}/knowledge/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${BACKEND_URL}/knowledge/documents/${id}`, { method: "DELETE" });
      fetchDocuments();
    } catch (err) {
      console.warn("Failed to delete doc:", err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(`${BACKEND_URL}/knowledge/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, topK: 4 }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.warn("Search error:", err);
    }
    setSearching(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Document Knowledge Hub & Vector RAG</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Upload PDFs, guidelines, and manuals. Documents are automatically chunked, embedded, and recalled during chat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-semibold text-sm cursor-pointer transition">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Upload File</span>
            <input type="file" onChange={handleFileUpload} className="hidden" accept=".txt,.md,.json,.csv,.log" />
          </label>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition active:scale-95"
          >
            <FilePlus className="w-4 h-4" />
            <span>Add Text Doc</span>
          </button>
        </div>
      </div>

      {/* Semantic Vector Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Test vector similarity search (e.g. 'refund policy', 'API setup')..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-sm text-white transition disabled:opacity-50"
        >
          {searching ? "Searching..." : "Vector Search"}
        </button>
      </form>

      {/* Semantic Search Results */}
      {searchResults.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-400">
            <span>Semantic Vector Matches ({searchResults.length})</span>
            <button onClick={() => setSearchResults([])} className="text-slate-500 hover:text-white">
              Clear Results
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {searchResults.map((res, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{res.docTitle}</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono text-[10px]">
                    Score: {Math.round(res.score * 100)}%
                  </span>
                </div>
                <p className="text-slate-400 line-clamp-3 leading-relaxed">{res.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Indexed Documents List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Indexed Documents ({documents.length})
        </h3>

        {documents.length === 0 && !loading && (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl p-6 text-slate-500 space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm">No knowledge documents indexed yet.</p>
            <p className="text-xs text-slate-600">Upload text files or manuals to give NOVA instant contextual domain recall.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-800 text-indigo-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white line-clamp-1">{doc.title}</h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {doc.chunkCount} vector chunks • {doc.charCount} chars
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                    title="Delete Document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 mt-3 line-clamp-3 leading-relaxed">
                  {doc.summary}
                </p>
              </div>

              <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-800/60">
                {doc.tags?.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">Index Knowledge Document</h2>
            <form onSubmit={handleIndexManual} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Return Policy / System Architecture"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Document Content</label>
                <textarea
                  rows={6}
                  placeholder="Paste raw guidelines, FAQs, documentation, or code excerpts..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={docTags}
                  onChange={(e) => setDocTags(e.target.value)}
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
                  Index & Chunk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
