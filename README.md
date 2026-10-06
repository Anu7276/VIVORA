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
12. [AI Agent Routing](#-ai-agent-routing)
13. [LLM Router & Fallback](#-llm-router--fallback)
14. [RAG Pipeline](#-rag-pipeline)
15. [Voice System](#-voice-system)
16. [Session State Machine](#-session-state-machine)
17. [Deployment](#-deployment)
18. [Testing & Quality Assurance](#-testing--quality-assurance)
19. [Pre-Launch Audit & Hardening](#️-pre-launch-audit--hardening)
20. [Contributing](#-contributing)
21. [License](#-license)

---

## 🎯 What is VIVORA?

**VIVORA** is a full-stack, real-time AI viva and interview preparation platform. It simulates the experience of sitting in front of an examiner — asking questions, listening to your spoken answers, evaluating your responses, and probing deeper with targeted follow-up questions.

| Agent | Audience | Style |
|---|---|---|
| 🏫 **School Viva** | Class 8–12 students | Simple, foundational, encouraging |
| 🎓 **College Viva** | Undergraduate & postgraduate | Conceptual, analytical, selective cross-questioning |
| 💼 **Job Interview** | Working professionals & freshers | Resume-driven, role-specific, targeted cross-examination |

---

## 🤖 The 3 AI Agents

### 🏫 School Viva Agent
- Accepts **PDF textbooks, Q&A sheets, or typed topic names**
- Generates **foundational recall questions** — definitions, processes, facts
- Feedback is **positive and motivating** — suitable for younger students
- **No follow-up cross-questioning** — each answer moves to the next question
- *Example:* `"What is photosynthesis? Where does it take place in the cell?"`

### 🎓 College Viva Agent
- Accepts **textbook chapters, syllabus outlines, lab manuals** (PDF or text)
- Generates **conceptual and application-level questions** using Gemini AI
- Applies **selective cross-examination** — only on answers where depth matters
- Follow-up probes: *"Why this approach over X? What if Y fails instead?"*
- *Example:* `"Explain how Banker's Algorithm prevents deadlock. What are its limitations?"`

### 💼 Job Interview Agent
- Accepts **Resume PDF** + **Target Role** text input
- AI reads your actual resume and asks questions **specific to your experience**
- Applies **targeted cross-examination** on every claimed skill and project
- Supports **experience level**: Entry / Mid / Senior
- *Example:* `"You mentioned Redis — how did you handle cache invalidation at scale?"`

---

## 🏗 System Architecture

```mermaid
graph TB
    subgraph FE["⚛️ Frontend - Next.js"]
        LP["Landing Page\nAgent Select Modal"]
        SR["Session Room\nLive Viva + Camera"]
        RP["Report Page\nScorecard"]
    end

    subgraph BE["🐍 Backend - FastAPI"]
        REST["REST API\n/auth  /sessions  /upload  /reports"]
        WS["WebSocket Handler\n/ws/session/id"]

        subgraph AGT["🤖 Agent System"]
            ORC["Orchestrator\nCentral Dispatcher"]
            QA["Question Agent\nSchool / College / Interview"]
            EA["Evaluator Agent\nScoring and Rubric"]
            FA["Followup Agent\nCross-questioning"]
            RA["Report Agent\nFinal Scorecard"]
            DA["Doubt Agent\nClarification"]
        end

        LLM["LLM Router\nGemini + Smart Fallback"]
        RAG["RAG Pipeline\nPDF → Chunks → Context"]
        DB[("SQLite DB\nSessions / Questions\nAnswers / Evaluations")]
    end

    GEM["☁️ Google Gemini API"]

    LP -->|"HTTP POST /sessions"| REST
    LP -->|"HTTP POST /upload"| REST
    SR <-->|"WebSocket"| WS
    RP -->|"HTTP GET /report"| REST

    REST --> DB
    WS --> ORC
    ORC --> QA
    ORC --> EA
    ORC --> FA
    ORC --> RA
    ORC --> DA

    QA --> LLM
    EA --> LLM
    FA --> LLM
    RA --> LLM
    DA --> LLM

    LLM -->|"Primary"| GEM
    LLM -->|"Fallback"| LLM

    RAG --> DB
    ORC --> DB
```

---

## 🔄 Data Flow Diagram

```mermaid
sequenceDiagram
    actor User
    participant FE as "Frontend"
    participant BE as "Backend"
    participant GEM as "Gemini AI"

    User->>FE: Select Agent Mode
    User->>FE: Upload PDF or enter Topic
    FE->>BE: POST /upload
    BE->>BE: Parse PDF, chunk, store
    BE-->>FE: document_id

    User->>FE: Start Session
    FE->>BE: POST /sessions
    BE-->>FE: session_id

    FE->>BE: WebSocket CONNECT
    FE->>BE: type auth + token
    BE-->>FE: auth_ok

    BE->>GEM: Generate questions
    GEM-->>BE: Questions + reference answers
    BE-->>FE: question_ready + speech
    FE->>User: AI speaks question aloud

    User->>FE: Speak answer
    FE->>BE: stt_partial stream
    User->>FE: Submit answer
    FE->>BE: submit_answer + transcript

    BE-->>FE: evaluating
    BE->>GEM: Evaluate answer
    GEM-->>BE: Scores and feedback
    BE-->>FE: evaluation_result
    FE->>User: Show scores and feedback

    opt College or Interview mode
        BE->>GEM: Generate follow-up
        GEM-->>BE: Follow-up question
        BE-->>FE: followup_question + speech
        FE->>User: AI speaks follow-up
    end

    BE->>GEM: Generate final report
    GEM-->>BE: Report data
    BE-->>FE: session_completed + report_id
    FE->>BE: GET /report/session_id
    BE-->>FE: Full scorecard
    FE->>User: Redirect to report page
```

---

## 🔌 WebSocket Protocol

The real-time session runs over a **persistent WebSocket** at `/ws/session/{session_id}`.

### Client → Server

| `type` | Payload | Description |
|---|---|---|
| `auth` | `{ token }` | JWT auth — **must be first message within 5s** |
| `submit_answer` | `{ transcript }` | Submit spoken/typed answer for atomic evaluation |
| `stt_partial` | `{ transcript }` | Live speech stream (continuous) |
| `repeat_question` | `{}` | Re-read the current question aloud |
| `skip_question` | `{}` | Skip to the next question (factors into completion scoring) |
| `ask_doubt` | `{ doubt }` | Clarification request (rate-limited, no score penalty) |
| `end_session` | `{}` | End interview, generate final report |
| `retry_evaluation` | `{ question_id? }` | Re-evaluate last answer (max 2/question) |

### Server → Client

| `type` | Payload | Description |
|---|---|---|
| `auth_ok` | — | Authentication successful |
| `session_started` | `{ total_questions, language }` | Session initialized |
| `question_ready` | `{ question, question_index, total_questions, speech }` | New question |
| `followup_question` | `{ question, speech }` | AI-triggered follow-up probe |
| `evaluating` | `{ message }` | Evaluation in progress |
| `evaluation_result` | `{ evaluation }` | Scores + detailed feedback |
| `doubt_answered` | `{ doubt }` | Clarification response |
| `session_completed` | `{ report_id, report }` | Session finished |
| `session_timeout` | `{ message }` | Time limit reached |
| `error` | `{ code, message }` | Error details |

---

## 📁 Project Structure

```
VIVORA/
├── 📄 README.md
├── 📄 docker-compose.yml
│
├── 🐍 backend/
│   ├── 📄 requirements.txt
│   ├── 📄 Dockerfile
│   ├── 📄 .env.example
│   ├── alembic/                      # DB migrations
│   └── app/
│       ├── 📄 main.py                # FastAPI entry point + CORS
│       ├── agents/
│       │   ├── 📄 orchestrator.py    # Central dispatcher
│       │   ├── 📄 question_agent.py  # Q generation (all 3 modes)
│       │   ├── 📄 evaluator_agent.py # Scoring & rubric
│       │   ├── 📄 followup_agent.py  # Follow-up cross-questions
│       │   ├── 📄 interviewer_agent.py  # TTS turn preparation
│       │   ├── 📄 intake_agent.py    # Document ingestion & RAG
│       │   ├── 📄 doubt_agent.py     # Clarification handler
│       │   └── 📄 report_agent.py    # Final scorecard
│       ├── api/
│       │   ├── routes/               # auth / sessions / upload / reports
│       │   └── ws/
│       │       └── 📄 interview_ws.py  # WebSocket session handler
│       ├── llm/
│       │   ├── 📄 router.py          # LLM routing + fallback
│       │   └── 📄 prompts.py         # Agent-specific prompts
│       ├── rag/
│       │   └── 📄 retriever.py       # PDF chunking + retrieval
│       ├── db/
│       │   ├── 📄 database.py        # SQLAlchemy engine
│       │   └── 📄 models.py          # ORM models
│       ├── schemas/
│       │   └── 📄 ws_messages.py     # WebSocket schemas
│       ├── services/
│       │   └── 📄 session_service.py # Business logic
│       └── core/
│           └── 📄 auth.py            # JWT auth
│
└── ⚛️ frontend/
    └── src/
        ├── app/
        │   ├── 📄 page.tsx            # Landing page + modal
        │   ├── session/[id]/          # Live session room
        │   └── report/[id]/           # Scorecard report
        └── lib/
            ├── 📄 api.ts              # REST client
            ├── 📄 wsClient.ts         # WebSocket helper
            └── 📄 voice.ts            # STT + TTS client
```

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose | Version |
|---|---|---|
| **FastAPI** | REST API + WebSocket server | 0.142 |
| **SQLAlchemy** | ORM with eager loading (`joinedload`) | 2.0 |
| **SQLite (WAL)** | Database with WAL mode, foreign keys & `busy_timeout` | 3 |
| **Alembic** | Idempotent database migrations | 1.20 |
| **httpx** | Async connection-pooled HTTP client | 0.28 |
| **Groq API** | Low-latency inference (`qwen/qwen3.8-27b`) | API |
| **Google Gemini** | Question generation & comprehensive reporting | API |
| **Pydantic** | Strict schema validation | 2.13 |
| **pypdf** | PDF syllabus & resume text extraction | 6.19 |
| **python-jose** | JWT token authentication (HS256) | 3.4 |
| **bcrypt** | Password hashing | 4.0 |
| **uvicorn** | ASGI production server | 0.54 |

### Frontend
| Technology | Purpose | Version |
|---|---|---|
| **Next.js** | React framework (App Router) | 15 |
| **TypeScript** | Type-safe code | 5 |
| **Tailwind CSS** | Styling | 3 |
| **Lucide React** | Icons | — |
| **Web Speech API** | Browser STT + TTS | Native |
| **WebSocket API** | Real-time communication | Native |
| **MediaDevices API** | Webcam capture | Native |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **Google Gemini API key** — free at [ai.google.dev](https://ai.google.dev)

### 1. Clone

```bash
git clone https://github.com/Anu7276/VIVORA.git
cd VIVORA
```

### 2. Backend

```bash
cd backend

python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS / Linux

pip install -r requirements.txt
cp .env.example .env            # Add your GEMINI_API_KEY

alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

> API: `http://localhost:8000` | Docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

> App: `http://localhost:3000`

### 4. Docker

```bash
docker-compose up --build
```

---

## 🔐 Environment Variables

Create `backend/.env` based on `backend/.env.example`:

```env
# Core Environment
ENV=development                                      # 'production' enforces strict secret checks
JWT_SECRET_KEY=vivora-production-secure-jwt-secret-key-32chars  # Min 32 chars required
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_URL=sqlite:///./vivora.db

# LLM Providers (Multi-Provider Support)
GROQ_API_KEY=gsk_your_groq_api_key_here
GEMINI_API_KEY=AIzaSy_your_gemini_api_key_here
OPENAI_API_KEY=sk-your_openai_api_key_here

# Task-Specific Router Configuration
QUESTION_GEN_PROVIDER=gemini                         # 'gemini' | 'groq' | 'openai' | 'mock'
LIVE_PROVIDER=groq
EVALUATION_PROVIDER=groq
REPORT_PROVIDER=gemini

# Model Identifiers
GROQ_MODEL=qwen/qwen3.8-27b
GEMINI_MODEL=gemini-2.5-flash
OPENAI_MODEL=gpt-4o-mini

# Security & CORS
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

---

## 📡 API Reference

All REST endpoints are namespaced under `/api`:

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `GET` | `/health` | Basic application liveness probe | No |
| `GET` | `/health/ready` | Database readiness check (`SELECT 1`) | No |
| `POST` | `/api/auth/signup` | Register new student or candidate account | No |
| `POST` | `/api/auth/login` | Authenticate and retrieve JWT bearer token | No |
| `GET` | `/api/auth/me` | Fetch active user profile and role | Yes |
| `POST` | `/api/auth/parent-consent-confirm` | Confirm parental consent for minor accounts | No |
| `POST` | `/api/session/start` | Create a new exam session (rate-limited) | Yes |
| `GET` | `/api/session/{id}` | Retrieve session status, timer, and questions | Yes |
| `POST` | `/api/upload/file` | Ingest syllabus, textbook, or resume PDF | Yes |
| `POST` | `/api/upload/text` | Ingest raw topic or chapter text | Yes |
| `GET` | `/api/upload/status/{task_id}` | Poll background document ingestion status | Yes |
| `GET` | `/api/report/{session_id}` | Fetch completed scorecard and rubric metrics | Yes |
| `WS` | `/ws/session/{session_id}` | Real-time audio and exam state WebSocket | Yes (JWT) |

---

## 🗄 Database Schema

```mermaid
erDiagram
    users {
        string id PK
        string email
        string name
        string hashed_password
        datetime created_at
    }
    documents {
        string id PK
        string user_id FK
        string title
        string doc_type
        text extracted_text
        datetime created_at
    }
    sessions {
        string id PK
        string user_id FK
        string document_id FK
        string title
        string mode
        string status
        string job_role
        string experience_level
        int current_question_no
        bool awaiting_followup
        string active_followup_id
        int time_limit_min
        int time_used_sec
        datetime started_at
        datetime completed_at
    }
    questions {
        string id PK
        string session_id FK
        string parent_question_id FK
        int order_no
        text question_text
        string topic
        string difficulty
        string origin
        text reference_answer
    }
    answers {
        string id PK
        string question_id FK
        text transcript
        int duration_sec
        int filler_count
        datetime answered_at
    }
    evaluations {
        string id PK
        string answer_id FK
        float correctness_score
        float depth_score
        float clarity_score
        float overall_score
        text feedback
        text missing_concepts
        text model_answer
    }
    reports {
        string id PK
        string session_id FK
        float overall_score
        text strengths
        text improvements
        text revision_plan
        text communication_feedback
        datetime created_at
    }

    users ||--o{ sessions : "has"
    users ||--o{ documents : "uploads"
    documents ||--o{ sessions : "used in"
    sessions ||--o{ questions : "contains"
    questions ||--o| questions : "parent of"
    questions ||--o| answers : "answered by"
    answers ||--o| evaluations : "scored by"
    sessions ||--o| reports : "generates"
```

---

## 🧠 AI Agent Routing

```mermaid
flowchart TD
    REQ(["Incoming Request"]) --> ORC["Orchestrator"]
    ORC --> MODE{"Session Mode"}

    MODE -->|school| QAS["QuestionAgent - School\nSimple recall questions\nFrom Q and A pairs or topic keywords"]
    MODE -->|college| QAC["QuestionAgent - College\nConceptual + application\nFrom syllabus or PDF context"]
    MODE -->|interview| QAI["QuestionAgent - Interview\nResume-driven questions\nRole-specific probing"]

    QAS --> LLM["LLM Router"]
    QAC --> LLM
    QAI --> LLM
    LLM --> QUES(["Questions Generated"])

    QUES --> ANS(["User Answers"])
    ANS --> EVAL["EvaluatorAgent\nCorrectness / Depth / Clarity"]
    EVAL --> FUQ{"Follow-up?"}

    FUQ -->|"school - disabled"| NOFQ["Next Question"]
    FUQ -->|"college - selective"| FAC["FollowupAgent\nConceptual probing\nWhy this? Why not X?"]
    FUQ -->|"interview - targeted"| FAI["FollowupAgent\nResume cross-examination\nYou claimed X - prove it"]

    FAC --> LLM
    FAI --> LLM
    FAC --> NOFQ
    FAI --> NOFQ

    NOFQ -->|"all done"| REPORT["ReportAgent\nFinal Scorecard"]
    REPORT --> LLM
```

---

## ⚡ LLM Router & Degraded Mode Fallback

VIVORA implements a **per-task resilient LLM router** with automatic rate-limit backoff, token limits (`TASK_MAX_TOKENS`), and a zero-cost fallback provider:

```mermaid
flowchart TD
    REQ(["Task Request\nqgen | live_turn | eval | report"]) --> ROUTER["Per-Task LLM Router"]
    
    ROUTER --> MAP{"Preferred Provider\nfrom Config"}
    
    MAP -->|"qgen / report"| GEM["☁️ Gemini 2.5 Flash\nx-goog-api-key Header"]
    MAP -->|"live_turn / eval"| GROQ["⚡ Groq API\nqwen/qwen3.8-27b\nllama-3.3-70b-versatile"]
    MAP -->|"optional"| OAI["🧠 OpenAI API\ngpt-4o-mini"]
    
    GEM -->|"429 Rate Limit"| RETRY1["1.5s Backoff & Retry"]
    GROQ -->|"429 Rate Limit"| RETRY2["1.5s Backoff & Retry"]
    
    RETRY1 -->|"Fail"| FALLBACK["Fallback Chain\nNext Available Provider"]
    RETRY2 -->|"Fail"| FALLBACK
    
    FALLBACK -->|"All APIs Unavailable"| MOCK["🛡️ SmartRuleFallbackProvider\nZero-Cost Offline Rules\nDeterministic Adaptive Fallback"]
    
    MOCK --> DEG["Flags _is_mock=True\nEmits degraded_mode WS event\nApp Remains Fully Functional"]
```

### Per-Task Token Ceilings & Providers
| Task | Preferred Provider | Max Tokens | Description |
|---|---|---|---|
| `live_turn` | Groq / Gemini | 250 | Fast avatar spoken reply preparation |
| `evaluation` | Groq (`qwen/qwen3.8-27b`) | 600 | Real-time multi-dimensional scoring rubric |
| `question_generation` | Gemini (`gemini-2.5-flash`) | 1,500 | Role/syllabus-adaptive questions with follow-ups |
| `report` | Gemini / Groq | 2,500 | Final multi-factor examination scorecard |
| *Safety Net* | `mock` (SmartRuleFallback) | — | Offline testing & automatic zero-downtime failover |

---

## 📚 RAG Pipeline

```mermaid
flowchart TD
    PDF(["PDF Upload"]) --> EXT["pypdf Extraction\nRaw text"]
    EXT --> CHUNK["Text Chunking\nOverlapping windows"]
    CHUNK --> STORE[("Chunk Storage\nDatabase")]

    QR(["Question Generation Request"]) --> RET["Context Retrieval\nTop-K relevant chunks"]
    STORE --> RET

    RET --> PROMPT["Prompt Assembly\nSystem Instructions\n+ Mode Strategy\n+ Retrieved Context"]
    PROMPT --> GEM["☁️ Gemini API"]
    GEM --> OUT(["Generated Questions\n+ Reference Answers"])

    subgraph TYPES["Document Types by Mode"]
        S["🏫 School  →  doc_type: questions"]
        C["🎓 College  →  doc_type: syllabus"]
        I["💼 Interview  →  doc_type: resume"]
    end
```

---

## 🎙 Voice System

```mermaid
flowchart TD
    subgraph STT["🎤 Speech-to-Text"]
        MIC(["Microphone"]) --> WSR["Web Speech API\nSpeechRecognition\nContinuous mode"]
        WSR -->|"partial"| PT["onPartialTranscript\nWS: stt_partial stream"]
        WSR -->|"final"| FT["onFinalTranscript\nStored for submission"]
    end

    subgraph TTS["🔊 Text-to-Speech"]
        Q(["AI Question Text"]) --> SSU["SpeechSynthesisUtterance\nRate 0.95  Pitch 1.0  Lang en-IN"]
        SSU --> AUD(["Spoken aloud to user"])
        SSU -->|"onEnd"| AUTO["Auto-start Microphone"]
    end

    PT -->|"live stream"| BE["Backend WebSocket"]
    FT -->|"on submit"| BE
```

> **Browser support:** Chrome ✅ | Edge ✅ | Safari ✅ | Firefox ⚠️ *(text input fallback available)*

---

## 📊 Session State Machine

```mermaid
stateDiagram-v2
    [*] --> CREATED : POST /sessions

    CREATED --> LIVE : WebSocket auth_ok\nFirst question sent

    LIVE --> EVALUATING : submit_answer received

    EVALUATING --> FOLLOWUP : Follow-up triggered\nCollege or Interview mode
    EVALUATING --> LIVE : No follow-up\nNext question sent

    FOLLOWUP --> EVALUATING : Follow-up answer submitted

    LIVE --> COMPLETING : All questions done\nor end_session\nor timeout

    COMPLETING --> COMPLETED : Report generated

    COMPLETED --> [*] : Redirect to report page
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

> For production: use PostgreSQL, `wss://` WebSocket, and store secrets securely.

---

## 🧪 Testing & Quality Assurance

VIVORA maintains an automated regression suite covering authentication hardening, token validation, LLM routing, atomic evaluations, SQLite concurrency, rate limiting, and WebSocket state machine flows.

```bash
# Run all 160 backend regression tests (100% pass rate)
cd backend
python -m pytest tests/ -v

# Run frontend typecheck and production build
cd ../frontend
npm run build
```

---

## 🛡️ Pre-Launch Audit & Hardening

The platform has undergone a comprehensive engineering audit and autonomous remediation sprint:
- **[AUDIT_REPORT.md](AUDIT_REPORT.md)**: Pre-launch audit covering 28 findings across Architecture, AI Agents, UI/UX, Backend Concurrency, Security, and DevOps.
- **[MORNING_REPORT.md](MORNING_REPORT.md)**: Remediation report detailing 24 atomic commits, 160 passing tests, empirical concurrency benchmarks, and production verification.

---

## 🤝 Contributing

1. Fork → `git checkout -b feat/your-feature`
2. Commit → `git commit -m "feat: your feature"`
3. Push → `git push origin feat/your-feature`
4. Open a Pull Request

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

**Built with ❤️ for students who want to think clearly, speak confidently, and perform better under pressure.**

*✦ VIVORA — Your next answer starts here.*

</div>
