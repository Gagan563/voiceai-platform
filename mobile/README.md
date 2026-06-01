# VoxMind Mobile

React Native client for the VoxMind backend.

## Current Features

- Bottom-tab navigation.
- Home screen connected to backend health, intent, plan, execute, and transcription APIs.
- Modules screen connected to search, finance quote, translation, and MCP connector APIs.
- Settings screen for backend URL/API notes.

## Backend URL

The mobile API client defaults to:

```text
http://10.0.2.2:3001
```

Use this for the Android emulator. For iOS simulator or a real device, update `src/services/api.js` to `http://localhost:3001` or your machine LAN IP.

## Run

```bash
npm install
npm start
npm run android
```

Real voice transcription still requires `OPENAI_API_KEY` in `../backend/.env`.
