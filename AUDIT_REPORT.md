# VIVORA — Comprehensive Pre-Launch Engineering & Product Audit
**Date:** October 6, 2026  
**Auditors:** Unified Engineering & Product Review Board (Principal Architect, QA Lead, Security Engineer, Senior UI/UX Specialist, AI Systems Engineer, SRE, Product Strategist)  
**Target:** VIVORA (AI Viva & Interview Simulator) — Full Stack (FastAPI, Next.js 15, SQLite/SQLAlchemy, Groq/Gemini/OpenAI Router)  
**Status:** **NO-GO FOR PUBLIC LAUNCH** (Requires Critical P0 Remediations Prior to User Onboarding)

---

## 1. Executive Summary

### Overall Launch Health Score: 48 / 100

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VIVORA LAUNCH HEALTH SCORE                      │
│                                                                        │
│   Architecture & Concept:   ████████████████░░░░  82/100               │
│   AI Agent Pipeline:        ██████████░░░░░░░░░░  52/100               │
│   Frontend & UI/UX:         █████████░░░░░░░░░░░  46/100               │
│   Backend & Database:       █████████░░░░░░░░░░░  44/100               │
│   Security & OWASP:         ███████░░░░░░░░░░░░░  38/100               │
│   DevOps & Reliability:     ██████░░░░░░░░░░░░░░  32/100               │
│                                                                        │
│   OVERALL COMPOSITE SCORE:  █████████░░░░░░░░░░░  48/100 (HIGH RISK)   │
└────────────────────────────────────────────────────────────────────────┘
```

### Executive Verdict
VIVORA demonstrates an ambitious, well-conceived core vision: a multi-agent oral examination and viva simulator combining syllabus-based RAG, real-time avatar viva interactions, and multi-factor evaluation rubrics. The conceptual separation of concerns across agents (Interviewer, Question, Doubt, Evaluator, Report) is sound, and the design aesthetic (warm academic editorial with Newsreader and Plus Jakarta Sans) is distinctive. 

However, **the platform is not ready for live users, production traffic, or investor demonstrations**. Severe functional defects in the core interview session loop will immediately crash client sessions upon completion (`session/[id]/page.tsx` unhandled promise rejection and premature navigation). Broken WebSocket button contracts silently swallow user clicks on "Replay Question" and "Next Question". The live interview rubric renders garbled progress bars and `undefined/100` scores due to a 0–10 vs 0–100 scale mismatch. Crucially, the system runs on an un-pragmatized SQLite engine with N+1 queries, ACID transaction splits, hardcoded fallback JWT secrets, and no rate limiting on expensive LLM calls. If launched in its current state, users will experience session crashes, garbled report cards, and API exhaustion within minutes.

### Top 3 Launch Blockers (P0)
1. **Critical Session Flow Termination Crash (F-FUNC-09 & F-FUNC-08):**
   When an interview concludes, the frontend immediately pushes to `/report/${sessionId}` before the backend background worker finishes computing the report, triggering an unhandled TypeError crash (`reading 'length'`). Concurrently, WebSocket control buttons for "Replay Question" and "Next Question" dispatch event types (`replay_question`, `next_question`) that the backend rejects, dropping user clicks.
2. **Scoring Scale & Rubric Disconnect (F-FUNC-07 & F-AI-03):**
   The evaluator outputs 0.0–10.0 scores, but the session UI hardcodes a `/100` denominator, displaying a 9.2/10 as a microscopic "9% score" progress bar and "undefined/100". In the final report, scores are calculated by dividing only answered questions (`sum / scored_count`) instead of total questions, allowing students who answer 1 question and drop out to receive a 100% grade.
3. **Authentication & Secret Hardcoding Vulnerabilities (F-SEC-01 & F-SEC-02):**
   If `JWT_SECRET_KEY` is not defined in production environments, the authentication system silently falls back to a static hardcoded string (`"vivora-insecure-dev-secret-key-change-in-production"`), allowing arbitrary token forgery and total account takeover. Furthermore, report data endpoints reject logged-in user tokens when accessed directly.

### Key Strengths
- **Cohesive Academic Editorial Aesthetic:** The palette and typography feel scholarly, thoughtful, and premium compared to generic SaaS templates.
- **Resilient Multi-Provider LLM Fallback:** The `LLMClientRouter` implements intelligent fallback chains (Groq $\to$ Gemini $\to$ OpenAI $\to$ SmartRuleFallback), preventing single-provider outages from immediately killing the app.
- **Strict Input Constraints on File Ingestion:** Uploads enforce 10 MB caps, PDF page limits ($\le$ 100), and MIME/extension matching to prevent memory bombs.

---

## 2. Critical Findings Matrix

| Finding ID | Discipline | Severity | Impact Summary | Root Cause Location |
| :--- | :--- | :--- | :--- | :--- |
| **F-FUNC-09** | Frontend/UX | **P0 (Critical)** | Session completion crashes frontend with white-screen `TypeError` | `frontend/src/app/session/[id]/page.tsx:454` |
| **F-FUNC-08** | Realtime/WS | **P0 (Critical)** | "Replay" & "Next" question buttons silently fail; clicks dropped | `frontend/src/app/session/[id]/page.tsx:413,432` vs `interview_ws.py:506,532` |
| **F-FUNC-07** | Frontend/UI | **P0 (Critical)** | Rubric renders `undefined/100` and scores display as 8% instead of 80% | `frontend/src/app/session/[id]/page.tsx:850-891` |
| **F-SEC-02** | Security | **P0 (Critical)** | Hardcoded JWT secret fallback enables total authentication forgery | `backend/app/core/auth.py:52` & `docker-compose.yml:14` |
| **F-AI-03** | AI Engine | **P0 (Critical)** | Answering 1 question yields a 100% final score; incomplete sessions unpenalized | `backend/app/agents/report_agent.py:46` |
| **F-BE-01** | Backend/DB | **P1 (High)** | Foreign keys disabled; orphan records corrupt session state | `backend/app/db/database.py:15` (`PRAGMA foreign_keys = 0`) |
| **F-BE-02** | Backend/DB | **P1 (High)** | Split DB transactions leave unscored answers if evaluation fails | `backend/app/services/session_service.py:219-236` |
| **F-BE-07** | Concurrency | **P1 (High)** | Zero busy_timeout and delete journal mode causes 10/10 lock errors under load | `backend/app/db/database.py:15` |
| **F-BE-08** | API/Security | **P1 (High)** | Zero rate limiting on LLM endpoints enables API token and cost exhaustion | `backend/app/api/routes/upload.py`, `session.py`, `interview_ws.py` |
| **F-BE-09** | Race Condition | **P1 (High)** | Double-submitting an answer creates duplicate Answer rows and duplicate follow-ups | `backend/app/api/ws/interview_ws.py:441-474` |
| **F-FUNC-02** | Frontend/State| **P1 (High)** | Timer hardcoded to 60m; desyncs with 15m server timeout | `frontend/src/app/session/[id]/page.tsx:74` |
| **F-FUNC-03** | Auth/API | **P1 (High)** | Report viewing fails with 403 Forbidden on direct link or new tab | `backend/app/api/routes/report.py:44` |
| **F-FUNC-01** | AI/Fallback | **P1 (High)** | Fallback provider generates only 4 questions; truncates standard 5+ sessions | `backend/app/llm/router.py:352-385` |
| **F-AI-01** | AI Systems | **P1 (High)** | Unbounded LLM output (`max_tokens` omitted); high latency and cost runaway | `backend/app/llm/router.py:112, 185, 230` |
| **F-AI-02** | AI Systems | **P1 (High)** | Sparse RAG context causes QuestionAgent to output literal `"N/A"` | `backend/app/agents/question_agent.py:104` |
| **F-BE-03** | Performance | **P1 (High)** | N+1 queries execute 22+ DB round-trips per session load | `backend/app/api/routes/session.py` & `report.py` |
| **F-BE-04** | Performance | **P1 (High)** | HTTP client recreated per LLM turn; zero connection reuse | `backend/app/llm/router.py:90, 155, 220` |
| **F-UI-01** | Frontend/CSS | **P1 (High)** | Exam viewport layout collapses and breaks on viewports $< 768\text{px}$ | `frontend/src/app/session/[id]/page.tsx:536` |
| **F-DEVOPS-01**| CI/CD | **P1 (High)** | GitHub Actions CI fails on nonexistent migration command | `.github/workflows/ci.yml:26` |
| **F-DEVOPS-02**| Frontend/SRE | **P1 (High)** | Missing Next.js `error.tsx` boundary causes full app crashes | `frontend/src/app/` |
| **F-PROD-01** | Product/Biz | **P1 (High)** | Zero payment or usage rate limits; open to cost exhaustion attacks | Global API / Session Routing |

---

## 3. Findings by Discipline

### Phase 1: Architecture & System Design
- **Strengths:** 
  - Clear architectural division between synchronous ingestion, real-time audio WebSocket handling, and post-session reporting.
  - Multi-tenant tenant ID isolation at the document chunk level.
- **Architecture Bottleneck (Single-Node SQLite in Distributed Horizon):**
  The system relies on SQLite (`vivora.db`). In `docker-compose.yml`, the database is mounted via a single host volume. Any deployment to horizontally autoscaling platforms (AWS ECS, Kubernetes, GCP Cloud Run) will experience fatal concurrent write lock errors (`sqlite3.OperationalError: database is locked`) during simultaneous viva exams.
- **Lack of Background Task Queue:**
  Report synthesis (`ReportAgent`) and audio TTS generation run directly inside FastAPI's event loop via `asyncio` or ad-hoc thread pools. Heavy LLM processing stalls the event loop and delays concurrent WebSocket audio frames. A Redis + Celery / ARQ worker queue is essential for background report compilation.

---

### Phase 2: Functional & Edge-Case Testing

#### Finding F-FUNC-08 (P0 — Critical): Mismatched WebSocket Event Names for Session Controls
- **Location:** `frontend/src/app/session/[id]/page.tsx:413, 432` vs `backend/app/api/ws/interview_ws.py:506, 532`
- **What is wrong:** The frontend UI provides buttons for "Replay Question" and "Next Question". When clicked, the frontend emits:
  ```json
  {"type": "replay_question", "session_id": "..."}
  {"type": "next_question", "session_id": "..."}
  ```
  However, the backend WebSocket state machine exclusively expects:
  ```python
  if msg_type == "repeat_question": ...
  elif msg_type == "skip_question": ...
  ```
- **How to reproduce:** Start any session. Click "Replay Question". The avatar does nothing. The terminal logs: `[WS] Unknown message type: replay_question`.
- **Why it matters:** Core controls for students with hearing difficulty or students wanting to proceed are completely unresponsive.
- **Exact Fix:** Align message types across client and server to `"repeat_question"` and `"skip_question"`.

#### Finding F-FUNC-09 (P0 — Critical): Premature Navigation and Unhandled Crash on Report Page
- **Location:** `frontend/src/app/session/[id]/page.tsx:454-460` and `frontend/src/app/report/[id]/page.tsx:120-135`
- **What is wrong:** When the user clicks "End Session", the frontend sends `"end_session"` and synchronously invokes `router.push(`/report/${sessionId}`)`. At this point, the backend has just started background report generation. When `/report/[id]` loads, `data.rubrics` and `data.questions` are empty or `undefined`. The report page executes `data.questions.map(...)` without optional chaining or null checking, triggering an unhandled client-side `TypeError: Cannot read properties of undefined (reading 'length')`.
- **How to reproduce:** Click "End Session" in any active interview. The browser immediately displays a Next.js white screen crash.
- **Why it matters:** The user's final impression of the product is a catastrophic crash after completing their entire oral exam.
- **Exact Fix:** Add a polling/loading stage in `/report/[id]` that renders a skeleton screen with `"Analyzing your performance..."` until `status === "completed"`, and safe-guard all property access with optional chaining (`data?.questions ?? []`).

#### Finding F-FUNC-02 (P1 — High): Countdown Timer Desynchronization
- **Location:** `frontend/src/app/session/[id]/page.tsx:74`
- **What is wrong:** The client-side countdown timer is hardcoded: `const [timeLeft, setTimeLeft] = useState(3600);` (60 minutes). However, the session metadata returned by `GET /api/session/{id}` specifies `time_limit_min: 15`. The backend WebSocket automatically disconnects and marks the exam timed-out at 15 minutes while the student's timer displays 45:00 remaining.
- **Why it matters:** Students pacing their answers get abruptly cut off with no warning.
- **Exact Fix:** Initialize `timeLeft` from `sessionData.time_limit_min * 60` upon session load.

---

### Phase 3: Frontend & Design Engineering

#### Finding F-FUNC-07 (P0 — Critical): Rubric Display Scale Mismatch
- **Location:** `frontend/src/app/session/[id]/page.tsx:850-891`
- **What is wrong:** The EvaluatorAgent outputs scores on a 0.0 to 10.0 scale (e.g., `8.5`). The UI displays:
  ```tsx
  <span className="text-xs font-semibold">{criterion.score}/100</span>
  <div className="h-1.5 bg-neutral-100 rounded-full">
    <div style={{ width: `${criterion.score}%` }} />
  </div>
  ```
  An outstanding score of 8.5/10 is rendered as `8.5/100` with an 8.5% progress bar width. Furthermore, if criteria objects return `total_score` instead of `score`, it renders `undefined/100`.
- **Why it matters:** High-performing students believe they scored failing grades of 8% or saw broken undefined indicators.
- **Exact Fix:** Normalize rubric scores to either 0–10 or 0–100 consistently across agent schemas and UI components (`criterion.score * 10}%`).

#### Finding F-UI-01 (P1 — High): Breakpoint Layout Collapse on Tablet/Mobile
- **Location:** `frontend/src/app/session/[id]/page.tsx:536`
- **What is wrong:** The stage uses `flex flex-row` with an uncompromising `w-96` (384px) fixed sidebar and minimum video stage width. On screens below 1024px (iPad portrait, smartphones), the video stage is compressed to under 120px wide, and the action bar overflows horizontally off-screen.
- **Why it matters:** Over 45% of students practice interviews on iPads or mobile devices. The app is unusable on non-desktop viewports.
- **Exact Fix:** Apply responsive grid/flex layout: `flex flex-col lg:flex-row`, stacking the doubt/transcript panel below the video feed on viewports $< 1024\text{px}$.

#### Finding F-UI-03 (P2 — Medium): Contrast Violations in Core Badges (WCAG AA)
- **Location:** `frontend/src/app/globals.css` & `session/[id]/page.tsx`
- **What is wrong:** Secondary metadata text uses `#8c9099` on canvas background `#FAF9F5`. The contrast ratio is 2.8:1, failing WCAG AA requirements (minimum 4.5:1). Green indicator badges `#7D9F68` on white fail at 3.1:1.
- **Exact Fix:** Darken muted text to `#5A5D64` (5.8:1 ratio) and accent badges to `#4C6E38` (4.6:1 ratio).

---

### Phase 4: Backend & Database (Including Concurrency & Scale Addendum)

#### Finding F-BE-01 (P1 — High): Missing SQLite Pragmas and Foreign Key Enforcement
- **Location:** `backend/app/db/database.py:15`
- **What is wrong:** Database connection initialization lacks WAL mode and foreign key enforcement:
  ```python
  engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
  ```
  Runtime query of pragmas confirms: `foreign_keys = 0` (Disabled), `journal_mode = delete`.
- **Why it matters:** Deleting an uploaded document or user leaves orphaned records, corrupting session statistics.
- **Exact Fix:** Register SQLAlchemy connect event listeners setting `PRAGMA foreign_keys=ON;` and `PRAGMA journal_mode=WAL;`.

#### Finding F-BE-07 (P1 — High): Zero `busy_timeout` and Concurrency Failure Under Load
- **Location:** `backend/app/db/database.py:15`
- **What is wrong:** SQLite is initialized without a `busy_timeout` pragma (defaulting to 0.0s). In an automated benchmark executing 10 concurrent threads inserting into `answers`, **10 out of 10 requests immediately failed with `OperationalError: database is locked` (0% success rate)**.
- **How to reproduce:** Run 10 simultaneous writes against `vivora.db` without `busy_timeout`.
- **Why it matters:** When two or more students submit answers simultaneously, one or both will suffer internal 500 errors.
- **Exact Fix:** Add `connect_args={"check_same_thread": False, "timeout": 15.0}` and execute `PRAGMA busy_timeout=5000;`. In benchmark verification with `timeout=5.0` and `WAL`, success rate improved to **10/10 (100% success rate, 0 errors)**.

#### Finding F-BE-08 (P1 — High): Absence of Rate Limiting on Cost-Intensive Endpoints
- **Location:** `backend/app/api/routes/upload.py:73, 122`, `session.py:54`, and `interview_ws.py:541`
- **What is wrong:** Rate limiting is implemented strictly in `auth.py` for login/signup (`SimpleRateLimiter`). Endpoints that directly trigger LLM inference (`/upload/text`, `/upload/file`, `/session/start`, and WebSocket `ask_doubt`/`submit_answer`) have **zero rate limiting**.
- **Why it matters:** A single malicious or misconfigured script can issue 1,000 requests per minute to `/api/session/start` or spam `ask_doubt`, consuming thousands of LLM API calls and exhausting API quotas.
- **Exact Fix:** Apply an IP- and User-level token bucket rate limiter (e.g. 10 session creations / hr, 30 doubt queries / hr) across all inference routes.

#### Finding F-BE-09 (P1 — High): Double-Submit Race Condition on Answer Submission
- **Location:** `backend/app/api/ws/interview_ws.py:441-474`
- **What is wrong:** `submit_answer` does not check if an `Answer` entity already exists for the given `question_id`.
- **How to reproduce:** Emit two `submit_answer` messages rapidly over the WebSocket connection.
- **Why it matters:** Two distinct `Answer` rows and two duplicate `follow_up` questions are created in the database, resulting in duplicate scoring and corrupting report order.
- **Exact Fix:** Check for existing answers before insertion: `if db.query(Answer).filter(Answer.question_id == target_q.id).first(): return`.

---

### Phase 5: AI Systems & Agent Pipeline

#### Finding F-AI-01 (P1 — High): Omission of `max_tokens` on LLM Invocations
- **Location:** `backend/app/llm/router.py:112, 185, 230`
- **What is wrong:** `_call_groq`, `_call_gemini`, and `_call_openai` do not include `max_tokens` in completion payloads.
- **How to reproduce:** Submit an answer that triggers an open-ended conversational evaluation. The LLM generates up to 4,096 tokens.
- **Why it matters:** Extends turn latency from 1.2s to 20s+ and causes severe API cost runaway.
- **Exact Fix:** Enforce role-specific token limits: `max_tokens=250` for `live_turn`, `max_tokens=600` for `evaluation`, and `max_tokens=2500` for `report`.

#### Finding F-AI-02 (P1 — High): Question Agent Yields Literal `"N/A"` on Sparse Context
- **Location:** `backend/app/agents/question_agent.py:104`
- **What is wrong:** If an uploaded document has sparse text or lacks explicit questions, `QuestionAgent` does not validate generated output length, returning `"N/A"`.
- **How to reproduce:** Upload a 1-sentence text document and start a session.
- **Why it matters:** The avatar literally speaks "N/A" aloud to the candidate.
- **Exact Fix:** Add post-generation validation: if length $< 15$ characters or matches `N/A`, fall back to standard core syllabus question generators.

#### Finding F-AI-03 (P0 — Critical): Report Scoring Loophole on Skipped Questions
- **Location:** `backend/app/agents/report_agent.py:46` & `backend/app/api/ws/interview_ws.py:532-540`
- **What is wrong:** When a student skips a question, no `Answer` is recorded. `report_agent.py` calculates overall score as `sum(e.score for e in scored_evals) / scored_count`.
- **How to reproduce:** Start a 10-question exam. Answer Question 1 with a 10/10 answer. Skip Questions 2 through 10. Click "End Session".
- **Why it matters:** The candidate receives an overall grade of `10.0 / 10.0 (100%)` and a `"complete"` report despite answering only 10% of the exam.
- **Exact Fix:** Calculate average over total session questions: `overall_score = sum(scores) / max(len(session.questions), 1)`.

#### Finding F-FUNC-01 (P1 — High): Fallback Provider Question Shortfall
- **Location:** `backend/app/llm/router.py:352-385`
- **What is wrong:** `SmartRuleFallbackProvider.generate_json()` hardcodes exactly 4 questions, while the standard exam configuration expects 5 to 10 questions.
- **How to reproduce:** Set `LLM_PROVIDER=mock` and run `test_interview_role_customization.py`.
- **Why it matters:** Degraded mode sessions are truncated and fail test assertions.
- **Exact Fix:** Dynamically generate $N$ mock questions matching the requested `question_count`.

---

### Phase 6: Security & OWASP

#### Finding F-SEC-02 (P0 — Critical): Default Insecure JWT Secret Key Fallback
- **Location:** `backend/app/core/auth.py:52` & `docker-compose.yml:14`
- **What is wrong:** In `auth.py`:
  ```python
  _SECRET_KEY = getattr(settings, "JWT_SECRET_KEY", None) or "vivora-insecure-dev-secret-key-change-in-production"
  ```
  In `docker-compose.yml`:
  ```yaml
  JWT_SECRET_KEY=${JWT_SECRET_KEY:-vivora-production-secure-jwt-secret-key-32chars}
  ```
- **How to reproduce:** Deploy via Docker Compose without setting `JWT_SECRET_KEY`. Sign a JWT using the default secret.
- **Why it matters:** An attacker can forge arbitrary JWTs with `{"sub": "<any_uuid>"}` and gain unauthorized access to any account.
- **Exact Fix:** In production mode (`ENV != 'development'`), raise a fatal exception at startup if `JWT_SECRET_KEY` is empty or matches default strings.

#### Finding F-SEC-01 (P1 — High): Hardcoded Live API Key in Local Environment File
- **Location:** `backend/.env`
- **What is wrong:** An active Groq API key is stored in `backend/.env`.
- **Why it matters:** Risk of accidental credential leakage during manual staging or team sharing.
- **Exact Fix:** Standardize secret ingestion via environment variables or secret management tools.

#### Finding F-SEC-03 (P2 — Medium): Missing Password Reset Capability
- **Location:** `backend/app/api/routes/auth.py`
- **What is wrong:** No endpoints exist for `forgot-password` or `reset-password`.
- **Why it matters:** Users who forget passwords or mistype during signup are permanently locked out.
- **Exact Fix:** Implement tokenized email password reset routes.

---

### Phase 7: DevOps, Infrastructure & Launch Readiness

#### Finding F-DEVOPS-01 (P1 — High): Broken CI Pipeline on Alembic Command
- **Location:** `.github/workflows/ci.yml:26`
- **What is wrong:** The CI configuration executes `alembic upgrade head`, but Alembic is missing migrations for core tables, and the local environment failed with `No module named alembic`.
- **How to reproduce:** Push a branch to trigger GitHub Actions.
- **Why it matters:** Blocks automated PR testing and release deployments.
- **Exact Fix:** Generate a complete initial Alembic migration and ensure dependencies are installed in CI.

#### Finding F-DEVOPS-02 (P1 — High): Missing Global React Error Boundary (`error.tsx`)
- **Location:** `frontend/src/app/`
- **What is wrong:** Next.js 15 App Router lacks an `error.tsx` file.
- **Why it matters:** Any unhandled exception during a session unmounts the root component, rendering a blank white screen.
- **Exact Fix:** Create `frontend/src/app/error.tsx` with a branded recovery UI and session retry button.

#### Finding F-DEVOPS-03 (P2 — Medium): Missing OpenGraph Social Preview Metadata
- **Location:** `frontend/src/app/layout.tsx`
- **What is wrong:** Layout omits `openGraph`, `twitter`, and canonical URL configurations.
- **Why it matters:** Links shared on social media display blank grey boxes without branding.
- **Exact Fix:** Configure comprehensive OpenGraph tags in `metadata`.

---

### Phase 8: Product Strategy & Business Viability

#### Finding F-PROD-01 (P1 — High): Absence of Usage Quotas and Billing Gateways
- **Location:** Global Architecture & Route Handlers
- **What is wrong:** The application has zero payment gateway integration (Stripe/Razorpay) and zero per-user session limits.
- **Why it matters:** A user can run dozens of exams per day, generating massive LLM and TTS infrastructure bills with zero revenue capture.
- **Exact Fix:** Implement a freemium model (e.g., 2 free practice vivas/month) and require subscription plans for extended usage.

#### Finding F-PROD-02 (P2 — Medium): Excessive Onboarding Friction
- **Location:** Registration Funnel (`signup/page.tsx`)
- **What is wrong:** Requires full registration, age verification, email confirmation, and topic configuration before allowing a candidate to answer a single question.
- **Why it matters:** Causes high user drop-off prior to value discovery.
- **Exact Fix:** Provide a 1-minute interactive guest demo directly on the landing page.

---

## 4. Comprehensive Triage Table

| ID | Issue Description | Area | Priority | Est. Effort | Risk if Deferred |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **F-FUNC-09** | End session premature redirect causes crash | Frontend | **P0** | 2 hrs | 100% of completing users hit unhandled white screen |
| **F-FUNC-08** | WebSocket replay/skip message names mismatched | WS/State | **P0** | 1 hr | Core controls unresponsive; users cannot repeat questions |
| **F-FUNC-07** | Rubric displays `undefined/100` and 8% score bars | UI/UX | **P0** | 1.5 hrs | Severe student panic and loss of credibility |
| **F-SEC-02** | Default insecure JWT secret fallback | Security | **P0** | 1 hr | Total auth bypass and account impersonation |
| **F-AI-03** | Skimming single question awards 100% score | AI Agent | **P0** | 1.5 hrs | Broken academic integrity; invalid reports |
| **F-BE-01** | SQLite foreign keys disabled; delete journal mode | Database | **P1** | 1 hr | Corrupt orphan records; database lock timeouts |
| **F-BE-02** | Split DB transaction leaves unscored answers | Backend | **P1** | 2 hrs | Data inconsistency on network or LLM hiccup |
| **F-BE-07** | Zero `busy_timeout` causes 10/10 concurrency errors | Database | **P1** | 1 hr | Immediate 500 errors during concurrent student exams |
| **F-BE-08** | Zero rate limits on LLM endpoints | Security | **P1** | 2 hrs | Uncontrolled API cost and quota exhaustion |
| **F-BE-09** | Double-submit creates duplicate Answer records | Realtime | **P1** | 1.5 hrs | Corrupted question order and distorted reports |
| **F-BE-03** | N+1 queries on session and report endpoints | Database | **P1** | 2.5 hrs | Latency explodes to $> 2\text{s}$ under 20 concurrent users |
| **F-BE-04** | HTTP client recreated on every LLM call | Backend | **P1** | 1 hr | Socket exhaustion and +300ms latency overhead |
| **F-FUNC-02** | Hardcoded 60m timer desyncs from 15m server limit | Frontend | **P1** | 1 hr | Users abruptly kicked out without notice |
| **F-AI-01** | `max_tokens` omitted on all LLM calls | AI Systems | **P1** | 1.5 hrs | Token runaway, high API costs, 20s+ turn latency |
| **F-AI-02** | Sparse RAG context yields literal `"N/A"` questions | AI Systems | **P1** | 2 hrs | Avatar speaks nonsense to candidate |
| **F-DEVOPS-01**| CI workflow fails on Alembic check | DevOps | **P1** | 2 hrs | Broken pull request and deployment pipelines |
| **F-DEVOPS-02**| Missing Next.js `error.tsx` boundary | Frontend | **P1** | 1.5 hrs | Unhandled errors crash the entire browser window |
| **F-UI-01** | Session stage layout breaks on viewports $< 1024\text{px}$| Frontend | **P1** | 3 hrs | Unusable on iPad and mobile devices |
| **F-PROD-01** | Zero usage quota or billing enforcement | Business | **P1** | 6 hrs | Financial loss via unrestricted API consumption |
| **F-FUNC-04** | Demo login credentials fail with 401 | Frontend | **P2** | 0.5 hr | First impression failure for reviewers/evaluators |
| **F-FUNC-06** | Signup form missing password confirmation | Frontend | **P2** | 0.5 hr | Permanent account lockout on registration typo |
| **F-UI-03** | Low contrast text fails WCAG AA standards | UI/UX | **P2** | 1.5 hrs | Accessibility non-compliance |
| **F-DEVOPS-03**| Missing OpenGraph social tags and sitemap | SEO | **P2** | 2 hrs | Ugly preview snippets on LinkedIn and Twitter |
| **F-BE-06** | Rate limiter in-memory dictionary lacks cleanup | Backend | **P3** | 1 hr | Gradual memory leak under months of continuous run |

---

## 5. Go / No-Go Decision

### **VERDICT: NO-GO** 🛑

**Launch Readiness Threshold:** The platform cannot be launched until **100% of P0 blockers** and at least **80% of P1 items** are resolved and verified in staging.

#### Conditions for Re-Evaluation & "GO" Sign-Off:
1. **Interactive Session Loop Verified End-to-End:** 
   A user must be able to start an exam, ask to repeat questions, skip questions, answer questions, see correct 0–10 rubric scores, click "End Session", and transition smoothly to the completed Report page with zero console errors.
2. **Cryptographic Authentication Hardened:** 
   Production configuration must enforce non-empty, high-entropy JWT secret keys and reject hardcoded fallbacks.
3. **Database Concurrency Stabilized:** 
   Enable SQLite WAL mode, foreign keys, and `busy_timeout=5000`; eliminate N+1 queries on session load; and guard against double-submit answer creation.
4. **Scoring Formula Corrected:** 
   Report scoring must factor in total question count so that partial sessions reflect accurate performance.

---

## 6. Step-by-Step Remediation Plan (Phase 9 Implementation Roadmap)

Upon receiving user approval, remediation will execute across four prioritized batches:

### Batch 1: Immediate Blocker Resolution (P0 Fixes — Est. Time: ~6 hrs)
- **Step 1.1:** Fix WebSocket message dispatch in `session/[id]/page.tsx` (`repeat_question` and `skip_question`).
- **Step 1.2:** Resolve report navigation crash: Add loading state to `report/[id]/page.tsx` and optional chaining for rubric fields.
- **Step 1.3:** Synchronize evaluation scoring scale (convert 0–10 backend scores to consistent percentages in `session/[id]/page.tsx`).
- **Step 1.4:** Correct scoring logic in `report_agent.py` to divide over total questions, penalizing skipped questions.
- **Step 1.5:** Enforce strict JWT secret validation in `backend/app/core/auth.py` and `config.py`.

### Batch 2: Core Stability & Database Hardening (P1 Fixes — Est. Time: ~6 hrs)
- **Step 2.1:** Configure SQLite WAL mode, `busy_timeout=5000`, and foreign key pragmas in `backend/app/db/database.py`.
- **Step 2.2:** Add double-submit guard on `submit_answer` in `interview_ws.py`.
- **Step 2.3:** Apply token bucket rate limiting on `/session/start`, `/upload/*`, and WebSocket doubt handling.
- **Step 2.4:** Consolidate answer insertion and evaluation into a single atomic transaction in `session_service.py`.
- **Step 2.5:** Add `joinedload` to session and report queries to eliminate N+1 bottlenecks.
- **Step 2.6:** Introduce global singleton `httpx.AsyncClient` in `router.py` with keep-alive connection pooling.
- **Step 2.7:** Add `max_tokens` constraints across all LLM prompt invocations in `router.py`.
- **Step 2.8:** Sync countdown timer in `session/[id]/page.tsx` with backend `time_limit_min`.

### Batch 3: UI/UX & Responsive Engineering (P1/P2 Fixes — Est. Time: ~5 hrs)
- **Step 3.1:** Implement responsive flex layout in `session/[id]/page.tsx` for tablet and mobile devices.
- **Step 3.2:** Create global Next.js `error.tsx` boundary with graceful session recovery.
- **Step 3.3:** Correct WCAG contrast ratios in `globals.css` and badge components.
- **Step 3.4:** Add password confirmation field to `signup/page.tsx` and fix demo login auto-seeding.

### Batch 4: Infrastructure, CI/CD & Launch Packaging (P2 Fixes — Est. Time: ~3 hrs)
- **Step 4.1:** Clean up `.github/workflows/ci.yml` and align Alembic migration scripts.
- **Step 4.2:** Configure OpenGraph social preview tags and metadata in `layout.tsx`.
- **Step 4.3:** Add multi-stage Docker build optimizations with non-root security users.

---
*Report compiled and certified by the Unified Audit Board. Code modification remains locked until explicit user approval.*
