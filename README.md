# VoiceAI Platform

A voice-first AI platform with multi-modal capabilities.

## Project Structure

```
voiceai-platform/
├── frontend/          # React web application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page-level components
│   │   ├── styles/       # Global styles and themes
│   │   └── utils/        # Helper functions
│   └── public/           # Static assets
│
├── backend/           # Node.js/Python API server
│   ├── src/
│   │   ├── routes/       # API route definitions
│   │   ├── controllers/  # Request handlers
│   │   ├── models/       # Data models
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Custom middleware
│   │   └── config/       # Configuration files
│   └── tests/            # Backend tests
│
├── electron/          # Desktop application wrapper
│   ├── src/              # Electron main/renderer
│   └── assets/           # Desktop app assets
│
├── mobile/            # React Native mobile app
│   ├── src/
│   │   ├── screens/      # Screen components
│   │   ├── components/   # Mobile UI components
│   │   ├── navigation/   # Navigation config
│   │   └── services/     # Mobile services
│   └── assets/           # Mobile assets
│
├── shared/            # Shared code across platforms
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Shared utilities
│
├── docs/              # Documentation
│   ├── api/              # API documentation
│   ├── architecture/     # Architecture diagrams
│   └── guides/           # Developer guides
│
└── scripts/           # Build and deployment scripts
```

## Getting Started

### Prerequisites
- Node.js 20+ (v24.4.1 installed)
- Python 3.11+ (v3.14.5 installed)
- Git 2.x (v2.50.1 installed)
- Docker Desktop (optional)

### Setup
```bash
# Clone the repo
git clone <repo-url>
cd voiceai-platform

# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies
cd ../backend && npm install
```

## License

MIT
