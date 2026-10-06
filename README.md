<div align="center">

# ✦ VIVORA

### *Next-Generation Real-Time AI Viva & Technical Interview Simulator*

**Study. Practice. Speak. Excel under pressure.**

**Created & Engineered by [Anurag Verma](https://github.com/Anu7276)**

[![Author: Anurag Verma](https://img.shields.io/badge/Author-Anurag%20Verma-10b981?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Anu7276)
[![Repository](https://img.shields.io/badge/GitHub-Anu7276%2FVIVORA-181717?style=for-the-badge&logo=github)](https://github.com/Anu7276/VIVORA)
[![Live Frontend](https://img.shields.io/badge/Frontend-Vercel_Live-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vivora-frontend.vercel.app)
[![Live Backend](https://img.shields.io/badge/Backend-Render_Live-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://vivora-backend.onrender.com)
[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.142-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Groq Inference](https://img.shields.io/badge/Groq-LPU_Inference-F05A28?style=for-the-badge)](https://groq.com)
[![Google Gemini](https://img.shields.io/badge/Gemini-2.0_Flash-8E75B2?style=for-the-badge&logo=google)](https://ai.google.dev)
[![Pytest 160 Passing](https://img.shields.io/badge/Tests-160%2F160_Passing-brightgreen?style=for-the-badge)](https://pytest.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  "Simulates the genuine tension, depth, and spontaneity of an oral board exam." │
│   Dual-stage video feed • Real-time voice STT/TTS • Deep multi-turn follow-ups  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

</div>

---

## 📑 Table of Contents

1. [Platform Overview](#-platform-overview)
2. [The 3 Persona Modes](#-the-3-persona-modes)
3. [Full-Stack System Architecture](#-full-stack-system-architecture)
4. [Multi-Agent Orchestration Flow](#-multi-agent-orchestration-flow)
5. [Resilient Multi-Provider LLM Router](#-resilient-multi-provider-llm-router)
6. [Real-Time Audio & Voice Pipeline](#-real-time-audio--voice-pipeline)
7. [RAG & Syllabus Ingestion Engine](#-rag--syllabus-ingestion-engine)
8. [Session State Machine](#-session-state-machine)
9. [Relational Database Schema](#-relational-database-schema)
10. [WebSocket Wire Protocol](#-websocket-wire-protocol)
11. [REST API Reference](#-rest-api-reference)
12. [Tech Stack Directory](#-tech-stack-directory)
13. [Getting Started & Local Setup](#-getting-started--local-setup)
14. [Environment Configuration](#-environment-configuration)
15. [Automated Testing & Quality Verification](#-automated-testing--quality-verification)
16. [Pre-Launch Engineering Audit & Verification](#-pre-launch-engineering-audit--verification)
17. [Production Deployment](#-production-deployment)
18. [License & Acknowledgments](#-license--acknowledgments)

---

## 🎯 Platform Overview

**VIVORA** is an autonomous oral examination platform designed to eliminate the anxiety of live vivas and technical interviews. It combines real-time streaming speech recognition, an intelligent multi-agent examiner pipeline, and multi-factor evaluation rubrics.

### Core Value Pillars
- **Real-Time Human-in-the-Loop Simulation:** Conversational oral examination with zero-latency speech feedback, interactive student doubt interruptions, and dynamic pacing.
- **Deep Follow-Up Probing:** Unlike standard flashcard quizzes, VIVORA analyzes the conceptual substance of your response. Weak or hand-waving answers trigger targeted cross-examination (*"Why this algorithm over X? What happens when memory spikes?"*).
- **Zero-Downtime Multi-Provider Resilience:** Automatic failover between **Groq** (`qwen/qwen3.8-27b`), **Google Gemini** (`gemini-2.5-flash`), and **OpenAI** (`gpt-4o-mini`), backed by an offline, deterministic **SmartRuleFallback** safety net.
- **Production-Hardened Concurrency:** SQLite in WAL mode with connection-pooled `busy_timeout=5000`, atomic transaction boundaries, and token-bucket rate limiting.

---

## 🎭 The 3 Persona Modes

```
┌─────────────────────────┬──────────────────────────┬────────────────────────────┐
│    🏫 SCHOOL VIVA       │     🎓 COLLEGE VIVA      │     💼 JOB INTERVIEW       │
├─────────────────────────┼──────────────────────────┼────────────────────────────┤
│ • Classes 8–12 CBSE/ICSE│ • Engineering & Science  │ • Freshers & Experienced   │
│ • Foundational recall   │ • Deep conceptual theory │ • Resume & Project Probing │
│ • Encouraging & gentle  │ • Selective follow-ups   │ • Architectural trade-offs │
│ • No harsh penalties    │ • Formula & proof checks │ • Concurrency & scale checks│
└─────────────────────────┴──────────────────────────┴────────────────────────────┘
```

```mermaid
graph LR
    subgraph MODES["Examination Personas"]
        direction TB
        M1["🏫 School Mode<br/><b>Focus:</b> Fundamental Recall<br/><b>Follow-ups:</b> Off<br/><b>Context:</b> Textbook / Topics"]
        M2["🎓 College Mode<br/><b>Focus:</b> Analytical Depth<br/><b>Follow-ups:</b> Selective (Score &lt; 8.5)<br/><b>Context:</b> Syllabus / Lab Manual"]
        M3["💼 Interview Mode<br/><b>Focus:</b> Industry Engineering<br/><b>Follow-ups:</b> Targeted on Resume<br/><b>Context:</b> Resume PDF + Tech Stack"]
    end
```

---

## 🏛 Full-Stack System Architecture

```mermaid
graph TB
    subgraph CLIENT["💻 Client Layer (Next.js 15 App Router)"]
        UI_STAGE["Dual Video Stage<br/>(Examiner Avatar + Live Camera)"]
        UI_RUBRIC["Live Rubric Panel<br/>(Correctness / Depth / Clarity)"]
        UI_DOUBT["Interactive Doubt Bar<br/>(Real-Time Clarification)"]
        VOICE_ENGINE["Web Speech Engine<br/>(SpeechRecognition + Synthesis)"]
    end

    subgraph NETWORK["⚡ Real-Time Transport Layer"]
        WS_GATEWAY["WebSocket Gateway<br/>/ws/session/{id}<br/>(Heartbeat, Auth &amp; Rate Limits)"]
        REST_GATEWAY["FastAPI REST Endpoints<br/>/api/auth  /api/session  /api/upload"]
    end

    subgraph ENGINE["🤖 Multi-Agent Orchestration Core"]
        ORCHESTRATOR["Agent Orchestrator Pipeline"]
        AGENT_Q["Question Agent<br/>(Syllabus / Role Adaptive)"]
        AGENT_E["Evaluator Agent<br/>(Atomic Scoring 0–10)"]
        AGENT_F["Follow-up Agent<br/>(Cross-Question Probing)"]
        AGENT_D["Doubt Agent<br/>(On-the-fly Help)"]
        AGENT_R["Report Agent<br/>(Scorecard Synthesis)"]
    end

    subgraph ROUTER_LAYER["🧠 Resilient LLM Router"]
        LLM_ROUTER["Per-Task LLM Router<br/>(Token Ceilings &amp; Backoff)"]
        PROVIDER_GROQ["⚡ Groq LPU<br/>(qwen/qwen3.8-27b)"]
        PROVIDER_GEMINI["☁️ Gemini 2.5 Flash<br/>(qgen &amp; report)"]
        PROVIDER_OPENAI["🧠 OpenAI API<br/>(gpt-4o-mini)"]
        PROVIDER_MOCK["🛡️ SmartRuleFallback<br/>(Zero-Cost Safety Net)"]
    end

    subgraph STORAGE["🗄️ Persistence & RAG Layer"]
        DB[("SQLite 3 (WAL Mode)<br/>Foreign Keys ON<br/>busy_timeout=5000")]
        RAG_PARSER["PDF Parser &amp; Text Chunking<br/>(Sentence Boundary Alignment)"]
    end

    UI_STAGE <-->|"Persistent WS"| WS_GATEWAY
    VOICE_ENGINE <-->|"stt_partial stream"| WS_GATEWAY
    UI_RUBRIC <-->|"HTTP /api/report"| REST_GATEWAY

    WS_GATEWAY --> ORCHESTRATOR
    REST_GATEWAY --> ORCHESTRATOR
    REST_GATEWAY --> RAG_PARSER

    ORCHESTRATOR --> AGENT_Q
    ORCHESTRATOR --> AGENT_E
    ORCHESTRATOR --> AGENT_F
    ORCHESTRATOR --> AGENT_D
    ORCHESTRATOR --> AGENT_R

    AGENT_Q --> LLM_ROUTER
    AGENT_E --> LLM_ROUTER
    AGENT_F --> LLM_ROUTER
    AGENT_D --> LLM_ROUTER
    AGENT_R --> LLM_ROUTER

    LLM_ROUTER --> PROVIDER_GROQ
    LLM_ROUTER --> PROVIDER_GEMINI
    LLM_ROUTER --> PROVIDER_OPENAI
    LLM_ROUTER -.->|"Failover"| PROVIDER_MOCK

    ORCHESTRATOR --> DB
    RAG_PARSER --> DB
```

---

## 🔄 Multi-Agent Orchestration Flow

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as 🧑‍🎓 Candidate
    participant Stage as 🖥️ Next.js Stage
    participant WS as ⚡ WebSocket Handler
    participant Orch as 🎯 Orchestrator
    participant Router as 🧠 LLM Router
    participant DB as 🗄️ SQLite Database

    Candidate->>Stage: Clicks "Start Exam"
    Stage->>WS: Connect WebSocket + JWT Token
    WS->>Stage: auth_ok + session_started

    Orch->>Router: Generate Session Questions (Task: qgen)
    Router-->>Orch: Formatted Questions & Reference Answers
    Orch->>DB: Store Questions in Session
    Orch->>Stage: question_ready + TTS Audio Text
    Stage->>Candidate: AI Avatar speaks Question aloud

    Candidate->>Stage: Speaks answer into microphone
    Stage->>WS: stt_partial (Live transcript streaming)
    Candidate->>Stage: Clicks "Submit Answer"
    Stage->>WS: submit_answer { transcript }

    WS->>Stage: evaluating { message: "Scoring response..." }
    WS->>Orch: Evaluate Answer (Task: evaluation)
    Orch->>Router: Score vs Reference Rubric
    Router-->>Orch: { correctness: 8.5, depth: 9.0, clarity: 8.0 }
    Orch->>DB: Atomic write: Answer + Evaluation records
    Orch->>Stage: evaluation_result (Scores + Feedback)

    alt College or Interview mode AND overall_score < 8.5
        Orch->>Router: Generate Follow-up Probe (Task: live_turn)
        Router-->>Orch: Target follow-up cross-question
        Orch->>Stage: followup_question + speech
        Stage->>Candidate: Avatar speaks follow-up question
    else Score >= 8.5 OR School Mode
        Orch->>Stage: Advances to Next Core Question
    end

    opt Candidate asks clarification
        Candidate->>Stage: Clicks "Ask Doubt"
        Stage->>WS: ask_doubt { doubt: "Can you rephrase?" }
        WS->>Router: Handle Doubt (Task: live_turn)
        Router-->>Stage: doubt_answered (No score penalty)
    end

    Candidate->>Stage: Clicks "End Session"
    Stage->>WS: end_session
    WS->>Orch: Finalize Performance Report (Task: report)
    Orch->>Router: Synthesize Strengths, Weaknesses & Revision Plan
    Router-->>Orch: Final Comprehensive Report
    Orch->>DB: Store Report Entity
    WS->>Stage: session_completed { report_id }
    Stage->>Candidate: Smooth transition to /report/[id] scorecard
```

---

## ⚡ Resilient Multi-Provider LLM Router

The router executes per-task dispatch, strictly enforcing role-specific token ceilings to prevent runaway latency and compute costs:

```mermaid
flowchart TD
    subgraph INCOMING["1. Incoming Agent Call"]
        TASK_CALL["router.complete(task, prompt, as_json=True)"]
    end

    subgraph DISPATCH["2. Task-Based Provider Selection"]
        TASK_TYPE{"Task Type"}
        TASK_TYPE -->|"live_turn (max 250 tok)"| PREF_GROQ["Preferred: Groq<br/>(qwen/qwen3.8-27b)"]
        TASK_TYPE -->|"evaluation (max 600 tok)"| PREF_GROQ
        TASK_TYPE -->|"question_generation (max 1500 tok)"| PREF_GEMINI["Preferred: Gemini<br/>(gemini-2.5-flash)"]
        TASK_TYPE -->|"report (max 2500 tok)"| PREF_GEMINI
    end

    subgraph EXECUTION["3. Execution & Auto-Retry Loop"]
        TRY_PRIMARY["Execute Primary Call<br/>(Shared Keep-Alive HTTP Client)"]
        CHECK_STATUS{"Response Status"}
        TRY_PRIMARY --> CHECK_STATUS
        
        CHECK_STATUS -->|"200 OK"| RETURN_OK["Parse JSON &amp; Embed Provider Meta"]
        CHECK_STATUS -->|"429 Rate Limit"| BACKOFF["Wait 1.5s &amp; Retry Once"]
        BACKOFF --> RETRY_CALL["Retry Primary Provider"]
        RETRY_CALL -->|"Success"| RETURN_OK
        RETRY_CALL -->|"Fail"| FALLBACK_CHAIN["Activate Fallback Chain"]
        CHECK_STATUS -->|"5xx / Timeout / Network"| FALLBACK_CHAIN
    end

    subgraph FAILOVER["4. Intelligent Safety Net"]
        FALLBACK_CHAIN --> TRY_NEXT["Try Next Available Provider<br/>(Gemini → Groq → OpenAI)"]
        TRY_NEXT -->|"Success"| RETURN_OK
        TRY_NEXT -->|"All Providers Down"| MOCK_FALLBACK["SmartRuleFallbackProvider<br/>(Deterministic Offline Rules)"]
        MOCK_FALLBACK --> RETURN_MOCK["Return Valid Mock Payload<br/>Flag _is_mock=True<br/>Signal degraded_mode Event"]
    end

    TASK_CALL --> TASK_TYPE
    PREF_GROQ --> TRY_PRIMARY
    PREF_GEMINI --> TRY_PRIMARY
```

### Routing Matrix & Token Allocations
| Task Name | Primary Provider | Configured Model | Max Tokens | Latency Target |
|---|---|---|:---:|:---:|
| `live_turn` | Groq LPU | `qwen/qwen3.8-27b` | **250** | $< 800\text{ ms}$ |
| `evaluation` | Groq LPU | `qwen/qwen3.8-27b` | **600** | $< 1.2\text{ s}$ |
| `question_generation` | Google Gemini | `gemini-2.5-flash` | **1,500** | $< 2.5\text{ s}$ |
| `report` | Google Gemini | `gemini-2.5-flash` | **2,500** | $< 3.5\text{ s}$ |
| *Safety Net* | SmartRuleFallback | Internal Heuristics | Dynamic | $< 10\text{ ms}$ |

---

## 🎙 Real-Time Audio & Voice Pipeline

```mermaid
flowchart LR
    subgraph STT_FLOW["🎤 Spoken Audio Input (Speech-to-Text)"]
        MIC(["Microphone"]) --> REC["Web Speech API<br/>SpeechRecognition<br/>(Continuous)"]
        REC -->|"Real-time partials"| PARTIAL["stt_partial WS frame<br/>(UI Speech Waveform)"]
        REC -->|"Speech pause / End"| TRANSCRIPT["Final Transcript Buffer"]
        TRANSCRIPT -->|"Click Submit"| SUBMIT["submit_answer WS frame"]
    end

    subgraph TTS_FLOW["🔊 Avatar Spoken Audio Output (Text-to-Speech)"]
        SERVER_Q["question_ready WS frame<br/>{ speech, question }"] --> SYNTH["Web Speech Synthesis<br/>SpeechSynthesisUtterance<br/>(Rate 0.95, Pitch 1.0, Lang en-IN)"]
        SYNTH --> SPEAK(["Avatar Audio Output"])
        SYNTH -->|"utterance.onend event"| UNMUTE["Auto-Enable Microphone<br/>(Seamless Turn-Taking)"]
    end
```

---

## 📚 RAG & Syllabus Ingestion Engine

```mermaid
flowchart TD
    subgraph INGESTION["Document Ingestion Pipeline"]
        UPLOAD["User Uploads PDF / Paste Text<br/>(POST /api/upload/file)"] --> VALIDATE{"Security Guardrails<br/>Size &lt; 10MB<br/>Pages &lt; 100"}
        VALIDATE -->|"Reject"| ERR["HTTP 413 / 415"]
        VALIDATE -->|"Accept"| EXTRACT["pypdf Text Extraction<br/>(Sanitizes Non-Printable Chars)"]
        EXTRACT --> CHUNKING["Sliding Window Chunking<br/>(500-word windows, 100-word overlap)<br/><b>Guarantees clean word boundaries</b>"]
        CHUNKING --> STORE[("Store Chunks in DB<br/>document_chunks table")]
    end

    subgraph RETRIEVAL["Context-Augmented Viva Generation"]
        START_SESSION["Session Initialization<br/>(POST /api/session/start)"] --> QUERY_CHUNKS["Retrieve Top-K Chunks<br/>by Keyword / Section Density"]
        STORE --> QUERY_CHUNKS
        QUERY_CHUNKS --> ASSEMBLE["Assemble LLM System Prompt<br/>Mode Constraints + Syllabus Chunks"]
        ASSEMBLE --> LLM_GEN["Gemini 2.5 Flash Generation"]
        LLM_GEN --> Q_POOL["5 to 10 Tailored Questions<br/>+ Model Reference Answers<br/>+ Prepared Follow-up Probes"]
    end
```

---

## 📊 Session State Machine

```mermaid
stateDiagram-v2
    [*] --> CREATED : POST /api/session/start

    CREATED --> CONNECTED : WebSocket Client Connect
    CONNECTED --> AUTHENTICATED : type 'auth' with Valid JWT (within 5s)
    CONNECTED --> CLOSED : Auth Timeout or Invalid Token

    AUTHENTICATED --> ASKING_QUESTION : type 'start_exam' or Auto-Start
    
    ASKING_QUESTION --> LISTENING : Avatar finishes speaking TTS utterance
    
    LISTENING --> LISTENING : type 'stt_partial' (Streaming transcription)
    LISTENING --> ASKING_QUESTION : type 'repeat_question' (Re-reads aloud)
    LISTENING --> ANSWER_DOUBT : type 'ask_doubt' (Clarification)
    ANSWER_DOUBT --> LISTENING : Avatar answers doubt
    
    LISTENING --> SKIPPED : type 'skip_question' (Zero score assigned)
    SKIPPED --> ASKING_QUESTION : Advance current_question_no
    
    LISTENING --> EVALUATING : type 'submit_answer' (Guarded against double-submit)
    
    EVALUATING --> PROBING_FOLLOWUP : Follow-up triggered (College / Interview &amp; score &lt; 8.5)
    PROBING_FOLLOWUP --> LISTENING : AI speaks follow-up probe
    
    EVALUATING --> ASKING_QUESTION : Next question in pool
    
    LISTENING --> TIMED_OUT : Timer reaches 0s (Server-authoritative)
    LISTENING --> FINALIZING : type 'end_session' or all questions answered
    TIMED_OUT --> FINALIZING
    
    FINALIZING --> REPORT_READY : ReportAgent compiles scorecard
    REPORT_READY --> [*] : Client transitions to /report/[id]
```

---

## 🗄 Relational Database Schema

```mermaid
erDiagram
    users ||--o{ minor_consents : "has"
    users ||--o{ sessions : "creates"
    users ||--o{ documents : "uploads"
    documents ||--o{ document_chunks : "contains"
    documents ||--o{ sessions : "referenced_in"
    sessions ||--o{ questions : "contains"
    questions ||--o{ answers : "receives"
    answers ||--o| evaluations : "evaluated_in"
    sessions ||--o| reports : "produces"
    sessions ||--o{ llm_usage_logs : "tracks"

    users {
        string id PK
        string email UK
        string name
        string role
        boolean is_minor
        datetime date_of_birth
        string hashed_password
        datetime created_at
    }

    minor_consents {
        string id PK
        string user_id FK
        string parent_email
        string consent_token UK
        boolean is_confirmed
        datetime confirmed_at
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

    document_chunks {
        string id PK
        string document_id FK
        int chunk_index
        text chunk_text
        int token_count
    }

    sessions {
        string id PK
        string user_id FK
        string document_id FK
        string title
        string mode
        string status
        int time_limit_min
        int current_question_no
        boolean awaiting_followup
        string active_followup_id
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
        text followup_question
        text followup_answer
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
        string provider
        boolean is_mock
    }

    reports {
        string id PK
        string session_id FK
        float overall_score
        text strengths
        text improvements
        text revision_plan
        text scoring_note
        string completion_status
        datetime created_at
    }

    llm_usage_logs {
        string id PK
        string session_id FK
        string task
        string provider
        boolean is_fallback
        int prompt_tokens
        int latency_ms
        boolean success
        datetime created_at
    }
```

---

## 🔌 WebSocket Wire Protocol

Persistent bidirectional transport at `/ws/session/{session_id}`:

### Client $\to$ Server Frames
| Message Type | Required Payload | Description & Preconditions |
|---|---|---|
| `auth` | `{"token": "<JWT_STRING>"}` | **Mandatory first message.** Must be dispatched within 5 seconds of connection. |
| `submit_answer` | `{"transcript": "..."}` | Submits student spoken answer. Guarded server-side against double-submission races. |
| `stt_partial` | `{"transcript": "..."}` | Live partial stream updating the real-time audio transcript UI. |
| `repeat_question`| `{}` | Signals avatar to re-read the active question aloud without penalty. |
| `skip_question`  | `{}` | Bypasses current question. Factored into final score (scored as 0 for completion). |
| `ask_doubt`      | `{"doubt": "..."}` | Asks a clarification. Handled by DoubtAgent without grade penalty (rate-limited). |
| `end_session`    | `{}` | Gracefully ends session and initiates background report synthesis. |

### Server $\to$ Client Frames
| Message Type | Emitted Payload | Description |
|---|---|---|
| `auth_ok` | `{}` | Authentication confirmed. State machine unlocked. |
| `session_started`| `{"total_questions": 6, "language": "en-IN"}` | Exam initialization complete. |
| `question_ready` | `{"question": "...", "order_no": 1, "speech": "..."}` | Primary question loaded with TTS content. |
| `followup_question`| `{"question": "...", "speech": "..."}` | Dynamic follow-up cross-examination prompt. |
| `evaluating`     | `{"message": "Evaluating response..."}` | Background LLM grading in progress. |
| `evaluation_result`| `{"evaluation": {"correctness": 9, ...}}` | Multi-dimensional rubric metrics. |
| `doubt_answered` | `{"answer": "...", "speech": "..."}` | Clarification reply prepared for avatar speech. |
| `degraded_mode`  | `{"message": "Offline fallback active"}` | Signaled when external LLM APIs fail over to mock. |
| `session_completed`| `{"report_id": "...", "report": {...}}` | Final report synthesized and ready for viewing. |
| `error`          | `{"message": "...", "code": "RATE_LIMIT_EXCEEDED"}` | Error boundary notification. |

---

## 📡 REST API Reference

All REST endpoints reside under the `/api` route prefix:

```
┌────────┬───────────────────────────────────┬─────────────────────────────────────────────────┐
│ Method │ Endpoint                          │ Description                                     │
├────────┼───────────────────────────────────┼─────────────────────────────────────────────────┤
│ GET    │ /health                           │ Basic container liveness probe                  │
│ GET    │ /health/ready                     │ Database readiness healthcheck (SELECT 1)       │
│ POST   │ /api/auth/signup                  │ Register student/interview candidate            │
│ POST   │ /api/auth/login                   │ Login and receive JWT access token              │
│ GET    │ /api/auth/me                      │ Fetch authenticated user profile & permissions  │
│ POST   │ /api/auth/parent-consent-confirm  │ Validate parental consent token for minors      │
│ POST   │ /api/session/start                │ Initialize exam session (Token-bucket limited)  │
│ GET    │ /api/session/{id}                 │ Fetch session state, server timer & questions   │
│ POST   │ /api/upload/file                  │ Ingest PDF syllabus, textbook or resume         │
│ POST   │ /api/upload/text                  │ Ingest raw chapter or topic text                │
│ GET    │ /api/upload/status/{task_id}      │ Poll document chunking status                   │
│ GET    │ /api/report/{session_id}          │ Retrieve full scorecard (Auth owner permitted)  │
│ WS     │ /ws/session/{session_id}          │ Real-time oral viva WebSocket connection        │
└────────┴───────────────────────────────────┴─────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack Directory

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 TECH STACK MATRIX                               │
├───────────────────┬───────────────────────────────┬─────────────────────────────┤
│ Component         │ Technology                    │ Purpose                     │
├───────────────────┼───────────────────────────────┼─────────────────────────────┤
│ Frontend Web      │ Next.js 15.5 (React 19)       │ App Router, SSR & Dynamic   │
│ Styling & Design  │ Tailwind CSS 3.4              │ Editorial Design System     │
│ Audio Streaming   │ Web Speech API (STT & TTS)    │ Native browser voice engine │
│ Backend Server    │ FastAPI 0.142 + Uvicorn       │ Asynchronous ASGI Core      │
│ Primary LLM Fast  │ Groq (qwen/qwen3.8-27b)       │ 800+ T/s viva evaluations   │
│ Primary LLM Deep  │ Google Gemini (2.5 Flash)     │ Syllabus QGen & Reports     │
│ Database Engine   │ SQLite 3 (WAL Mode)           │ Single-file ACID Storage    │
│ Migration Manager │ Alembic 1.20                  │ Idempotent Schema Migrations│
│ HTTP Client       │ httpx (Pooled Singleton)      │ Async Keep-Alive Requests   │
│ Authentication    │ python-jose + passlib(bcrypt) │ Cryptographic JWT Sessions  │
│ Testing Framework │ Pytest 9.1 + AnyIO            │ 160 Regression Tests (100%) │
└───────────────────┴───────────────────────────────┴─────────────────────────────┘
```

---

## 🚀 Getting Started & Local Setup

### System Prerequisites
- **Node.js** $\ge 18.18$
- **Python** $\ge 3.11$ (Python 3.12 recommended)
- **API Keys**: Groq API Key ([console.groq.com](https://console.groq.com)) or Google Gemini API Key ([ai.google.dev](https://ai.google.dev))

### 1. Clone Repository
```bash
git clone https://github.com/Anu7276/VIVORA.git
cd VIVORA
```

### 2. Backend Setup
```bash
cd backend

# Create and activate Python virtual environment
python -m venv .venv
.\.venv\Scripts\activate            # Windows PowerShell
source .venv/bin/activate         # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Execute database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend Swagger Docs accessible at: `http://localhost:8000/docs`*

### 3. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
*Frontend interface accessible at: `http://localhost:3000`*

---

## 🔐 Environment Configuration

Configure `backend/.env` (see `backend/.env.example`):

```env
# Application Environment
ENV=development                                      # Set to 'production' for strict startup validation
JWT_SECRET_KEY=vivora-production-secure-jwt-secret-key-32chars  # Must be >= 32 characters in production
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_URL=sqlite:///./vivora.db

# LLM Providers
GROQ_API_KEY=gsk_your_groq_api_key_here
GEMINI_API_KEY=AIzaSy_your_gemini_api_key_here
OPENAI_API_KEY=sk-your_openai_api_key_here

# Task Router Configuration
QUESTION_GEN_PROVIDER=gemini                         # 'gemini' | 'groq' | 'openai' | 'mock'
LIVE_PROVIDER=groq
EVALUATION_PROVIDER=groq
REPORT_PROVIDER=gemini

# Model Identifiers
GROQ_MODEL=qwen/qwen3.8-27b
GEMINI_MODEL=gemini-2.5-flash
OPENAI_MODEL=gpt-4o-mini

# CORS Allowlist
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

---

## 🧪 Automated Testing & Quality Verification

VIVORA maintains a comprehensive **160-test automated regression suite** verifying API security, race condition resilience, atomic database transactions, SQLite WAL concurrency, and multi-agent contracts.

```bash
# Run complete backend pytest suite
cd backend
python -m pytest tests -v

# Run with test coverage summary
python -m pytest tests -q --tb=short
```

### Verification Result
```
============================= test session starts ==============================
collected 160 items

tests/test_college_viva_generation.py::test_college_viva_generation PASSED
tests/test_f_be_01_sqlite_pragmas.py::test_sqlite_pragmas_configured PASSED
tests/test_f_be_01_sqlite_pragmas.py::test_foreign_key_enforcement PASSED
tests/test_f_be_02_atomic_answer_eval.py::test_atomic_rollback_on_failure PASSED
tests/test_f_be_08_rate_limiting.py::test_session_creation_rate_limiting PASSED
tests/test_f_be_09_double_submit_guard.py::test_double_submit_guard PASSED
tests/test_phase0_containment.py::TestStartupProviderWarning PASSED
...
======================= 160 passed, 0 failed in 106.18s ========================
```

```bash
# Run frontend production build & typecheck
cd ../frontend
npm run build
```

---

## 🛡️ Pre-Launch Engineering Audit & Verification

Before launch sign-off, VIVORA was evaluated under an intensive **28-point pre-launch audit** and autonomous remediation sprint:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LAUNCH READINESS COMPARISON                     │
│                                                                        │
│   Engineering Discipline       Pre-Audit Score      Remediated Score   │
│   ──────────────────────────────────────────────────────────────────   │
│   Architecture & Concept:         82 / 100   ───►   92 / 100           │
│   AI Agent Pipeline:              52 / 100   ───►   94 / 100           │
│   Frontend & UI/UX:               46 / 100   ───►   95 / 100           │
│   Backend & Database:             44 / 100   ───►   96 / 100           │
│   Security & OWASP:               38 / 100   ───►   88 / 100           │
│   DevOps & Reliability:           32 / 100   ───►   92 / 100           │
│                                                                        │
│   OVERALL HEALTH SCORE:           48 / 100   ───►   93 / 100 (READY)   │
└────────────────────────────────────────────────────────────────────────┘
```

- **[AUDIT_REPORT.md](AUDIT_REPORT.md)**: Original 368-line audit discovering 28 defects across 6 engineering disciplines.
- **[MORNING_REPORT.md](MORNING_REPORT.md)**: Full remediation verification documenting 24 atomic commits, 160 passing tests, and empirical benchmarks.

---

## 🐳 Production Deployment

### Docker Compose (Multi-Container)
```bash
# Build and run backend and frontend containers
docker-compose up --build -d

# Verify container status
docker-compose ps
```

### Production Checklist
- [x] Run container processes as **non-root user** (`appuser` UID 1000 in backend, `node` in frontend).
- [x] Configure high-entropy `JWT_SECRET_KEY` ($\ge 32$ characters).
- [x] Enable SQLite WAL mode and set `busy_timeout=5000`.
- [x] Use persistent volume for database directory (`/app/data`).
- [x] Expose `/health/ready` probe for load balancer health checks.

## 👨‍💻 Author & Creator

**Anurag Verma**
- **GitHub**: [@Anu7276](https://github.com/Anu7276)
- **Project**: [VIVORA Repository](https://github.com/Anu7276/VIVORA)
- **Live Demo**: [Vercel Web App](https://vivora-frontend.vercel.app) • [Render API Backend](https://vivora-backend.onrender.com)

---

## 📄 License & Acknowledgments

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

<div align="center">

**Built with pride by Anurag Verma for students and candidates who want to think clearly, speak with conviction, and master oral examinations.**

*✦ VIVORA — Your next answer starts here.*

</div>
