import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  Gauge,
  Key,
  Menu,
  MessageSquare,
  Search,
  Settings,
  X,
} from "lucide-react";

const navSections = [
  {
    title: null,
    items: [
      { id: "playground", label: "Playground", icon: MessageSquare },
    ],
  },
  {
    title: "Build",
    collapsible: true,
    items: [
      { id: "apps", label: "My Projects", icon: Code2 },
      { id: "gallery", label: "Templates", icon: BookOpen },
    ],
  },
  {
    title: null,
    items: [
      { id: "dashboard", label: "Dashboard", icon: Gauge },
    ],
  },
];

const bottomLinks = [
  { id: "memory", label: "Memory", icon: Search, panel: "memory" },
  { id: "history", label: "History", icon: BookOpen, panel: "history" },
  { id: "apikey", label: "API Keys", icon: Key, panel: "settings" },
  { id: "settings", label: "Settings", icon: Settings, panel: "settings" },
];

/* NOVA sidebar logo — unique branded mark */
function NovaLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="nova-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#nova-logo-grad)" fillOpacity="0.15" />
      <path d="M16 8L22 14L16 20L10 14L16 8Z" fill="#22d3ee" fillOpacity="0.8" />
      <path d="M16 12L20 16L16 20L12 16L16 12Z" fill="#22d3ee" />
    </svg>
  );
}

export default function Sidebar({ activeView, onNavigate, user, onOpenPanel }) {
  const [expandedSections, setExpandedSections] = useState({ Build: true });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSection = (title) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const handleNav = (id) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const handlePanel = (panel) => {
    onOpenPanel(panel);
    setMobileOpen(false);
  };

  const content = (
    <nav className="flex h-full flex-col bg-[var(--vox-sidebar)] border-r border-[var(--vox-border)]">
      {/* Header */}
      <div className="flex h-[52px] items-center gap-2.5 px-4 border-b border-[var(--vox-border)]">
        <NovaLogo />
        <span className="font-heading text-sm font-bold tracking-tight text-text">NOVA</span>
        <span className="ml-auto rounded-md bg-aqua/10 px-1.5 py-0.5 text-[10px] font-bold text-aqua">
          v2
        </span>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {navSections.map((section) => (
          <div key={section.title || section.items[0].id}>
            {section.title && (
              <button
                type="button"
                onClick={() => section.collapsible && toggleSection(section.title)}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted"
              >
                {section.collapsible &&
                  (expandedSections[section.title] ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  ))}
                {section.title}
              </button>
            )}

            {(!section.collapsible || expandedSections[section.title]) &&
              section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`sidebar-item ${activeView === item.id ? "active" : ""}`}
                >
                  <item.icon />
                  {item.label}
                </button>
              ))}
          </div>
        ))}

        {/* Feature card — unique to NOVA */}
        <div className="mx-1 mt-4 rounded-xl border border-aqua/10 bg-aqua/[0.04] p-3">
          <p className="text-xs font-bold text-aqua">Autonomous Mode</p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
            Enable autopilot to let NOVA plan and execute without confirmation.
          </p>
          <button
            type="button"
            onClick={() => handlePanel("settings")}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-aqua transition hover:underline"
          >
            Configure
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Bottom links */}
      <div className="border-t border-[var(--vox-border)] px-2.5 py-2 space-y-0.5">
        {bottomLinks.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => handlePanel(link.panel)}
            className="sidebar-item"
          >
            <link.icon />
            {link.label}
          </button>
        ))}
      </div>

      {/* User footer */}
      {user && (
        <div className="border-t border-[var(--vox-border)] px-4 py-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aqua/15 text-xs font-bold text-aqua">
            {(user.name || user.email || "U")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-text">
              {user.name || "User"}
            </p>
            <p className="truncate text-[11px] text-text-muted">{user.email}</p>
          </div>
        </div>
      )}
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 grid h-10 w-10 place-items-center rounded-lg bg-[var(--vox-surface-1)] text-text-muted lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar */}
      <div className="hidden w-[240px] shrink-0 lg:block">
        {content}
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 z-50 h-full w-[280px]"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:text-text"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              {content}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
