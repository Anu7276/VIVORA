const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export interface CreateSessionParams {
  mode: "school" | "college" | "interview";
  title: string;
  content_text: string;
  question_source?: "fixed" | "generated";
  time_limit_min?: number;
  user_id?: string;
}

export interface StudentProfile {
  user_id: string;
  name: string;
  email: string;
  role: string;
  consent_verified: boolean;
}

export interface SessionData {
  session_id: string;
  mode: string;
  time_limit_min: number;
  status: string;
  started_at: string;
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
  overall_score: number;
  strengths: string[];
  improvements: string[];
  revision_plan: string[];
  communication_feedback?: string;
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
    concept_match?: string;
    feedback: string;
    missing_concepts?: string;
    reference_answer?: string;
    model_answer: string;
    provider?: string;
  }>;
  generated_at: string;
}

export async function getDemoStudent(): Promise<StudentProfile> {
  const res = await fetch(`${API_BASE_URL}/session/demo-student`);
  if (!res.ok) throw new Error("Failed to load demo student profile");
  const data = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("vivora_user_id", data.user_id);
    localStorage.setItem("vivora_student_name", data.name);
  }
  return data;
}

export async function registerStudent(params: {
  name: string;
  grade?: string;
  parent_email: string;
  confirm_consent?: boolean;
}): Promise<StudentProfile> {
  const res = await fetch(`${API_BASE_URL}/session/register-student`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      grade: params.grade || "Class 10",
      parent_email: params.parent_email,
      confirm_consent: params.confirm_consent ?? true,
    }),
  });
  if (!res.ok) throw new Error("Failed to register student profile");
  const data = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("vivora_user_id", data.user_id);
    localStorage.setItem("vivora_student_name", data.name);
  }
  return data;
}

export async function createSession(params: CreateSessionParams): Promise<{ session_id: string; session_token?: string }> {
  let userId = params.user_id;
  if (!userId && typeof window !== "undefined") {
    userId = localStorage.getItem("vivora_user_id") || undefined;
  }
  if (!userId) {
    try {
      const demo = await getDemoStudent();
      userId = demo.user_id;
    } catch (e) {
      console.warn("Could not auto-fetch demo student profile:", e);
    }
  }

  const payload = {
    ...params,
    user_id: userId,
  };

  const res = await fetch(`${API_BASE_URL}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to create viva session");
  }

  const data = await res.json();
  if (typeof window !== "undefined" && data.session_token) {
    localStorage.setItem(`vivora_token_${data.session_id}`, data.session_token);
  }
  return data;
}

export async function getSession(sessionId: string): Promise<SessionData> {
  const res = await fetch(`${API_BASE_URL}/session/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

export async function getReport(sessionId: string, explicitToken?: string): Promise<ReportData> {
  let token = explicitToken;
  if (!token && typeof window !== "undefined") {
    token = localStorage.getItem(`vivora_token_${sessionId}`) || undefined;
  }

  const url = token
    ? `${API_BASE_URL}/report/${sessionId}?token=${encodeURIComponent(token)}`
    : `${API_BASE_URL}/report/${sessionId}`;

  const headers: Record<string, string> = {};
  if (token) {
    headers["X-Session-Token"] = token;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch report");
  }
  return res.json();
}

export async function uploadTextMaterial(title: string, content: string, docType = "questions") {
  const res = await fetch(`${API_BASE_URL}/upload/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, doc_type: docType }),
  });
  if (!res.ok) throw new Error("Failed to upload material");
  return res.json();
}

export async function uploadFileMaterial(file: File, title?: string, docType = "questions") {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  formData.append("doc_type", docType);

  const res = await fetch(`${API_BASE_URL}/upload/file`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to upload and parse PDF file");
  }
  return res.json();
}
