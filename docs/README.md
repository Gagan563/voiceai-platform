# VoiceAI Platform Docs

This folder is for project documentation that should stay close to the code.

## Current Runtime

- Frontend: React + Vite, served locally on `http://localhost:3000`
- Backend: Express API, served locally on `http://localhost:3001`
- Desktop: Electron wrapper that loads `frontend/dist/index.html` and starts the backend process

## API Surface

- `GET /health` checks backend status.
- `POST /intent` extracts an intent from user text.
- `POST /plan` generates a step-by-step plan from an intent.
- `POST /execute` runs safe executable parts of a plan and reports connector-required steps.
- `POST /agent/run` runs the autonomous file/preview agent.
- `POST /transcribe` sends uploaded audio to Whisper when `OPENAI_API_KEY` is configured.
- `GET /memories/:userId` lists stored memories.
- `DELETE /memories/:userId/:memoryId` deletes one memory.
- `DELETE /memories/:userId/all` clears user memories.

## Environment

Create `backend/.env` for secrets and local settings:

```ini
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
DATABASE_URL=postgresql://voiceai:voiceai_secret@localhost:5432/voiceai_db
CORS_ORIGIN=http://localhost:3000
```

Frontend mock mode is opt-in:

```ini
VITE_USE_MOCK_API=true
```
