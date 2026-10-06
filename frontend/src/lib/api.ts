export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return "https://vivora-backend.onrender.com/api";
  }
  return "http://127.0.0.1:8000/api";
}

export const API_BASE_URL = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
  ? "https://vivora-backend.onrender.com/api"
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api");

// ── Auth Token Management (in-memory + sessionStorage, never localStorage) ────
let _inMemoryToken: string | null = null;
let _inMemoryUser: UserProfile | null = null;

export interface UserProfile {
  user_id: string;
  email: string;
  name: string;
  account_status: string;
}

export function setAuthToken(token: string, user?: UserProfile) {
  _inMemoryToken = token;
  if (user) _inMemoryUser = user;
  if (typeof window !== "undefined") {
    sessionStorage.setItem("vivora_jwt", token);
    if (user) {
      sessionStorage.setItem("vivora_user", JSON.stringify(user));
    }
  }
}

export function getAuthToken(): string | null {
  if (_inMemoryToken) return _inMemoryToken;
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("vivora_jwt");
    if (token) {
      _inMemoryToken = token;
      return token;
    }
  }
  return null;
}

export function getStoredUser(): UserProfile | null {
  if (_inMemoryUser) return _inMemoryUser;
  if (typeof window !== "undefined") {
    const raw = sessionStorage.getItem("vivora_user");
    if (raw) {
      try {
        _inMemoryUser = JSON.parse(raw);
        return _inMemoryUser;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function clearAuthToken() {
  _inMemoryToken = null;
  _inMemoryUser = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("vivora_jwt");
    sessionStorage.removeItem("vivora_user");
  }
}

// ── Common Authenticated Fetch Wrapper ────────────────────────────────────────
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    if (err?.message === "Failed to fetch" || err?.name === "TypeError") {
      throw new Error(
        "Cannot connect to the VIVORA backend server (http://127.0.0.1:8000). Please ensure the backend is running."
      );
    }
    throw err;
  }

  if (res.status === 401) {
    clearAuthToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/signup")) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  return res;
}

// ── Auth Endpoints ────────────────────────────────────────────────────────────
export interface SignupParams {
  name: string;
  email: string;
  password: string;
  date_of_birth: string;
  parent_email?: string;
}

export interface SignupResponse {
  user_id: string;
  email: string;
  account_status: string;
  access_token?: string;
  message: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  name: string;
  account_status: string;
}

export async function signup(params: SignupParams): Promise<SignupResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Signup failed");
  }

  if (data.access_token) {
    setAuthToken(data.access_token, {
      user_id: data.user_id,
      email: data.email,
      name: params.name,
      account_status: data.account_status,
    });
  }
  return data;
}

export async function login(params: { email: string; password: string }): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Invalid email or password");
  }

  setAuthToken(data.access_token, {
    user_id: data.user_id,
    email: params.email,
    name: data.name,
    account_status: data.account_status,
  });

  return data;
}

export async function confirmParentConsent(token: string): Promise<{ success: boolean; message: string; user_id: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/parent-consent/confirm?token=${encodeURIComponent(token)}`, {
    method: "POST",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to confirm parental consent");
  }
  return data;
}

export async function getCurrentUser(): Promise<UserProfile> {
  const res = await authFetch(`${API_BASE_URL}/auth/me`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to get user profile");
  }
  return res.json();
}

// ── Session & Material Models ─────────────────────────────────────────────────
export interface CreateSessionParams {
  mode: "school" | "college" | "interview";
  title: string;
  content_text?: string;
  document_id?: string;
  question_source?: "fixed" | "generated";
  time_limit_min?: number;
  job_role?: string;
  tech_stack?: string;
  experience_level?: string;
  language?: string;
}

export interface SessionData {
  session_id: string;
  mode: string;
  time_limit_min: number;
  status: string;
  started_at: string;
  language?: string;
  questions: Array<{
    id: string;
    order_no: number;
    question_text: string;
    topic: string;
    difficulty: string;
    origin: string;
    reference_answer?: string;
    answer?: {
      id: string;
      transcript: string;
      duration_sec: number;
      evaluation?: {
        overall_score: number;
        correctness_score: number;
        is_correct?: boolean;
        concept_match?: string;
        feedback: string;
        model_answer: string;
      };
    };
  }>;
}

export interface ReportData {
  report_id: string;
  session_id: string;
  mode: string;
  status?: string;
  overall_score: number;
  strengths: string[];
  improvements: string[];
  revision_plan: string[];
  communication_score?: number;
  communication_feedback?: string;
  communication_breakdown?: {
    filler_score: number;
    pace_score: number;
    length_score: number;
    structure_score: number;
  };
  scoring_note?: string;
  topic_scores: Array<{
    topic: string;
    score: number;
    level: "strong" | "average" | "weak";
  }>;
  questions_review: Array<{
    order_no: number;
    question_text: string;
    topic: string;
    student_transcript: string;
    score: number;
    is_correct?: boolean;
    scored?: boolean;
    concept_match?: string;
    feedback: string;
    missing_concepts?: string;
    reference_answer?: string;
    model_answer: string;
    provider?: string;
  }>;
  generated_at: string;
}

export async function createSession(params: CreateSessionParams): Promise<{ session_id: string; session_token?: string }> {
  const res = await authFetch(`${API_BASE_URL}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 403 || res.status === 423) {
      throw new Error(errorData.detail || "Account requires parental consent before starting viva sessions.");
    }
    throw new Error(errorData.detail || "Failed to create viva session");
  }

  const data = await res.json();
  if (typeof window !== "undefined" && data.session_token) {
    sessionStorage.setItem(`vivora_token_${data.session_id}`, data.session_token);
  }
  return data;
}

export async function getSession(sessionId: string): Promise<SessionData> {
  const res = await authFetch(`${API_BASE_URL}/session/${sessionId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch session");
  }
  return res.json();
}

export async function getReport(sessionId: string, explicitToken?: string): Promise<ReportData> {
  let token = explicitToken;
  if (!token && typeof window !== "undefined") {
    token = sessionStorage.getItem(`vivora_token_${sessionId}`) || undefined;
  }

  const url = `${API_BASE_URL}/report/${sessionId}`;
  const headers: Record<string, string> = {};
  if (token) {
    headers["X-Session-Token"] = token;
  }

  const res = await authFetch(url, { headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch report");
  }
  return res.json();
}

export async function deleteSessionData(sessionId: string, explicitToken?: string): Promise<{ deleted: boolean }> {
  let token = explicitToken;
  if (!token && typeof window !== "undefined") {
    token = sessionStorage.getItem(`vivora_token_${sessionId}`) || undefined;
  }

  const url = `${API_BASE_URL}/report/${sessionId}/data`;
  const headers: Record<string, string> = {};
  if (token) {
    headers["X-Session-Token"] = token;
  }

  const res = await authFetch(url, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to delete session data");
  }
  return res.json();
}

export async function uploadTextMaterial(title: string, content: string, docType = "questions") {
  const res = await authFetch(`${API_BASE_URL}/upload/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, doc_type: docType }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to upload material");
  }
  return res.json();
}

export async function uploadFileMaterial(file: File, title?: string, docType = "questions") {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  formData.append("doc_type", docType);

  const res = await authFetch(`${API_BASE_URL}/upload/file`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to upload and parse file");
  }
  return res.json();
}
