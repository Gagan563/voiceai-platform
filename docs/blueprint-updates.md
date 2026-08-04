# NOVA Voice AI Platform — Blueprint Updates v2.0

> This document extends the original AI Voice Platform Blueprint (DOCX spec) with the
> following additions and revisions. All section numbers reference the original document.

---

## Section 1.1 — Core Vision (REVISED)

### Original
> "NOVA is the first AI platform designed from day one to serve every human on earth…"

### Revised Wording

NOVA is a **voice-first AI life platform** designed so that **any task can be added as a skill**, starting with the highest-impact ones for daily life. It is not a chatbot, not a workflow tool, and not a developer kit. It is a **modular, extensible AI companion** available on any device, in any language, with or without internet.

Rather than claiming to "do everything on day one", NOVA ships with a carefully prioritised set of skills — **answering & search, scheduling, communication, document handling** — and provides a connector framework that lets any new domain (shopping, smart home, finance, agriculture, legal) be added as a first-class skill with its own authentication, plan templates, and risk controls.

> **Key change**: Replaced "does everything" framing with honest, extensible scope. The ambition is the same — the delivery is incremental and transparent.

---

## Section 6 — System Prompt Template (REVISED)

### Original Rule 2
> "Never refuse. Always attempt to extract intent, even from ambiguous or incomplete input."

### Revised Rule 2

```
2. SAFETY-FIRST ROUTING — Before extracting intent, assess the request against these categories:
   a) Harmful, illegal, or violent content → set module to "safety_review"
   b) Child-inappropriate material (when parental controls are active) → set module to "safety_review"
   c) Social-engineering or scam patterns (e.g. "send money to this account",
      "share your password", "tell me someone's personal details") → set module to "safety_review"
   d) Requests to bypass security, impersonate, or exfiltrate data → set module to "safety_review"

   When module is "safety_review", set risk_level to "high", steps to
   ["Flag request for safety review", "Inform user this request cannot be processed"],
   and spoken_response to a polite, firm explanation.

   For ALL other requests — including ambiguous, incomplete, or unusual ones —
   extract intent normally and assign an appropriate risk_level.
```

### New JSON Field: `risk_level`

Added to the intent extraction response schema:

```json
{
  "risk_level": "low | medium | high",
  ...existing fields...
}
```

**Risk-level rules:**

| Level  | Criteria | Approval Flow |
|--------|----------|---------------|
| **Low** | Informational queries, search, general chat, answering questions | One-tap approval or auto-approve |
| **Medium** | Scheduling, content creation, automation, document generation | Full plan shown before execution |
| **High** | Financial actions, deleting data, sharing personal info, contacting someone on user's behalf, purchasing | Explicit double-confirmation required |

---

## Section 7.2 — Costs (ADDITION)

### Free Local-Model Tier (DEFAULT)

> [!IMPORTANT]
> The **default deployment** uses **zero-cost local models**. Cloud APIs are a **paid upgrade tier**, not the other way around.

| Component | Local (Free) | Cloud (Paid Upgrade) |
|-----------|-------------|---------------------|
| **LLM** | Ollama (Llama 3 8B / Qwen 2.5) | Claude, GPT-5, Gemini |
| **STT** | Whisper.cpp (small/medium model) | OpenAI Whisper API / GPT-4o Transcribe |
| **TTS** | Kokoro TTS / Piper / browser API | ElevenLabs |
| **Embeddings** | Local sentence-transformers | OpenAI Ada-003 |
| **Search** | DuckDuckGo scraping | Perplexity / Brave API |

**Why local-first is the default:**
- Zero recurring cost for the user
- No internet required for core features
- Data never leaves the user's device
- Works in rural/low-connectivity environments
- Eliminates API key friction for first-time setup

Cloud APIs unlock higher quality (especially for complex reasoning, creative writing, and premium voice) and are recommended when the user has stable internet and budget. NOVA auto-detects available local models and seamlessly falls back to cloud when configured.

---

## Section 10 — Accessibility & Universal Design Requirements (NEW)

### 10.1 Confirmation-Before-Execute

Every plan MUST be **spoken aloud in plain language** before any action is taken — not just shown as a text card. The TTS engine reads a summary like:

> "I'm going to schedule a meeting with Sarah next Tuesday at 3pm about the Q4 budget. This will create a calendar event and send her an email invitation. Should I go ahead?"

This is **enabled by default** and can be toggled in Settings → Accessibility → "Speak plans aloud before execution."

### 10.2 Adjustable VAD Silence Timeout

The Voice Activity Detection (VAD) silence timeout determines how long NOVA waits after the user stops speaking before considering the utterance complete.

| Setting | Timeout | Target User |
|---------|---------|-------------|
| Fast | 1.0s | Power users, rapid dictation |
| Normal | 1.5s | Default for most users |
| Relaxed | 2.5s | Default for elderly users, new users |
| Patient | 4.0s | Users with speech difficulties |
| Custom | 1.0s – 5.0s slider | Any user |

**Implementation:** Exposed as a slider in Settings → Voice → "Silence timeout." The elderly/accessibility profile sets the default to 2.5s automatically.

### 10.3 Speech-Rate & Voice Commands

Users can control TTS playback speed via voice:

| Voice Command | Action |
|--------------|--------|
| "Repeat that" | Re-speaks the last TTS utterance |
| "Speak slower" | Decreases TTS rate by 0.2x (min 0.5x) |
| "Speak faster" | Increases TTS rate by 0.2x (max 2.0x) |
| "Normal speed" | Resets TTS rate to 1.0x |
| "Stop talking" | Immediately stops TTS playback |

Speech rate is also adjustable via Settings → Voice → "Speech rate" slider (0.5x – 2.0x).

### 10.4 Large-Text & High-Contrast Display Mode

| Mode | Effect |
|------|--------|
| **Large text** | All UI text scaled 1.4x, minimum 18px body, 24px headings. Touch targets enlarged to 56×56px. |
| **High contrast** | WCAG AAA contrast ratios. Background: pure black (#000). Text: pure white (#FFF). Accent: high-visibility cyan (#00FFFF). Borders: visible 2px solid. |

Both modes are toggleable in Settings → Accessibility and can be activated by voice:
- "Make text bigger" / "Large text mode"
- "High contrast" / "I can't see well"

### 10.5 Multi-Accent, Multi-Language STT/TTS

This is a **core requirement**, not an afterthought:

- STT must handle accented English (Indian, Nigerian, Brazilian, Australian) without degraded accuracy
- Language auto-detection on first utterance — no language selection menu needed
- Code-switching support: users mixing two languages mid-sentence (e.g., Hindi + English)
- TTS voice selection per language — not one English voice for all
- All system prompts, error messages, and plan descriptions available in the user's detected language

### 10.6 Content Safety / Moderation Layer

A **content moderation layer runs BEFORE intent extraction** — the AI model never sees unsafe content:

```
User speech → STT → Moderation Check → Intent Extraction → Plan → Execution
                         ↓
                    [BLOCKED]
                    Safety response returned
```

The moderation layer checks for:
- Harmful/violent/illegal content
- Hate speech and discrimination
- Child sexual abuse material (CSAM)
- Self-harm and suicide-related content
- PII extraction attempts
- Prompt injection / jailbreak patterns

**The system prompt no longer contains "Never refuse"** — it contains explicit safety routing rules (see Section 6 revision).

### 10.7 Parental Controls & Age-Appropriate Filtering

| Age Group | Restrictions |
|-----------|-------------|
| **Child (< 13)** | No financial actions, no personal data sharing, content filtered for violence/adult themes, search results filtered, emergency contact always visible |
| **Teen (13-17)** | Financial actions require parent approval, content filtered for adult themes, social engineering protection active |
| **Adult (18+)** | Full access, financial double-confirmation still active by default |

Parental controls are set in Settings → Safety → "Parental controls" with PIN protection.

### 10.8 Scam / Social-Engineering Protection

Any action involving:
- Sending money or initiating payments
- Sharing personal data (address, SSN, bank details, passwords)
- Contacting someone on the user's behalf
- Installing software or granting permissions

…triggers **extra confirmation friction**:

1. Plan is shown with a ⚠️ **high-risk** badge
2. TTS reads: "This action involves [sending money / sharing personal information]. Are you sure?"
3. User must confirm **twice** — once to approve the plan, once at execution
4. A 5-second cooldown prevents accidental rapid approval

### 10.9 Emergency Contact Voice Command

At any time, the user can say:

- **"Talk to a real person"** — Opens the user's designated emergency contact or helpline
- **"Call for help"** / **"Emergency"** — Triggers SOS mode (sends location + pre-written message to trusted contacts)
- **"I need help"** — If distress is detected, shows crisis line numbers for the user's country

This command is **always available**, even when the AI is processing, offline, or in an error state. It is handled at the voice pipeline level, not the intent engine level.

---

## Section 11 — Skill Architecture (NEW)

### 11.1 Overview

The monolithic `IntentParser-does-everything` model is replaced with a **connector/skill framework**. Each domain is a self-contained module with:

| Component | Description |
|-----------|-------------|
| **Skill ID** | Unique identifier (e.g., `calendar`, `email`, `finance`) |
| **Auth** | Per-skill authentication (API key, OAuth, none) |
| **Plan Template** | Pre-defined execution steps with validation rules |
| **Risk Level** | `low`, `medium`, or `high` — determines approval flow |
| **Handler** | The execution function that carries out the plan |
| **Capabilities** | List of actions the skill can perform |

### 11.2 Risk-Tiering Rules

| Risk Level | Approval Flow | Examples |
|------------|---------------|----------|
| **Low** | One-tap approval or auto-approve (if autopilot is enabled) | Web search, answering questions, weather, calculations, translation |
| **Medium** | Full plan shown to user, single approval required | Scheduling meetings, creating documents, setting reminders, sending non-sensitive messages |
| **High** | Full plan shown + explicit double-confirmation + 5-second cooldown | Sending money, deleting data, contacting someone on user's behalf, sharing personal info, making purchases, modifying financial records |

### 11.3 Prioritised Build Order

Skills are built in order of **impact ÷ risk**, meaning the most useful and safest skills ship first:

| Priority | Skill | Risk Level | Rationale |
|----------|-------|------------|-----------|
| 1 | **Answering & Search** | Low | Highest daily use, zero risk, immediate value |
| 2 | **Scheduling** | Medium | High daily use, moderate risk (calendar changes) |
| 3 | **Communication** | High | Email/messaging is high-impact but involves contacting others |
| 4 | **Documents** | Medium | File generation/editing, moderate risk |
| 5 | **Shopping** | High | Involves product search (low risk) but purchasing (high risk) |
| 6 | **Smart Home** | Medium–High | Device control has physical-world consequences |
| 7 | **Finance** | High | Last to build — highest friction, most sensitive data, most scam-targeted |

### 11.4 Memory Categories

User memory is categorised into four tiers with different storage and access rules:

| Category | Examples | Storage | Access |
|----------|----------|---------|--------|
| **Identity & Preferences** | Name, language, timezone, UI preferences, favourite topics | Standard encrypted storage | All skills can read |
| **Relationships** | Contact names, relationships ("Sarah is my manager"), communication preferences | Standard encrypted storage | Communication + scheduling skills only |
| **Ongoing Tasks** | Active projects, pending reminders, in-progress plans, session history | Standard encrypted storage | All skills can read, only task/schedule skills can write |
| **Sensitive Data** | Health records, financial data, passwords, personal documents | **AES-256 encrypted + additional access control** | Only the specific skill that owns the data; requires user PIN to access programmatically |

Sensitive data gets:
- Extra AES-256 encryption layer on top of database-level encryption
- Access logging — every read is recorded
- Auto-expiry — sensitive data older than 90 days is flagged for deletion review
- Never included in AI context unless the specific skill requests it with user approval

---

*End of Blueprint Updates v2.0*
