const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export interface CreateSessionParams {
  mode: "school" | "college" | "interview";
  title: string;
  content_text: string;
  question_source?: "fixed" | "generated";
  time_limit_min?: number;
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
    answer?: {
      id: string;
      transcript: string;
      duration_sec: number;
      evaluation?: {
        overall_score: number;
        correctness_score: number;
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
    feedback: string;
    missing_concepts?: string;
    model_answer: string;
  }>;
  generated_at: string;
}

export async function createSession(params: CreateSessionParams): Promise<{ session_id: string }> {
  const res = await fetch(`${API_BASE_URL}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to create viva session");
  return res.json();
}

export async function getSession(sessionId: string): Promise<SessionData> {
  const res = await fetch(`${API_BASE_URL}/session/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

export async function getReport(sessionId: string): Promise<ReportData> {
  const res = await fetch(`${API_BASE_URL}/report/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch report");
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
