<div align="center">

# ✦ VIVORA

### *AI-Powered Viva & Interview Preparation Platform*

**Study. Practice. Speak. Improve.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.142-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://python.org)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)](https://sqlite.org)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-blueviolet)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## 📖 Table of Contents

1. [What is VIVORA?](#-what-is-vivora)
2. [The 3 AI Agents](#-the-3-ai-agents)
3. [System Architecture](#-system-architecture)
4. [Data Flow Diagram](#-data-flow-diagram)
5. [WebSocket Protocol](#-websocket-protocol)
6. [Project Structure](#-project-structure)
7. [Tech Stack](#-tech-stack)
8. [Getting Started](#-getting-started)
9. [Environment Variables](#-environment-variables)
10. [API Reference](#-api-reference)
11. [Database Schema](#-database-schema)
12. [AI Agent Details](#-ai-agent-details)
13. [RAG Pipeline](#-rag-pipeline)
14. [Voice System](#-voice-system)
15. [Session State Machine](#-session-state-machine)
16. [Deployment](#-deployment)
17. [Contributing](#-contributing)

---

## 🎯 What is VIVORA?

**VIVORA** is a full-stack, real-time AI viva and interview preparation platform. It simulates the experience of sitting in front of an examiner — asking questions, listening to your spoken answers, evaluating your responses, and probing deeper with targeted follow-up questions.

VIVORA supports **three distinct AI agents** tailored for different audiences:

| Agent | Audience | Style |
|---|---|---|
| 🏫 **School Viva** | Class 8–12 students | Simple, foundational, encouraging |
| 🎓 **College Viva** | Undergraduate & postgraduate | Conceptual, analytical, selective cross-questioning |
| 💼 **Job Interview** | Working professionals & freshers | Resume-driven, role-specific, targeted cross-examination |

---

## 🤖 The 3 AI Agents

### 🏫 School Viva Agent

```
Input:  Textbook Q&A PDF / Study notes / Topic name
Output: Simple, direct recall questions
Style:  One question at a time. No cross-questioning. Encouraging feedback.
Example: "What is photosynthesis? Where does it take place in the cell?"
```

- Accepts **PDF textbooks, Q&A sheets, or typed topic names**
- Generates **foundational recall questions** — definitions, processes, facts
- Feedback is **positive and motivating** — suitable for younger students
- **No follow-up cross-questioning** — each answer moves to the next question

---

### 🎓 College Viva Agent

```
Input:  Syllabus PDF / Lab manual / Topic outline
Output: Conceptual & application-level viva questions
Style:  Progressive depth. Selective follow-up probing.
Example: "Explain how Banker's Algorithm prevents deadlock. What are its limitations?"
```

- Accepts **textbook chapters, syllabus outlines, practical lab manuals** (PDF or text)
- Generates **conceptual and application-level questions** using Gemini AI
- Applies **selective cross-examination** — only on important answers, not every one
- Follow-up probes: *"Why this approach over X? What if Y fails?"*

---

### 💼 Job Interview Agent

```
Input:  Resume PDF + Target Job Role (text)
Output: Resume-driven, role-specific technical & behavioural questions
Style:  Cross-examination on experience, projects, and role-specific skills
Example: "You mentioned React in your resume — explain how you handled state
          management in your e-commerce project."
```

- Accepts **Resume PDF** + **Target Role** text input
- AI reads your actual resume and asks questions **specifically about your experience**
- Applies **targeted cross-examination** on claimed resume experience
- Supports **experience level** selection: Entry / Mid / Senior
- Generates **role-specific technical questions** based on the job applied for

---

## 🏗 System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         VIVORA PLATFORM                              │
│                                                                      │
│  ┌───────────────────────┐       ┌──────────────────────────────┐   │
│  │   FRONTEND (Next.js)  │       │     BACKEND (FastAPI)         │   │
│  │                       │       │                              │   │
│  │  ┌─────────────────┐  │       │  ┌────────────────────────┐  │   │
│  │  │  Landing Page   │  │       │  │    REST API Routes     │  │   │
│  │  │  (Agent Select) │◄─┼──HTTP─►  │  /auth /sessions       │  │   │
│  │  └─────────────────┘  │       │  │  /upload  /reports     │  │   │
│  │                       │       │  └────────────────────────┘  │   │
│  │  ┌─────────────────┐  │       │                              │   │
│  │  │  Session Room   │◄─┼──WS───►  ┌────────────────────────┐  │   │
│  │  │  (Live Viva)    │  │       │  │  WebSocket Handler     │  │   │
│  │  └─────────────────┘  │       │  │  /ws/session/{id}      │  │   │
│  │                       │       │  └───────────┬────────────┘  │   │
│  │  ┌─────────────────┐  │       │              │               │   │
│  │  │  Report Page    │◄─┼──HTTP─►  ┌───────────▼────────────┐  │   │
│  │  │  (Scorecard)    │  │       │  │     ORCHESTRATOR        │  │   │
│  │  └─────────────────┘  │       │  └─────┬────┬────┬────────┘  │   │
│  └───────────────────────┘       │        │    │    │           │   │
│                                  │  ┌─────▼┐ ┌─▼──┐ ┌▼───────┐ │   │
│                                  │  │  Q   │ │Eval│ │Followup│ │   │
│                                  │  │Agent │ │Agt │ │ Agent  │ │   │
│                                  │  └──┬───┘ └─┬──┘ └───┬────┘ │   │
│                                  │     └────────┴────────┘      │   │
│                                  │              │               │   │
│                                  │  ┌───────────▼────────────┐  │   │
│                                  │  │      LLM ROUTER         │  │   │
│                                  │  │  Gemini / Smart Fallback│  │   │
│                                  │  └───────────┬────────────┘  │   │
│                                  │              │               │   │
│                                  │  ┌───────────▼────────────┐  │   │
│                                  │  │      RAG PIPELINE       │  │   │
│                                  │  │  PDF → Chunks → Context │  │   │
│                                  │  └───────────┬────────────┘  │   │
│                                  │              │               │   │
│                                  │  ┌───────────▼────────────┐  │   │
│                                  │  │    SQLite Database      │  │   │
│                                  │  │ Sessions/Questions/Evals│  │   │
│                                  │  └────────────────────────┘  │   │
│                                  └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
USER              FRONTEND              BACKEND               GEMINI AI
 │                    │                     │                     │
 │ 1. Select Mode     │                     │                     │
 │ (School/College/   │                     │                     │
 │  Interview)        │                     │                     │
 │───────────────────►│                     │                     │
 │                    │                     │                     │
 │ 2. Upload PDF or   │                     │                     │
 │    Enter Topic     │  POST /upload       │                     │
 │───────────────────►│────────────────────►│ Parse PDF           │
 │                    │                     │ Chunk text          │
 │                    │                     │ Store in DB         │
 │                    │◄─── document_id ────│                     │
 │                    │                     │                     │
 │ 3. Start Session   │  POST /sessions     │                     │
 │───────────────────►│────────────────────►│                     │
 │                    │◄─── session_id ─────│                     │
 │                    │                     │                     │
 │                    │  WS: CONNECT        │                     │
 │                    │────────────────────►│                     │
 │                    │  WS: {auth, token}  │                     │
 │                    │────────────────────►│ Verify JWT          │
 │                    │◄─── auth_ok ────────│                     │
 │                    │                     │                     │
 │                    │◄─── question_ready ─│──── Generate Q ────►│
 │                    │     + TTS speech    │◄─── Questions ──────│
 │ AI speaks question │                     │                     │
 │◄───────────────────│                     │                     │
 │                    │                     │                     │
 │ 4. Speak Answer    │  WS: stt_partial    │                     │
 │───────────────────►│────────────────────►│ (stream)            │
 │                    │                     │                     │
 │ 5. Submit Answer   │  WS: submit_answer  │                     │
 │───────────────────►│────────────────────►│                     │
 │                    │◄─── evaluating ─────│                     │
 │                    │                     │──── Evaluate ──────►│
 │                    │                     │◄─── Scores ─────────│
 │                    │◄── eval_result ─────│                     │
 │ Feedback shown     │                     │                     │
 │◄───────────────────│                     │                     │
 │                    │                     │                     │
 │                    │  (If follow-up due) │──── Follow-up Q ───►│
 │                    │◄── followup_question│◄─── Question ───────│
 │                    │                     │                     │
 │ 6. All Q Done      │                     │                     │
 │                    │◄── session_completed│──── Final Report ──►│
 │                    │                     │◄─── Report Data ────│
 │ 7. View Scorecard  │  GET /report/{id}   │                     │
 │◄───────────────────│────────────────────►│                     │
```

---

## 🔌 WebSocket Protocol

The real-time session runs over a **persistent WebSocket** at `/ws/session/{session_id}`.

### Client → Server Messages

| `type` | Payload | Description |
|---|---|---|
| `auth` | `{ token: string }` | JWT auth — **must be first message within 5s** |
| `submit_answer` | `{ transcript: string }` | Submit spoken/typed answer for evaluation |
| `stt_partial` | `{ transcript: string }` | Live speech stream (continuous updates) |
| `replay_question` | `{}` | Re-read the current question aloud |
| `skip_question` | `{}` | Skip to the next question |
| `ask_doubt` | `{ doubt: string }` | Ask for clarification (no score penalty) |
| `end_session` | `{}` | End interview and generate final report |
| `retry_evaluation` | `{ question_id?: string }` | Re-evaluate last answer (max 2 retries) |

### Server → Client Messages

| `type` | Payload | Description |
|---|---|---|
| `auth_ok` | — | Authentication successful |
| `session_started` | `{ total_questions, language }` | Session initialized |
| `question_ready` | `{ question, question_index, total_questions, speech }` | New question |
| `followup_question` | `{ question, speech }` | AI-triggered follow-up probe |
| `evaluating` | `{ message }` | Evaluation in progress |
| `evaluation_result` | `{ evaluation }` | Scores + feedback |
| `doubt_answered` | `{ doubt: { explanation } }` | Clarification response |
| `question_repeated` | `{ speech }` | Question audio replay |
| `session_completing` | `{ message }` | Generating final report |
| `session_completed` | `{ report_id, report }` | Session finished |
| `session_timeout` | `{ message }` | Time limit reached |
| `error` | `{ code, message }` | Error details |

---

## 📁 Project Structure

```
VIVORA/
├── 📄 README.md
├── 📄 docker-compose.yml
├── 📄 .gitignore
│
├── 🐍 backend/
│   ├── 📄 requirements.txt
│   ├── 📄 Dockerfile
│   ├── 📄 alembic.ini
│   ├── 📄 .env.example
│   ├── alembic/                      # DB migrations
│   └── app/
│       ├── 📄 main.py                # FastAPI entry point + CORS
│       │
│       ├── agents/                   # AI Agent System
│       │   ├── 📄 base.py            # Agent base class
│       │   ├── 📄 orchestrator.py    # Central dispatcher
│       │   ├── 📄 question_agent.py  # Q generation (all 3 modes)
│       │   ├── 📄 evaluator_agent.py # Answer scoring & rubric
│       │   ├── 📄 followup_agent.py  # Follow-up cross-questions
│       │   ├── 📄 interviewer_agent.py  # TTS turn preparation
│       │   ├── 📄 intake_agent.py    # Document ingestion & RAG
│       │   ├── 📄 doubt_agent.py     # Doubt/clarification handler
│       │   └── 📄 report_agent.py    # Final scorecard generation
│       │
│       ├── api/
│       │   ├── routes/
│       │   │   ├── 📄 auth.py        # /auth/register, /auth/login
│       │   │   ├── 📄 sessions.py    # /sessions CRUD
│       │   │   ├── 📄 upload.py      # /upload PDF processing
│       │   │   └── 📄 reports.py     # /report/{id}
│       │   └── ws/
│       │       └── 📄 interview_ws.py  # WebSocket session handler
│       │
│       ├── llm/
│       │   ├── 📄 router.py          # LLM provider routing + fallback
│       │   └── 📄 prompts.py         # Agent-specific prompt templates
│       │
│       ├── rag/
│       │   └── 📄 retriever.py       # PDF chunking + context retrieval
│       │
│       ├── db/
│       │   ├── 📄 database.py        # SQLAlchemy engine + session
│       │   └── 📄 models.py          # ORM models
│       │
│       ├── schemas/
│       │   └── 📄 ws_messages.py     # WebSocket message schemas
│       │
│       ├── services/
│       │   └── 📄 session_service.py # Business logic layer
│       │
│       └── core/
│           └── 📄 auth.py            # JWT creation & verification
│
└── ⚛️ frontend/
    ├── 📄 package.json
    ├── 📄 next.config.js
    ├── 📄 tailwind.config.js
    └── src/
        ├── app/
        │   ├── 📄 page.tsx            # Landing page + Agent launch modal
        │   ├── 📄 layout.tsx          # Root layout + fonts
        │   ├── 📄 globals.css         # Design system tokens
        │   ├── login/                 # Login page
        │   ├── signup/                # Registration page
        │   ├── session/[id]/          # Live session room (WS + voice + cam)
        │   ├── report/[id]/           # Final scorecard report
        │   └── parent-consent/        # Parental consent flow
        └── lib/
            ├── 📄 api.ts              # REST API client helpers
            ├── 📄 wsClient.ts         # WebSocket URL builder
            └── 📄 voice.ts            # BrowserVoiceClient (STT + TTS)
```

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose | Version |
|---|---|---|
| **FastAPI** | REST API + WebSocket server | 0.142 |
| **SQLAlchemy** | ORM & database layer | 2.0 |
| **SQLite** | Database (dev) | 3 |
| **Alembic** | Database migrations | 1.20 |
| **Pydantic** | Data validation & schemas | 2.13 |
| **pypdf** | PDF text extraction | 6.19 |
| **python-jose** | JWT auth tokens | 3.4 |
| **passlib + bcrypt** | Password hashing | — |
| **uvicorn** | ASGI server | 0.54 |
| **Google Gemini** | LLM for Q generation & evaluation | API |

### Frontend
| Technology | Purpose | Version |
|---|---|---|
| **Next.js** | React framework with App Router | 15 |
| **TypeScript** | Type-safe frontend | 5 |
| **Tailwind CSS** | Utility-first styling | 3 |
| **Lucide React** | Icon library | — |
| **Web Speech API** | Browser-native STT + TTS | Native |
| **WebSocket API** | Real-time session communication | Native |
| **MediaDevices API** | Webcam capture | Native |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **Git**
- **Google Gemini API key** (free at [ai.google.dev](https://ai.google.dev))

### 1. Clone the Repository

```bash
git clone https://github.com/Anu7276/VIVORA.git
cd VIVORA
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill in your environment variables
cp .env.example .env
# → Edit .env and add your GEMINI_API_KEY

# Run database migrations
alembic upgrade head

# Start the backend server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend: **`http://localhost:8000`** | Docs: **`http://localhost:8000/docs`**

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend: **`http://localhost:3000`**

### 4. Docker (All-in-One)

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |

---

## 🔐 Environment Variables

Create `backend/.env` from `.env.example`:

```env
# LLM Provider
GEMINI_API_KEY=your_google_gemini_api_key_here

# JWT Auth
SECRET_KEY=your_very_long_random_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Database
DATABASE_URL=sqlite:///./vivora.db

# CORS (comma-separated allowed origins)
ALLOWED_ORIGINS=http://localhost:3000

# Session Defaults
DEFAULT_TIME_LIMIT_MIN=30
MAX_QUESTIONS_PER_SESSION=9
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login — returns JWT token |
| `GET` | `/auth/me` | Get current user profile |

### Sessions

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/sessions` | Create a new viva session |
| `GET` | `/sessions/{id}` | Get session + questions |
| `GET` | `/sessions` | List user sessions |

### Upload

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload PDF (resume / syllabus / Q&A) |

### Reports

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/report/{session_id}` | Get final scorecard report |

### WebSocket

| Protocol | Endpoint | Description |
|---|---|---|
| `WS` | `/ws/session/{session_id}` | Live real-time session room |

---

## 🗄 Database Schema

```
users ──────────────────────────────── documents
  │ id, email, name, hashed_password     │ id, user_id, title, doc_type,
  │                                      │ extracted_text
  │                                      │
  └──────────► sessions ◄───────────────┘
                │ id, user_id, document_id, mode,
                │ title, status, job_role, experience_level,
                │ current_question_no, awaiting_followup,
                │ active_followup_id, time_limit_min
                │
                └──────────► questions
                               │ id, session_id, parent_question_id,
                               │ order_no, question_text, topic,
                               │ difficulty, origin, reference_answer,
                               │ followup_question, followup_answer
                               │
                               └──────────► answers
                                             │ id, question_id, transcript,
                                             │ duration_sec, filler_count,
                                             │ answered_at
                                             │
                                             └──────────► evaluations
                                                           id, answer_id,
                                                           correctness_score,
                                                           depth_score,
                                                           clarity_score,
                                                           overall_score,
                                                           feedback,
                                                           missing_concepts,
                                                           model_answer

sessions ──────────────────────────────────► reports
                                              id, session_id, overall_score,
                                              strengths, improvements,
                                              revision_plan,
                                              communication_feedback
```

---

## 🧠 AI Agent Details

### Agent Routing

```
QuestionAgent
  ├── mode = "school"    → Simple recall Qs (definitions, processes)
  ├── mode = "college"   → Conceptual + application Qs (from syllabus/PDF)
  └── mode = "interview" → Resume-driven + role-specific Qs

FollowupAgent
  ├── mode = "school"    → DISABLED (no cross-questioning)
  ├── mode = "college"   → Selective probing on important concepts
  │                         "Why this? What if X fails?"
  └── mode = "interview" → Targeted cross-examination on resume claims
                           "You mentioned Redis — how did you handle
                            cache invalidation at scale?"

EvaluatorAgent
  ├── Correctness score (0–10): Factual accuracy
  ├── Depth score       (0–10): Conceptual completeness
  ├── Clarity score     (0–10): Communication quality
  └── Overall score     (0–10): Weighted composite

ReportAgent
  └── Final scorecard: overall score, strengths, gaps,
      revision plan, communication feedback
```

### LLM Router & Fallback

```
Request
  │
  ▼
LLMRouter
  ├── Try Google Gemini API ──────────────────► Success → Return
  │         │
  │    Rate limited / API error
  │         │
  └── SmartRuleFallbackProvider ─────────────► Mode-specific mock data
                                               (sessions still work offline)
```

---

## 📚 RAG Pipeline

```
PDF Upload
  ↓
pypdf text extraction
  ↓
Text chunking (overlapping windows)
  ↓
Chunk storage in DB
  ↓
Question generation request
  ↓
Top-K chunk retrieval (context)
  ↓
Prompt = System Instructions + Mode + Retrieved Context
  ↓
Gemini generates questions with reference answers
```

| Mode | doc_type | Content |
|---|---|---|
| School | `questions` | Q&A pairs, study notes, topics |
| College | `syllabus` | Textbook chapters, lab manuals |
| Interview | `resume` | Candidate resume / CV |

---

## 🎙 Voice System

```
BrowserVoiceClient (browser-native, no external SDK)
  │
  ├── STT: Web Speech API (SpeechRecognition)
  │     Continuous listening mode
  │     onPartialTranscript → WS stt_partial (live stream)
  │     onFinalTranscript   → stored for submit_answer
  │
  └── TTS: SpeechSynthesisUtterance
        AI questions read aloud automatically
        Rate: 0.95 | Pitch: 1.0 | Lang: en-IN
        Mic auto-starts after AI finishes speaking
```

**Browser compatibility:** Chrome ✅ | Edge ✅ | Safari ✅ | Firefox ⚠️ (text fallback available)

---

## 📊 Session State Machine

```
         CREATED
            │ WS connect + auth
            ▼
           LIVE ◄─────────────────────────────────┐
            │ submit_answer                        │
            ▼                                      │
       EVALUATING ──── follow-up triggered? ──► FOLLOW-UP Q
            │ no follow-up (or after follow-up)    │
            ▼                                      │
         NEXT Q ─── more questions? ───────────────┘
            │ all done / end_session / timeout
            ▼
       COMPLETING (generating report)
            │
            ▼
        COMPLETED → redirect to /report/{id}
```

---

## 🐳 Deployment

### Docker

```bash
docker-compose up --build -d
```

### Manual Production

```bash
# Backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# Frontend
npm run build && npm start
```

### Production Notes

- Replace SQLite with **PostgreSQL** by updating `DATABASE_URL`
- Use `wss://` (TLS) for WebSocket in production
- Set `ALLOWED_ORIGINS` to your actual domain
- Store `SECRET_KEY` and `GEMINI_API_KEY` in a secrets manager

---

## 🧪 Running Tests

```bash
cd backend
pytest tests/ -v
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit: `git commit -m "feat: add your feature"`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for students who want to think clearly, speak confidently, and perform better under pressure.**

*✦ VIVORA — Your next answer starts here.*

</div>
