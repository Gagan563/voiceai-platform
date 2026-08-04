import { motion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  Calculator,
  Cloud,
  Code2,
  Gamepad2,
  Globe,
  LayoutDashboard,
  ShoppingCart,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";

const TEMPLATES = [
  {
    id: "weather-app",
    title: "Weather App",
    description: "Real-time weather with forecast cards, location search, and animated conditions.",
    icon: Cloud,
    color: "text-sky-400",
    bg: "bg-sky-400/10",
    border: "border-sky-400/15",
    prompt: "Build me a beautiful weather app with current conditions, 5-day forecast cards, location search, and dark theme animations.",
    tags: ["React", "API", "Animated"],
  },
  {
    id: "todo-app",
    title: "Task Manager",
    description: "Kanban-style task board with priorities, due dates, and drag-and-drop.",
    icon: LayoutDashboard,
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    border: "border-violet-400/15",
    prompt: "Build a Kanban task manager with To Do, In Progress, and Done columns, drag and drop, priority badges, and a dark premium design.",
    tags: ["Kanban", "Local storage"],
  },
  {
    id: "calculator",
    title: "Scientific Calculator",
    description: "A sleek calculator with standard and scientific modes, history, and keyboard support.",
    icon: Calculator,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/15",
    prompt: "Build a beautiful scientific calculator with standard and scientific modes, calculation history, keyboard input support, and a glassmorphism dark theme.",
    tags: ["Math", "Keyboard"],
  },
  {
    id: "game",
    title: "Browser Game",
    description: "A playable arcade game with scoring, collision, animations, and restart.",
    icon: Gamepad2,
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/15",
    prompt: "Build a playable Snake game in the browser with smooth animations, score tracking, speed increases, and a game-over screen with restart.",
    tags: ["Game", "Canvas"],
  },
  {
    id: "portfolio",
    title: "Developer Portfolio",
    description: "A personal portfolio site with hero, projects grid, skills, and contact form.",
    icon: Globe,
    color: "text-aqua",
    bg: "bg-aqua/10",
    border: "border-aqua/15",
    prompt: "Build a stunning developer portfolio website with a hero section, animated skills bar, projects grid with filter, and a contact form. Dark premium design.",
    tags: ["Portfolio", "Responsive"],
  },
  {
    id: "timer",
    title: "Pomodoro Timer",
    description: "Focus timer with work/break cycles, notifications, and session tracking.",
    icon: Timer,
    color: "text-coral",
    bg: "bg-coral/10",
    border: "border-coral/15",
    prompt: "Build a Pomodoro focus timer with 25-minute work sessions, 5-minute breaks, session counter, browser notifications, and a calming dark UI.",
    tags: ["Productivity"],
  },
  {
    id: "quiz",
    title: "Quiz App",
    description: "Interactive quiz with categories, timer, score tracking, and results screen.",
    icon: BookOpen,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/15",
    prompt: "Build an interactive quiz app with 10 trivia questions, a countdown timer per question, progress bar, score tracking, and an animated results screen.",
    tags: ["Interactive", "Animated"],
  },
  {
    id: "expense-tracker",
    title: "Expense Tracker",
    description: "Budget tracker with categories, charts, monthly view, and CSV export.",
    icon: Briefcase,
    color: "text-leaf",
    bg: "bg-leaf/10",
    border: "border-leaf/15",
    prompt: "Build a personal expense tracker with category tags, a doughnut chart summary, monthly filter, running balance, and CSV export. Dark premium UI.",
    tags: ["Finance", "Charts"],
  },
  {
    id: "ecommerce",
    title: "Product Showcase",
    description: "E-commerce product grid with filters, cart, and checkout flow.",
    icon: ShoppingCart,
    color: "text-pink-400",
    bg: "bg-pink-400/10",
    border: "border-pink-400/15",
    prompt: "Build an e-commerce product showcase with a product grid, category filters, search, add-to-cart, cart drawer, and a checkout summary. Dark theme.",
    tags: ["E-commerce", "Cart"],
  },
  {
    id: "landing-page",
    title: "SaaS Landing Page",
    description: "Conversion-focused landing page with hero, features, pricing, and CTA.",
    icon: Zap,
    color: "text-amber",
    bg: "bg-amber/10",
    border: "border-amber/15",
    prompt: "Build a premium SaaS landing page with animated hero, feature cards, a 3-tier pricing table, testimonials section, and a sticky CTA navbar. Dark gradient design.",
    tags: ["Marketing", "Animated"],
  },
  {
    id: "chat-ui",
    title: "Chat Interface",
    description: "A beautiful chat UI with message bubbles, typing indicator, and emoji picker.",
    icon: Sparkles,
    color: "text-violet-400",
    bg: "bg-violet-400/10",
    border: "border-violet-400/15",
    prompt: "Build a beautiful chat interface with message bubbles, timestamps, typing indicator animation, emoji picker, dark glassmorphism design, and smooth scroll.",
    tags: ["Chat", "Glassmorphism"],
  },
  {
    id: "api-dashboard",
    title: "API Dashboard",
    description: "Developer dashboard showing API stats, request logs, and rate limits.",
    icon: Code2,
    color: "text-aqua",
    bg: "bg-aqua/10",
    border: "border-aqua/15",
    prompt: "Build an API developer dashboard with live request stats, a log feed, endpoint list with status badges, rate limit gauges, and dark terminal aesthetics.",
    tags: ["Developer", "Stats"],
  },
];

export default function TemplatesView({ onSelectTemplate }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <header className="flex h-[52px] shrink-0 items-center border-b border-[rgba(255,255,255,0.06)] px-6">
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-4 w-4 text-aqua" />
          <h1 className="font-heading text-sm font-bold text-text">Templates</h1>
          <span className="rounded-full bg-aqua/10 px-2 py-0.5 text-[10px] font-bold text-aqua">
            {TEMPLATES.length}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <p className="mb-6 text-xs leading-relaxed text-text-muted">
          Pick a starter template. NOVA will build it immediately — you can describe customizations first or jump straight in.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((tpl, i) => {
            const Icon = tpl.icon;
            return (
              <motion.button
                key={tpl.id}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 280, damping: 24 }}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectTemplate?.(tpl.prompt)}
                className={`nova-card text-left hover:${tpl.border} hover:shadow-lg hover:shadow-black/20 transition-all`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tpl.bg} ${tpl.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text">{tpl.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                      {tpl.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tpl.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-semibold text-text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
