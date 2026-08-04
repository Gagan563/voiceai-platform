# NOVA — Project Vision & Mission

## What Is NOVA?

NOVA is a **locally-run, zero-cost AI platform** designed for **every person on the planet** — not just developers.

It runs on your own machine, on your own network. No subscriptions. No cloud dependency. No data leaving your home. You install it once and it works — like any normal application should.

---

## The Problem We're Solving

Every AI platform on the market today has at least one of these flaws:

| Platform | Flaw |
|----------|------|
| **ChatGPT / Claude.ai / Gemini** | Monthly subscription ($20+/mo). Your data goes to their servers. Rate limits. Censorship. Platform can change or shut down anytime. |
| **Claude Code / Codex** | Developer-only. Requires terminal, CLI knowledge, API keys. A normal person can't use these. |
| **Open WebUI / Ollama** | Painful to install. Requires Docker, terminal commands, YAML configs. Breaks on updates. Only developers survive the setup. |
| **LM Studio / GPT4All** | Better UX, but limited to chat. No voice, no modules, no agent workflows, no real productivity tools. |
| **Siri / Alexa / Google Assistant** | Cloud-locked. Can't run local models. Limited to what the company allows. No customization. |

**Every single one of these either costs money, requires technical skill, or is too limited to be truly useful.**

---

## NOVA's Core Philosophy

### 1. Free Forever — No Platform Fees
You bring your own API key (free tiers exist: Gemini, Groq) or run a local model. NOVA never charges you. The AI cost is between you and the provider — or zero if you run local.

### 2. Runs Locally & On LAN
- Install on one machine → use from any device on your Wi-Fi
- Your data stays on YOUR machine
- Works offline with local models
- No internet required for core features

### 3. Easy to Install — Like a Normal App
**This is not Open WebUI.** There is no Docker. No terminal. No YAML.
- Download → Install → Open → Use
- One-click installer (Electron app wrapping the web UI + backend)
- Auto-configures everything: Node runtime bundled, database embedded, models auto-detected

### 4. For Every Person — Not Just Developers
A farmer, a student, a lawyer, a shopkeeper, a grandmother — anyone should be able to:
- Talk to NOVA by voice in their language
- Ask it to draft a legal notice, plan a trip, track expenses, set reminders
- Upload a document and get a structured summary
- Never touch a terminal, never write code, never configure anything

### 5. Everything That Exists in the Market — In One Place
Instead of 10 different apps, NOVA combines:

| Capability | Replaces |
|-----------|----------|
| AI Chat (text + voice) | ChatGPT, Claude, Gemini |
| Voice assistant | Siri, Alexa, Google Assistant |
| Code agent + terminal | Claude Code, Codex, Cursor |
| Document analysis | NotebookLM, DocuSign AI |
| Task & reminder management | Todoist, Google Tasks |
| Finance tracking | Mint, YNAB |
| Health & wellness | MyFitnessPal, mood trackers |
| Legal document drafting | LegalZoom AI |
| Translation | DeepL, Google Translate |
| Smart home control | Home Assistant dashboard |
| Web search + research | Perplexity, Google |
| Travel planning | TripIt, Google Travel |
| Media control | Spotify integration |
| Multi-agent orchestration | AutoGPT, CrewAI |

### 6. Solves Every Flaw in the Market

| Market Flaw | NOVA's Solution |
|------------|-----------------|
| "I have to pay $20/month" | Free. Use free API tiers or local models. |
| "My data goes to their cloud" | Everything runs locally. Data never leaves your network. |
| "It's too hard to install" | One-click installer. No terminal, no Docker, no config files. |
| "Only developers can use it" | Voice-first, visual UI, natural language for everything. |
| "It can only chat" | 15+ life modules: finance, health, legal, travel, tasks, and more. |
| "It doesn't remember me" | Persistent local memory across sessions. |
| "I can't customize it" | Open source. Add modules, change models, connect any service. |
| "It won't work offline" | Local model support. Core features work without internet. |
| "I need 10 different apps" | One platform for everything. |
| "AI hallucinates and I can't verify" | Plan → Review → Approve workflow. You see every step before execution. |

---

## Product Phases

### Phase 1 — Web Application *(Current — where we are now)*
- React frontend + Node.js backend
- Runs via `npm start` (developer setup)
- All core modules functional
- Voice I/O, agent workflows, plan/execute pipeline
- JWT auth, memory, sessions, routines

### Phase 2 — Desktop Application *(Next)*
- Electron wrapper → single installable `.exe` / `.dmg` / `.AppImage`
- Bundled Node.js runtime (no system dependencies)
- SQLite or embedded Postgres (no external DB setup)
- Auto-start backend on app launch
- System tray integration
- One-click install: Download → Double-click → Use

### Phase 3 — LAN Server Mode
- Install on one powerful machine (home server, old laptop, NAS)
- Access from any device on the network: phone, tablet, other PCs
- Family/team sharing with user accounts
- Mobile-responsive web UI works as the "app" on phones
- Optional: Expose via Tailscale/ZeroTier for remote access (still no cloud fees)

### Phase 4 — Local Model Integration
- Auto-detect and use Ollama / LM Studio / llama.cpp models
- Zero-config: NOVA finds local models and uses them
- Hybrid mode: use local for privacy-sensitive tasks, cloud for heavy tasks
- Full offline operation with capable local models

---

## Who Is This For?

**Everyone.**

| Person | How They Use NOVA |
|--------|-------------------|
| **Student** | "Explain photosynthesis", "Quiz me on chapter 5", "Draft my essay outline" |
| **Farmer** | "What's wrong with my wheat crop?", "Best time to plant rice in Punjab?" |
| **Small business owner** | "Track today's expenses", "Draft an invoice", "Remind me to call the supplier" |
| **Lawyer** | "Draft a rental agreement for Karnataka", "What does Section 420 IPC say?" |
| **Elderly parent** | "Call my son", "What medicine do I take at 8pm?", "Read me the news" |
| **Developer** | "Build me a React dashboard", "Fix this bug", "Deploy to production" |
| **Homemaker** | "Plan meals for the week", "Track water intake", "Translate this to Hindi" |
| **Freelancer** | "Write a proposal for the client", "Schedule follow-up", "Track my hours" |

---

## Why This Matters

There are 8 billion people on this planet. AI should not be locked behind:
- A $20/month paywall
- A terminal window
- A Docker installation guide
- A Silicon Valley company's terms of service

**NOVA is AI for the rest of us.**

---

## Current State vs. Vision

| Area | Current State | Target State |
|------|---------------|--------------|
| Installation | `npm install` + manual setup | One-click installer |
| Runtime | Two terminal commands | Auto-start with app |
| Database | Postgres (needs setup) or JSON files | Embedded (auto-managed) |
| AI Provider | API key required | Auto-detect local models + free tiers |
| Target User | Developer | Anyone |
| Deployment | Web app on localhost | Desktop app + LAN server |
| Offline | Partial (needs API key) | Full (local models) |
| Mobile | Responsive web only | PWA + native wrapper (future) |
