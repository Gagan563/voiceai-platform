# VoxMind VoiceAI Platform

VoxMind is a voice-first AI workspace with a React frontend, Express backend, Whisper transcription, Gemini-powered intent and planning, persistent memory, and a desktop Electron wrapper.

## What Works Now

- Text and voice input from the web app.
- Voice capture uses `MediaRecorder` and sends audio to the backend `/transcribe` route.
- Backend transcription uses OpenAI Whisper when `OPENAI_API_KEY` is configured.
- Intent extraction and plan generation run through a hybrid backend AI router with provider circuit breakers.
- Plan approval runs `/execute` and saves results into the right module workspace.
- Plan cards support partial approval, so you can run only selected steps.
- Low-confidence intent detection asks one clarifying question before planning.
- Plan steps include confidence scores and safe parallel execution batches.
- Execution includes a self-review with issues, corrections, and confidence.
- Saved routines are available through the web Routines panel and `/routines` API.
- Image and screen context can be attached through `/context/image` when Gemini vision is configured.
- 12 module surfaces are available: chat, tasks, writing, search, health, finance, learning, home, travel, media, translate, and business.
- MCP-style connector discovery and guarded connector calls are available at `/mcp/connectors` and `/mcp/call`.
- Unconfigured connectors return useful demo responses by default with `CONNECTOR_DEMO_MODE=true`.
- Memory works with Postgres + pgvector when configured and falls back to a local JSON store otherwise.
- Backend status is available at `/status`.
- Settings, memory, history, onboarding, toast notifications, and UI error boundary are present.
- Electron packaging works after building the frontend.

## Project Structure

```text
backend/   Express API, AI service, memory, transcription, agent tools
frontend/  React + Vite + Tailwind application
electron/  Desktop wrapper
docs/      Runtime and API notes
mobile/    Placeholder for future mobile client
shared/    Placeholder for shared schemas/helpers
scripts/   Placeholder for automation scripts
```

## Setup

Install dependencies in each app:

```bash
cd backend
npm install

cd ../frontend
npm install

cd ../electron
npm install
```

Create `backend/.env`:

```ini
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key_optional
OPENAI_API_KEY=your_openai_key
DATABASE_URL=postgresql://voiceai:voiceai_secret@localhost:5432/voiceai_db
CORS_ORIGIN=http://localhost:3000
```

`OPENAI_API_KEY` is required for real Whisper transcription. Without it, the backend returns a friendly configuration error unless `ALLOW_STUB_TRANSCRIPTION=true` is set for demos.

Optional AI router settings:

```ini
AI_ROUTER_MODE=hybrid
AI_CIRCUIT_FAILURE_LIMIT=3
AI_CIRCUIT_RESET_MS=60000
GEMINI_MODEL=gemini-2.5-flash
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

Optional MCP connector credentials:

```ini
GOOGLE_CALENDAR_TOKEN=...
EMAIL_API_KEY=...
HOME_ASSISTANT_URL=...
HOME_ASSISTANT_TOKEN=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

Set `CONNECTOR_DEMO_MODE=false` if you want unconfigured connectors to fail instead of returning demo data.

For no-database local development, keep:

```ini
VOICEAI_MEMORY_MODE=local
```

## Run Web App

Start backend:

```bash
cd backend
npm run dev
```

Start frontend:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

Backend health:

```text
http://localhost:3001/health
```

Backend service status:

```text
http://localhost:3001/status
```

Useful automation/context routes:

```text
GET    /routines
POST   /routines
POST   /routines/:id/run
POST   /context/image
```

## Mobile

The React Native client in `mobile/` is dependency-resolved and points Android emulators to:

```text
http://10.0.2.2:3001
```

Run:

```bash
cd mobile
npm install
npm start
```

## Desktop

Build frontend first:

```bash
cd frontend
npm run build
```

Package Electron:

```bash
cd ../electron
npm run package
```

## Verify

```bash
cd backend
npm test

cd ../frontend
npm run lint
npm run build

cd ../electron
npm run package
```
