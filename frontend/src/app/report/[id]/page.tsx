"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getReport, ReportData } from "@/lib/api";
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
  Layers
} from "lucide-react";

export default function ReportPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
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

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 font-medium">Generating analytical viva scorecard & semantic analysis...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4 glass-panel p-8 rounded-3xl">
        <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Report Not Found</h2>
        <p className="text-sm text-gray-400">{error || "Could not retrieve report data."}</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
        >
          Back to Viva Setup
        </button>
      </div>
    );
  }

  // Calculate total marks across questions
  const totalQuestions = report.questions_review.length;
  const totalScore = report.questions_review.reduce((acc, q) => acc + (q.score || 0), 0);
  const maxScore = totalQuestions * 10;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-medium border border-white/10 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export / Print PDF</span>
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Practice Another Viva</span>
          </button>
        </div>
      </div>

      {/* Main Scorecard Banner */}
      <div className="glass-panel-glow p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 border border-emerald-500/20">
        <div className="space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <School className="w-3.5 h-3.5" />
            <span>School Viva Assessment Completed</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Official Viva Scorecard</h1>
          <p className="text-sm text-gray-400 max-w-lg leading-relaxed">
            Graded on semantic conceptual equivalence. Answers sharing the same scientific meaning were awarded full marks even when phrased in different words.
          </p>

          {report.scoring_note && (
            <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl max-w-md">
              {report.scoring_note}
            </div>
          )}
        </div>

        {/* Big Overall Marks & Percentage Box */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-surfaceLight/60 border border-emerald-500/30 min-w-[190px]">
            <Trophy className="w-8 h-8 text-emerald-400 mb-2" />
            <div className="text-3xl sm:text-4xl font-extrabold text-white">
              {totalScore.toFixed(1)} <span className="text-sm text-gray-500 font-normal">/ {maxScore}</span>
            </div>
            <div className="text-sm font-bold text-emerald-400 mt-1">
              {percentage}% • {percentage >= 80 ? "Grade A (Excellent)" : percentage >= 60 ? "Grade B (Good)" : "Needs Revision"}
            </div>
            <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mt-1">
              Overall Viva Marks
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Summary: Strengths & Revision Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strong Topics & Strengths */}
        <div className="glass-panel p-6 sm:p-7 rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
            <CheckCircle className="w-5 h-5" />
            <h3>Key Concepts Mastered</h3>
          </div>
          <ul className="space-y-2.5">
            {report.strengths.map((str, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Prioritized Revision Plan */}
        <div className="glass-panel p-6 sm:p-7 rounded-3xl space-y-4 border border-emerald-500/20">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
            <BookOpen className="w-5 h-5" />
            <h3>Targeted Revision Plan</h3>
          </div>
          <ul className="space-y-2.5">
            {report.revision_plan.map((rev, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-300">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{rev}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Question-by-Question Semantic Analysis */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span>Question-by-Question Semantic Grading</span>
          </h2>
          <span className="text-xs text-gray-400">{report.questions_review.length} Questions Evaluated</span>
        </div>

        <div className="space-y-5">
          {report.questions_review.map((item, idx) => (
            <div key={idx} className="glass-panel p-6 sm:p-7 rounded-3xl space-y-4 border border-white/10">
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                    {item.order_no}
                  </span>
                  <span className="text-xs font-bold text-white">
                    Question {item.order_no} • {item.topic}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Concept match pill */}
                  {item.score >= 8.0 ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Full Match (Same Meaning)</span>
                    </span>
                  ) : item.score >= 5.0 ? (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent-amber/15 text-amber-300 border border-accent-amber/25 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Partial Match</span>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25">
                      Needs Review
                    </span>
                  )}

                  {/* Marks badge */}
                  <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ⭐ {item.score} / 10
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Question text */}
                <p className="text-sm sm:text-base font-semibold text-white">
                  &quot;{item.question_text}&quot;
                </p>

                {/* Expected Reference Answer */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <div className="text-[11px] font-semibold uppercase text-emerald-300 flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>Expected Reference Answer:</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-200">
                    {item.reference_answer || item.model_answer}
                  </p>
                </div>

                {/* Student's Spoken Answer */}
                <div className="p-3.5 rounded-2xl bg-surfaceLight/50 border border-white/5 space-y-1">
                  <div className="text-[11px] font-semibold uppercase text-gray-400">
                    Student Spoken / Typed Response:
                  </div>
                  <p className="text-xs sm:text-sm text-gray-200 italic">
                    &quot;{item.student_transcript}&quot;
                  </p>
                </div>

                {/* Evaluator Feedback */}
                <div className="p-3.5 rounded-2xl bg-surfaceLight/80 border border-white/10 space-y-1">
                  <div className="text-[11px] font-semibold uppercase text-emerald-400">
                    Examiner Feedback:
                  </div>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">{item.feedback}</p>
                </div>

                {/* Missing Concepts (if any) */}
                {item.missing_concepts && (
                  <div className="p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-xs text-amber-300 space-y-1">
                    <div className="font-semibold">Key terms / points to reinforce:</div>
                    <p className="leading-relaxed">{item.missing_concepts}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
