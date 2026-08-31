# AI Agent Project Brief - NOVA / VoxMind VoiceAI Platform

This file is a practical map for an AI coding agent working in this repository. It explains what the project is, how the pieces connect, where important behavior lives, and what to watch before making changes.

Last generated: 2026-08-14

## One-Sentence Summary

NOVA / VoxMind is a local-first, voice-first AI workspace with a React web app, Express backend, hybrid AI provider router, voice transcription/TTS, persistent memory, plan/execute agent workflows, life modules, MCP-style connectors, a desktop Electron wrapper, and a React Native mobile client.

## Product Intent

The project aims to become an AI assistant that normal users can run locally or on a LAN without subscriptions or complex setup. It combines chat, voice, memory, automation, reminders, document handling, modules such as finance/health/legal/farm/emergency, and autonomous app/code generation.

Current state is developer-oriented:

- Web frontend runs with Vite.
- Backend runs with Node/Express.
- Memory can use Postgres/Prisma or local JSON fallback.
- AI can use Groq, Gemini, Anthropic, OpenAI Whisper/embeddings, and mock fallbacks.
- Desktop uses Electron to launch the backend and load the built frontend.
- Mobile is a React Native client that talks to the backend.

## Repository Layout

```text
.
|-- backend/        Express API, AI router, memory, tools, agent, modules, auth
|-- frontend/       React + Vite + Tailwind web UI
|-- electron/       Electron desktop wrapper and packaging
|-- mobile/         React Native client
|-- cli/            Small CLI entrypoint
|-- shared/         Placeholder/shared notes
|-- docs/           Additional project docs
|-- scripts/        Build automation
|-- Dockerfile      Production image: backend + built frontend
|-- docker-compose.yml
|-- README.md
|-- project_vision.md
```

## Main Runtime Architecture

```text
User
  -> frontend React UI
  -> frontend/src/api/client.js
  -> Express backend on port 3001
  -> auth middleware
  -> route handlers
  -> AI router / memory / skills / connectors / agent tools
  -> Socket.IO and HTTP responses back to frontend
```

Important ports:

- Frontend dev server: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Backend health: `GET /health`
- Backend status: `GET /status`

## Root Commands

Run from repository root unless noted.

```bash
npm run dev              # runs backend + frontend through concurrently
npm run dev:backend      # backend only
npm run dev:frontend     # frontend only
npm run build            # scripts/build.js: build frontend, copy to backend/public, install prod backend deps
npm start                # node backend/server.js
npm test                 # node --test backend/tests/*.test.js
npm run lint             # frontend lint
npm run install:all      # install backend and frontend deps
```

Backend commands:

```bash
cd backend
npm run dev
npm test
npm run generate
```

Frontend commands:

```bash
cd frontend
npm run dev
npm run build
npm run lint
```

Electron commands:

```bash
cd frontend
npm run build

cd ../electron
npm run package
```

Mobile commands:

```bash
cd mobile
npm install
npm start
npm run android
```

## Critical Environment Variables

Backend reads `backend/.env` through `backend/config.js`.

Minimum for authenticated local app usage:

```ini
JWT_SECRET=change-this-to-a-long-random-secret
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
VOICEAI_MEMORY_MODE=local
```

Useful AI/provider variables:

```ini
AI_ROUTER_MODE=hybrid
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_API_KEY=
OPENAI_WHISPER_MODEL=gpt-4o-mini-transcribe
OPENAI_WHISPER_LANGUAGE=en
ALLOW_STUB_TRANSCRIPTION=false
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
CONNECTOR_DEMO_MODE=true
```

Database defaults:

```ini
DATABASE_URL=postgresql://voiceai:voiceai_secret@localhost:5432/voiceai_db
VOICEAI_MEMORY_MODE=local
```

Connector credentials:

```ini
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
HA_BASE_URL=
HA_TOKEN=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REFRESH_TOKEN=
BRAVE_API_KEY=
ALPHA_VANTAGE_KEY=
DEEPL_KEY=
LIBRE_TRANSLATE_URL=
```

Local computer access for the in-app autonomous agent:

```ini
LOCAL_COMPUTER_ACCESS=false
LOCAL_COMPUTER_WRITE=false
LOCAL_ACCESS_ROOTS=
```

## Backend Overview

Backend entrypoint:

- `backend/server.js`

Central config:

- `backend/config.js`

Core services:

- `backend/services/ai.js` - hybrid AI router, provider circuit breakers, JSON parsing, streaming, vision.
- `backend/services/memory.js` - memory save/recall/fact extraction, Postgres + local JSON fallback.
- `backend/services/agent.js` - autonomous app/code generation loop.
- `backend/services/tools.js` - tool registry used by the agent.
- `backend/services/skills.js` - pluggable skill registry with risk levels.
- `backend/services/mcp.js` - MCP-style connector bridge.
- `backend/services/moduleData.js` - persistent module CRUD through Prisma.
- `backend/services/routines.js` - scheduled routines.
- `backend/services/reminders.js` - local reminders.
- `backend/services/backgroundAgent.js` - scheduled background agents.
- `backend/services/orchestrator.js` - multi-agent orchestration.
- `backend/services/document.js` - document extraction/planning.
- `backend/services/terminal.js` - guarded terminal execution for generated agent workspace.

Middlewares:

- `backend/middleware/auth.js` - HMAC JWT-like tokens, cookie/header auth, refresh tokens.
- `backend/middleware/rateLimit.js` - general, auth, AI, and agent limiters.
- `backend/middleware/sanitize.js` - request sanitization.
- `backend/middleware/safety.js` - safety gate.
- `backend/middleware/validateEnv.js` - environment validation.

## Backend Routes

Mounted in `backend/server.js`.

Public/basic:

- `GET /health` - service, AI, memory, uptime.
- `GET /status` - richer service status, keys, connectors, routines.

Auth:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `DELETE /api/auth/session`

Voice:

- `POST /transcribe` - audio upload, OpenAI Whisper or stub if allowed.
- `POST /tts` - TTS, browser or ElevenLabs flow depending frontend settings.

Core AI flow:

- `POST /intent` - extract intent, recall memory, save facts asynchronously.
- `POST /plan` - generate plan steps from intent.
- `POST /execute` - execute approved plan, run skills/connectors/reminders/agent when needed.
- `POST /chat/direct` - direct answer path for simple Q&A.
- `POST /chat/stream` - SSE streaming chat.

Memory:

- `GET /memories`
- `DELETE /memories/:id`
- `DELETE /memories/all`

Context uploads:

- `POST /context/image` - image/screen analysis with Gemini vision or fallback.
- `POST /context/document` - extract document text/summary.
- `POST /context/document/plan` - extract requirements and implementation plan.

Agent and orchestration:

- `POST /agent/run` - autonomous agent loop with optional uploaded files.
- `POST /orchestrate` - multi-agent DAG orchestration.
- `GET /agents` - specialist agent list.
- `POST /upload` - upload files for agent.
- `GET /agent/output/*` - serve generated files from per-user output workspace.
- `GET /agent/files` - list generated agent output files.

Routines/reminders/background agents:

- `GET /routines`
- `POST /routines`
- `PATCH /routines/:id`
- `DELETE /routines/:id`
- `POST /routines/:id/run`
- `GET /reminders`
- `PATCH /reminders/:id`
- `GET /background-agents`
- `PATCH /background-agents/:id/toggle`
- `POST /background-agents/:id/run`

Generic integrations/modules:

- `GET /modules/search?q=...`
- `GET /modules/finance/quote?symbol=...`
- `GET /modules/finance/portfolio?symbols=...`
- `POST /modules/translate`
- `GET /modules/media/now-playing`
- `POST /modules/media/play`
- `POST /modules/media/pause`
- `POST /modules/media/skip`

NOVA life modules:

- `POST /nova/legal/ask`
- `POST /nova/legal/document`
- `POST /nova/farm/crop-advice`
- `POST /nova/farm/pest-identify`
- `POST /nova/wellness/mood-checkin`
- `GET /nova/wellness/breathing`
- `POST /nova/wellness/journal-prompt`
- `GET /nova/emergency/first-aid`
- `GET /nova/emergency/first-aid/:condition`
- `GET /nova/emergency/disaster/:type`
- `GET /nova/emergency/contacts`

Persistent module data under `/api`:

- `GET/POST/PATCH/DELETE /api/tasks`
- `GET/POST /api/mood-logs`
- `GET/POST/PATCH/DELETE /api/finance-records`
- `GET/POST/PATCH/DELETE /api/emergency-contacts`
- `GET/POST /api/documents`
- `GET/POST/PATCH /api/module-records`
- `DELETE /api/account`
- `GET /api/agents/background`
- `POST /api/agents/background/:id/approve`
- `PATCH /api/agents/background/:id`
- `POST /api/agents/background/:id/run`

MCP connectors:

- `GET /mcp/connectors`
- `POST /mcp/call`

Skills:

- `GET /api/skills`

## Core Intent -> Plan -> Execute Flow

The main assistant workflow lives in `backend/routes/chat.js` and `frontend/src/store/appStore.js`.

1. Frontend calls `extractIntent(text)` from `frontend/src/api/client.js`.
2. Backend `/intent` recalls memory with `recallMemory`, calls `ai.chatJSON`, enriches confidence/clarification, then asynchronously extracts durable facts.
3. Frontend stores `lastIntent`, decides whether this is direct Q&A, build flow, or plan flow.
4. Frontend calls `/plan`.
5. Backend enriches plan steps with defaults such as `confidence`, `requires_input`, `parallel_group`, `fallback`, `service`, and estimated duration.
6. Frontend may require approval for coding/developer-sensitive plans, or auto-run for safe flows.
7. Frontend calls `/execute` with selected steps.
8. Backend executes with `executePlanBatches`.
9. Backend resolves skill handlers first through `services/skills.js`.
10. If a plan looks like app/code/build work, backend invokes `runAgent`.
11. Backend returns results, batches, review, and optional agent preview file.
12. Frontend saves module records, preview artifacts, session snapshots, and shows result.

Important behavior:

- App build requests are intentionally fast-pathed to a fallback plan and autonomous preview generation.
- Reminder steps fall back to local reminders if no external connector exists.
- External service steps return connector-required messages when credentials are missing.
- High-risk skills require confirmation.

## AI Router

File: `backend/services/ai.js`

Provider order depends on `AI_ROUTER_MODE` and task:

- Hybrid default:
  - Deep tasks (`agent`, `code`, large max token requests) prefer Gemini, then Anthropic, then Groq.
  - Fast tasks (`chat`, `intent`, `review`) prefer Groq, then Gemini, then Anthropic.
- Single-provider modes force one provider first: `groq`, `gemini`, or `anthropic`.

Circuit breakers:

- Failure limit: `AI_CIRCUIT_FAILURE_LIMIT`, default `3`.
- Reset: `AI_CIRCUIT_RESET_MS`, default `60000`.
- `/health` and `/status` expose provider state.

Fallback:

- `services/mockAI.js` is used when no real provider is configured or provider calls fail.
- `ai.isAvailable()` currently returns true because mock AI is always available.

## Memory

File: `backend/services/memory.js`

Memory supports two modes:

- Postgres + vector search through Prisma/pgvector-style raw vector queries.
- Local JSON fallback at `backend/data/memories.json`.

Important details:

- `VOICEAI_MEMORY_MODE=local` forces local file mode.
- OpenAI embeddings are required for vector memory.
- If DB or embeddings fail, memory save/recall falls back locally.
- Durable facts are extracted by AI, but secrets/payment data should not be remembered.

## Skill Registry

File: `backend/services/skills.js`

Built-in skills:

- `search` - answering and search, low risk.
- `schedule` - calendar/reminders, medium risk.
- `communicate` - email/messaging, high risk.
- `documents` - document creation/analysis, medium risk.
- `smart_home` - Home Assistant control, medium risk.
- `finance` - budget/expenses/finance data, high risk.
- `safety_review` - internal high-risk safety fallback.

Skill resolution:

- First by `module`.
- Then by `action_type`.

Risk levels:

- Low: can usually auto-run.
- Medium: show plan before execution.
- High: requires explicit/double confirmation.

## Agent Tools and Generated Files

File: `backend/services/tools.js`

Per-user generated files live in:

```text
backend/agent-output/<safe-user-id>/
```

Agent tools:

- `generate_code`
- `write_file`
- `read_file`
- `modify_file`
- `list_files`
- `preview_html`
- `search_web`
- `list_local_directory`
- `read_local_file`
- `write_local_file`
- `mcp_call`
- `run_terminal`
- `think`
- `complete`

Security boundaries:

- Normal agent files are restricted to the per-user `agent-output` workspace.
- Local computer access is disabled unless `LOCAL_COMPUTER_ACCESS=true` and `LOCAL_ACCESS_ROOTS` is configured.
- Local file writes also require `LOCAL_COMPUTER_WRITE=true`.
- Terminal cwd must stay inside the generated output workspace.

## Frontend Overview

Frontend entry:

- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

Key frontend files:

- `frontend/src/api/client.js` - all backend calls, Axios config, mock mode, stream headers, module APIs.
- `frontend/src/store/appStore.js` - central Zustand state and assistant workflow.
- `frontend/src/config.js` - Vite env vars and UI defaults.
- `frontend/src/hooks/useVoice.js` - voice capture behavior.
- `frontend/src/hooks/useWhisper.js` - backend transcription integration.
- `frontend/src/hooks/useTTS.js` and `useElevenLabs.js` - speech output.
- `frontend/src/hooks/useSocket.js` - Socket.IO agent/orchestrator events.

Important components:

- `App.jsx` - view routing and panel state.
- `LoginPage.jsx` - login flow.
- `HeroPrompt.jsx` - idle prompt surface.
- `BuilderView.jsx` - conversation/build workspace.
- `ConversationView.jsx` - chat/plan display.
- `PreviewPanel.jsx` - iframe preview of generated agent output.
- `AgentProgressPanel.jsx` - live agent progress.
- `BackgroundAgentsPanel.jsx` - background agent management.
- `MemoryView.jsx` - memory UI.
- `RoutinesPanel.jsx` - routine management.
- `RemindersPanel.jsx` - local reminders.
- `NovaModules.jsx` - life modules.
- `DashboardView.jsx`, `ProjectsView.jsx`, `TemplatesView.jsx` - app-level surfaces.

Frontend state persistence:

- Store key: `voxmind-store`.
- API keys are not persisted; persisted settings reset sensitive keys.
- JWT token is not rehydrated from localStorage; frontend forces re-login after reload.
- Runtime auth token is stored in memory through `setRuntimeAuthToken`.

Frontend dev proxy:

- `frontend/vite.config.js` proxies `/health` and `/api/auth` to backend unchanged.
- It proxies `/api` to backend and rewrites `/api/...` to `/...`.
- Frontend default `BACKEND_URL` is `/api`.
- Auth base URL helper appends `/api` when needed for auth routes.

## Auth Gotchas

Auth is required for almost all backend routes.

Important:

- `JWT_SECRET` must be configured or protected routes return 500.
- Public paths include `/health`, `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/session`, and `/api/auth/refresh`.
- Tokens are accepted from `Authorization: Bearer ...` or `nova_auth` httpOnly cookie.
- Query-string tokens are explicitly rejected.
- Refresh tokens use `nova_refresh` cookie scoped to `/api/auth`.
- In non-production login accepts any email and returns an admin-like dev user.
- In production login/register uses Prisma users and bcrypt passwords.

## Database / Prisma

Schema:

- `backend/prisma/schema.prisma`

Models:

- `User`
- `Memory`
- `Session`
- `Message`
- `Routine`
- `Execution`
- `Task`
- `MoodLog`
- `FinanceRecord`
- `EmergencyContact`
- `GeneratedDocument`
- `ModuleRecord`

Migrations:

- `backend/prisma/migrations/20260529073619_init_memory/migration.sql`
- `backend/prisma/migrations/20260715000000_full_schema/migration.sql`

Current Prisma datasource provider is PostgreSQL.

## Socket.IO

File: `backend/socket.js`

Socket.IO requires the same auth token/cookie as protected routes. Clients join `user:<userId>` rooms.

Important events:

- `stream:intent`
- `stream:intent:complete`
- `stream:plan`
- `stream:plan:complete`
- `stream:error`
- Backend emits agent/orchestrator/execution progress with `emitToUser`.

## Electron Desktop

Entry:

- `electron/src/main.js`

Behavior:

- Starts backend as a child process.
- Loads `frontend/dist/index.html`.
- Uses tray support and global hotkeys.
- Hides window to tray on close unless quitting.
- Uses `secure-store` IPC from preload/main.

Packaging:

- Build frontend first.
- Run `cd electron && npm run package`.

Important packaging note:

- Electron expects built frontend assets.
- Backend entry is `backend/server.js`.
- It sets `ELECTRON_RUN_AS_NODE=1`, `PORT=3001`, and `CORS_ORIGIN=file://` for the child backend.

## Mobile Client

Entry:

- `mobile/App.js`

Important files:

- `mobile/src/services/api.js`
- `mobile/src/navigation/TabNavigator.js`
- `mobile/src/screens/HomeScreen.js`
- `mobile/src/screens/ModulesScreen.js`
- `mobile/src/screens/SettingsScreen.js`

Default backend URL:

```text
http://10.0.2.2:3001
```

This is for Android emulator. Use `localhost` for iOS simulator or LAN IP for physical devices.

## Docker

`Dockerfile`:

- Stage 1 builds frontend with Node 20 Alpine.
- Stage 2 installs backend production dependencies.
- Copies backend source and built frontend to `/app/public`.
- Runs `npx prisma generate`.
- Creates `uploads`, `agent-output`, and `data`.
- Runs as non-root `nova` user.
- Exposes port `3001`.

`docker-compose.yml`:

- `postgres`
- `redis`
- `app`

Compose sets:

- `VOICEAI_MEMORY_MODE=local`
- `ALLOW_STUB_TRANSCRIPTION=true`
- `CONNECTOR_DEMO_MODE=true`
- A default Docker `JWT_SECRET`

Note: Redis is present in compose, but the inspected backend code does not appear to use Redis directly yet.

## Tests

Backend tests use Node's native test runner.

Files:

- `backend/tests/auth.test.js`
- `backend/tests/chat.test.js`
- `backend/tests/routines.test.js`
- `backend/tests/tools.test.js`

Run:

```bash
npm test
# or
cd backend && npm test
```

Frontend lint/build:

```bash
cd frontend
npm run lint
npm run build
```

## Common Development Tasks

Add or change a backend API route:

1. Add route handler under `backend/routes/` or extend an existing route file.
2. Mount it in `backend/server.js` if it is a new router.
3. Add/update client wrapper in `frontend/src/api/client.js`.
4. Update frontend store/component state as needed.
5. Add focused tests in `backend/tests/` if behavior is non-trivial.

Change the assistant flow:

1. Inspect `frontend/src/store/appStore.js`.
2. Inspect `backend/routes/chat.js`.
3. Keep frontend and backend intent/plan shape compatible.
4. Watch `requires_input`, `confidence`, `parallel_group`, `fallback`, `service`, `action`, and `action_type`.

Add a new skill:

1. Extend `backend/services/skills.js`.
2. Give it an id, modules/actions, risk level, `isConfigured`, and handler.
3. Ensure handler returns `{ success, result }`.
4. Add config env vars if it uses an external connector.
5. Make sure high-risk operations require explicit confirmation.

Add a new connector:

1. Extend `connectors` in `backend/services/mcp.js`.
2. Add `configured`, `actions`, and `handler`.
3. Add demo fallback if useful.
4. Expose through frontend settings/UI only after backend shape is stable.

Add a frontend panel/view:

1. Create component in `frontend/src/components/`.
2. Add navigation state in `App.jsx` and/or `Sidebar.jsx`.
3. Use existing CSS variables/Tailwind conventions.
4. Add API calls in `client.js` rather than calling Axios directly in components.

Work on generated preview behavior:

1. Backend agent writes to `backend/agent-output/<user>/`.
2. Backend serves via `/agent/output/*`.
3. Frontend builds preview URL with `getAgentOutputUrl`.
4. `appStore.js` creates `previewArtifact`.
5. `PreviewPanel.jsx` renders it.

## Important Gotchas

- Do not assume backend routes are unauthenticated. Most require JWT.
- Do not persist JWTs or API keys in localStorage.
- `ai.isAvailable()` returning true does not mean a real provider is configured; mock fallback may be active.
- Memory may silently fall back to local JSON if Postgres or OpenAI embeddings fail.
- `/api` paths in frontend dev are rewritten by Vite proxy, so backend route paths may differ from browser-visible paths.
- Build requests can trigger the autonomous agent and clear that user's generated output workspace.
- Agent file writes are intentionally sandboxed to `backend/agent-output`.
- Local computer access is opt-in and should remain guarded.
- `project_vision.md` describes the ambition; source files describe current reality.
- Some existing files contain mojibake/non-ASCII display artifacts in comments/log text. Avoid expanding that unless intentionally cleaning encoding.
- The worktree may already be dirty. Check `git status --short` before changing files and do not revert unrelated changes.

## Current Dirty Worktree When This File Was Created

At creation time, these files were already modified before this documentation file was added:

```text
.gitignore
backend/package-lock.json
backend/package.json
backend/prisma/schema.prisma
backend/services/moduleData.js
frontend/package-lock.json
```

Treat those as existing user/project changes unless the user explicitly asks to inspect or revert them.

## High-Signal Files To Read First

For almost any task, start here:

```text
README.md
project_vision.md
backend/server.js
backend/config.js
backend/routes/chat.js
backend/services/ai.js
backend/services/skills.js
backend/services/tools.js
backend/services/mcp.js
backend/services/memory.js
frontend/src/App.jsx
frontend/src/store/appStore.js
frontend/src/api/client.js
frontend/src/config.js
backend/prisma/schema.prisma
```

## Quick Mental Model

NOVA is not just a chat app. The product is an assistant workspace:

- Frontend gathers user input by text/voice/file/screen context.
- Backend extracts intent and remembers relevant stable facts.
- Backend generates a plan, with risk and missing-info markers.
- Frontend decides approval/autopilot behavior.
- Backend executes with skills, connectors, reminders, and autonomous generated-file tools.
- Frontend stores the result in conversation/module state and shows previews when relevant.

When editing, preserve that loop unless the task explicitly asks to replace it.
