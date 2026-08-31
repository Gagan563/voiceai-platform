# NOVA Voice AI Platform — API Reference

## Authentication

All protected API endpoints require an authentication token via either:
1. `Authorization: Bearer <jwt_token>` header
2. `nova_auth` httpOnly cookie (set automatically on login)

### Auth Endpoints

| Endpoint | Method | Public | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Yes | Login with email and password |
| `/api/auth/register` | `POST` | Yes | Register new account |
| `/api/auth/refresh` | `POST` | Yes | Rotate access and refresh token |
| `/api/auth/logout` | `POST` | Yes | Clear auth cookies |
| `/api/auth/me` | `GET` | No | Get current authenticated user profile |
| `/api/auth/change-password` | `POST` | No | Update password |

---

## Core AI & Planning

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `POST /intent` | Extract structured intent from user text |
| `POST /plan` | Generate step-by-step execution plan from intent |
| `POST /execute` | Execute approved plan batches with skills & connectors |
| `POST /chat/direct` | Direct Q&A answering |
| `POST /chat/stream` | Server-Sent Events (SSE) streaming chat |

---

## Autonomous Agent

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `POST /agent/run` | Run autonomous code/app generation loop |
| `POST /orchestrate` | Multi-agent DAG orchestration across specialist agents |
| `GET /agents` | List specialist agent personas |
| `POST /upload` | Upload context files for agent |
| `GET /agent/output/*` | Serve generated preview files (HTML, CSS, JS, etc.) |
| `GET /agent/files` | List generated files in output workspace |

---

## Life Modules

| Module | Endpoints |
| :--- | :--- |
| **Legal** | `POST /nova/legal/ask`, `POST /nova/legal/document` |
| **Agriculture/Farm** | `POST /nova/farm/crop-advice`, `POST /nova/farm/pest-identify` |
| **Wellness** | `POST /nova/wellness/mood-checkin`, `GET /nova/wellness/breathing` |
| **Emergency** | `GET /nova/emergency/first-aid`, `GET /nova/emergency/contacts` |
| **Tasks & Records** | `GET/POST/PATCH/DELETE /api/tasks`, `/api/finance-records`, `/api/mood-logs` |

---

## System & Monitoring

| Endpoint | Method | Public | Description |
| :--- | :--- | :--- | :--- |
| `GET /health` | Service status, uptime, AI router state | Yes |
| `GET /metrics` | Request metrics, memory usage, status codes | Yes |
| `GET /status` | Detailed connector & provider configuration status | No |
