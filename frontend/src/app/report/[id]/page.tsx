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
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 font-medium">Generating analytical performance report...</p>
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
          className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold"
        >
          Back to Practice Room
        </button>
      </div>
    );
  }

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
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-lg shadow-primary-500/20 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Start Another Viva</span>
          </button>
        </div>
      </div>

      {/* Main Scorecard Banner */}
      <div className="glass-panel-glow p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Viva Assessment Completed</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Performance Scorecard</h1>
          <p className="text-sm text-gray-400 max-w-md">
            Evaluation rubric based on conceptual correctness, depth, and speech clarity. Audio was processed in memory and never saved.
          </p>
        </div>

        {/* Big Overall Score Circle */}
        <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-surfaceLight/50 border border-white/10 min-w-[180px]">
          <Trophy className="w-8 h-8 text-primary-400 mb-2" />
          <div className="text-4xl sm:text-5xl font-extrabold text-white">
            {report.overall_score}
            <span className="text-lg text-gray-500 font-normal"> / 10</span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mt-1">
            {report.overall_score >= 8.0 ? "Excellent" : report.overall_score >= 6.0 ? "Good" : "Needs Revision"}
          </span>
        </div>
      </div>

      {/* 2-Column Summary: Strengths & Revision Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strong Topics & Strengths */}
        <div className="glass-panel p-6 sm:p-7 rounded-3xl space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
            <CheckCircle className="w-5 h-5" />
            <h3>Key Strengths</h3>
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
        <div className="glass-panel p-6 sm:p-7 rounded-3xl space-y-4 border border-primary-500/20">
          <div className="flex items-center gap-2.5 text-primary-400 font-bold text-base">
            <BookOpen className="w-5 h-5" />
            <h3>Prioritized Revision Plan</h3>
          </div>
          <ul className="space-y-2.5">
            {report.revision_plan.map((rev, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-300">
                <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{rev}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Question-by-Question Deep Dive */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent-cyan" />
            <span>Question-by-Question Analysis</span>
          </h2>
          <span className="text-xs text-gray-500">{report.questions_review.length} Questions Evaluated</span>
        </div>

        <div className="space-y-4">
          {report.questions_review.map((item, idx) => (
            <div key={idx} className="glass-panel p-6 rounded-3xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                <span className="text-xs font-bold text-primary-400">
                  Question {item.order_no} • {item.topic}
                </span>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Score: {item.score} / 10
                </span>
              </div>

              <div className="space-y-3">
                <p className="text-sm sm:text-base font-semibold text-white">
                  &quot;{item.question_text}&quot;
                </p>

                {/* Spoken Answer */}
                <div className="p-3.5 rounded-2xl bg-surfaceLight/40 border border-white/5 space-y-1">
                  <div className="text-[11px] font-semibold uppercase text-gray-400">Your Spoken Answer:</div>
                  <p className="text-xs sm:text-sm text-gray-300 italic">&quot;{item.student_transcript}&quot;</p>
                </div>

                {/* Evaluator Feedback */}
                <div className="p-3.5 rounded-2xl bg-primary-500/10 border border-primary-500/20 space-y-1">
                  <div className="text-[11px] font-semibold uppercase text-primary-300">Feedback:</div>
                  <p className="text-xs text-gray-200">{item.feedback}</p>
                </div>

                {/* Model / Reference Answer */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <div className="text-[11px] font-semibold uppercase text-emerald-300">RAG Model Answer:</div>
                  <p className="text-xs text-gray-200">{item.model_answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
