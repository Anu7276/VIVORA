"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getReport, deleteSessionData, ReportData } from "@/lib/api";
import {
  Trophy,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Download,
  CheckCircle2,
  HelpCircle,
  Award,
  School,
  FileCheck2,
  Layers,
  Activity,
  MessageSquare,
  Trash2
} from "lucide-react";

export default function ReportPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    getReport(sessionId)
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load report");
        setLoading(false);
      });
  }, [sessionId]);

  const handleDeleteData = async () => {
    if (!confirm("Are you sure you want to delete all personal study data, questions, answers, and documents for this session? This action cannot be undone.")) {
      return;
    }
    setDeleting(true);
    try {
      await deleteSessionData(sessionId);
      alert("All data and documents associated with this session have been permanently deleted.");
      router.push("/");
    } catch (err: any) {
      alert("Failed to delete data: " + (err.message || "Unknown error"));
      setDeleting(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-4 bg-[#fcfbf9]">
        <div className="w-12 h-12 border-4 border-[#0f766e] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#64748b] font-medium font-mono text-sm">Generating analytical viva scorecard & rubric metrics...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#fcfbf9] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center py-12 px-8 space-y-4 bg-white border border-[#e2e8f0] rounded-2xl shadow-lg">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-[#0f172a]">Report Not Found</h2>
          <p className="text-sm text-[#64748b]">{error || "Could not retrieve session report data."}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2.5 rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold shadow-sm transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Calculate total marks across questions
  const totalQuestions = report.questions_review.length;
  const totalScore = report.questions_review.reduce((acc, q) => acc + (q.score || 0), 0);
  const maxScore = totalQuestions * 10;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : (report.overall_score || 0);

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#1e293b] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-xs font-semibold text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold border border-[#e2e8f0] shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
            <button
              onClick={handleDeleteData}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deleting ? "Purging..." : "Delete Data (GDPR)"}</span>
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-bold shadow-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Practice Another</span>
            </button>
          </div>
        </div>

        {/* Main Scorecard Banner */}
        <div className="bg-white border border-[#e2e8f0] p-6 md:p-8 rounded-2xl shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2.5 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] text-[#0f766e] text-xs font-bold uppercase font-mono">
                <School className="w-3.5 h-3.5" />
                <span>{report.mode || "Viva"} Assessment</span>
              </span>
              {report.status === "partial" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Partial Session</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#0f172a] tracking-tight">
              {report.mode ? `${report.mode.toUpperCase()} Viva Scorecard` : "Viva Performance Scorecard"}
            </h1>
            <p className="text-sm text-[#64748b]">
              Generated on {new Date(report.generated_at).toLocaleString()} • {totalQuestions} Questions Evaluated
            </p>
          </div>

          {/* Grade Badge */}
          <div className="flex items-center gap-4 bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-xl shrink-0">
            <div className="text-center px-2">
              <div className="text-3xl font-display font-bold text-[#0f766e]">{report.overall_score >= 80 ? "A" : report.overall_score >= 60 ? "B" : "C"}</div>
              <div className="text-[10px] font-mono uppercase font-bold text-[#64748b]">Overall Grade</div>
            </div>
            <div className="w-px h-10 bg-[#e2e8f0]" />
            <div className="text-center px-2">
              <div className="text-3xl font-display font-bold text-[#0f172a]">{percentage}%</div>
              <div className="text-[10px] font-mono uppercase font-bold text-[#64748b]">{totalScore}/{maxScore || 100} pts</div>
            </div>
          </div>
        </div>

        {/* ── TOPIC PERFORMANCE MATRIX ──────────────────────────────────────── */}
        {report.topic_scores && report.topic_scores.length > 0 && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-[#0f172a] text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#0f766e]" />
              <span>Topic Competency Breakdown</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {report.topic_scores.map((ts, idx) => (
                <div key={idx} className="bg-[#f8fafc] border border-[#e2e8f0] p-3.5 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0f172a] truncate">{ts.topic}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded capitalize ${
                      ts.level === "strong" ? "bg-emerald-100 text-emerald-800" : ts.level === "weak" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {ts.level}
                    </span>
                  </div>
                  <div className="text-sm font-bold font-mono text-[#0f766e]">{ts.score}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── QUESTION-BY-QUESTION REVIEW ────────────────────────────────────── */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-md overflow-hidden">
          <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
            <h3 className="font-display font-bold text-[#0f172a] text-base flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#0f766e]" />
              <span>Question-by-Question Review</span>
            </h3>
            <span className="text-xs font-mono font-bold text-[#64748b]">{totalQuestions} Questions Evaluated</span>
          </div>

          <div className="divide-y divide-[#e2e8f0]">
            {report.questions_review.map((q, idx) => (
              <div key={idx} className="p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <span className="text-xs font-mono font-bold text-[#0f766e]">Question {q.order_no || idx + 1}</span>
                    <h4 className="text-sm font-semibold text-[#0f172a] leading-relaxed">{q.question_text}</h4>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#f0fdf4] text-[#0f766e] border border-[#bbf7d0] shrink-0">
                    {q.score || 0} / 10 pts
                  </span>
                </div>

                {/* Candidate Transcript */}
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-xs space-y-1">
                  <span className="font-mono text-[10px] uppercase font-bold text-[#64748b]">Spoken Response:</span>
                  <p className="text-[#334155] leading-relaxed italic">{q.student_transcript || "No transcript recorded"}</p>
                </div>

                {/* Evaluator Feedback */}
                {q.feedback && (
                  <div className="text-xs text-[#334155] bg-[#f0fdf4]/60 border border-[#bbf7d0] p-3 rounded-xl leading-relaxed">
                    <span className="font-bold text-[#0f766e]">Examiner Feedback: </span>
                    {q.feedback}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── PRIORITIZED REVISION PLAN ──────────────────────────────────────── */}
        {report.revision_plan && report.revision_plan.length > 0 && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-md space-y-4">
            <h3 className="font-display font-bold text-[#0f172a] text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#0f766e]" />
              <span>Prioritized Revision Plan</span>
            </h3>

            <div className="space-y-2.5">
              {report.revision_plan.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                  <span className="w-6 h-6 rounded-full bg-[#0f766e] text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-xs text-[#334155] leading-relaxed font-medium">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
