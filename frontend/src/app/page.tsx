"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession, uploadFileMaterial } from "@/lib/api";
import { 
  School, 
  GraduationCap, 
  Briefcase, 
  Sparkles, 
  UploadCloud, 
  ArrowRight, 
  Mic, 
  ShieldCheck, 
  Clock, 
  BookOpen,
  Volume2,
  FileText,
  CheckCircle2,
  Trash2
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"school" | "college" | "interview">("school");
  const [inputTab, setInputTab] = useState<"text" | "pdf">("text");
  const [title, setTitle] = useState("Class 10 General Science Viva");
  const [contentText, setContentText] = useState(
`Q1: What is photosynthesis and which organelle carries it out?
Ans: Photosynthesis is the process by which green plants make food using sunlight, carbon dioxide, and water. It occurs in chloroplasts.

Q2: State Newton's First Law of Motion with a simple example.
Ans: An object remains at rest or in uniform motion unless acted upon by an external unbalanced force. For example, a rolling ball stopping due to friction.

Q3: What is the difference between an acid and a base based on pH and ions?
Ans: Acids have a pH below 7 and produce H+ ions in water, while bases have a pH above 7 and produce OH- ions.`
  );
  
  // PDF upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfMetadata, setPdfMetadata] = useState<{
    filename: string;
    num_pages: number;
    questions_detected: number;
    topics: string[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPdfParsing(true);
    setError(null);

    try {
      const data = await uploadFileMaterial(file, title, mode === "school" ? "questions" : "syllabus");
      setPdfMetadata({
        filename: data.filename || file.name,
        num_pages: data.num_pages || 1,
        questions_detected: data.questions_detected || 0,
        topics: data.topics || [],
      });
      if (data.extracted_text) {
        setContentText(data.extracted_text);
      }
      if (!title || title.includes("Class 10")) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err: any) {
      setError(err.message || "Failed to process PDF file.");
      setSelectedFile(null);
    } finally {
      setPdfParsing(false);
    }
  };

  const setPreset = (type: "school" | "college" | "interview") => {
    setMode(type);
    if (type === "school") {
      setTitle("Class 10 General Science Viva");
      setContentText(
`Q1: What is photosynthesis and which organelle carries it out?
Ans: Photosynthesis is the process by which green plants make food using sunlight, carbon dioxide, and water. It occurs in chloroplasts.

Q2: State Newton's First Law of Motion with a simple example.
Ans: An object remains at rest or in uniform motion unless acted upon by an external unbalanced force. For example, a rolling ball stopping due to friction.

Q3: What is the difference between an acid and a base based on pH and ions?
Ans: Acids have a pH below 7 and produce H+ ions in water, while bases have a pH above 7 and produce OH- ions.`
      );
    } else if (type === "college") {
      setTitle("Operating Systems & Networks Viva");
      setContentText(
`Topics to examine:
1. Process Synchronization, Mutex vs Semaphore, and Deadlock prevention conditions.
2. Virtual Memory: Paging, Page Fault Handling, and Thrashing.
3. TCP 3-Way Handshake vs UDP connectionless delivery.`
      );
    } else {
      setTitle("Full Stack Software Engineer Interview");
      setContentText(
`Job Profile: Senior Full-Stack Engineer (React, Node.js, Distributed Systems)
Key Areas:
- Scalable System Design (Caching, Load Balancing, Database Sharding)
- REST vs GraphQL vs WebSockets
- Performance optimization and async concurrency models`
      );
    }
  };

  const handleStartViva = async () => {
    if (!title.trim() || !contentText.trim()) {
      setError("Please provide a title and questions or topic material.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await createSession({
        mode,
        title,
        content_text: contentText,
        question_source: mode === "school" ? "fixed" : "generated",
      });
      router.push(`/session/${res.session_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to initialize live session.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 py-4">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-primary-400" />
          <span>Real-Time Voice AI Interview & Viva Simulator</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Master your Viva with a <span className="bg-gradient-to-r from-primary-400 via-accent-cyan to-emerald-400 bg-clip-text text-transparent">Live Spoken Examiner</span>
        </h1>
        <p className="text-gray-400 text-base sm:text-lg">
          Upload your questions or syllabus, speak your answers aloud in real time, and receive instant rubric scoring and detailed revision plans.
        </p>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {/* School Viva */}
        <button
          onClick={() => setPreset("school")}
          className={`text-left p-6 rounded-2xl transition-all relative overflow-hidden flex flex-col justify-between ${
            mode === "school"
              ? "glass-panel-glow ring-2 ring-primary-500/80 scale-[1.02]"
              : "glass-panel hover:border-white/20 opacity-80 hover:opacity-100"
          }`}
        >
          {mode === "school" && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-primary-500 text-white uppercase">
              Selected
            </div>
          )}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <School className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">School Viva (Fixed)</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Asks uploaded questions in order with a warm, friendly voice. Supports student voice doubts and generous pause timing.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-emerald-400 font-medium">
            <span>Basic Depth • Doubts Allowed</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* College Viva */}
        <button
          onClick={() => setPreset("college")}
          className={`text-left p-6 rounded-2xl transition-all relative overflow-hidden flex flex-col justify-between ${
            mode === "college"
              ? "glass-panel-glow ring-2 ring-primary-500/80 scale-[1.02]"
              : "glass-panel hover:border-white/20 opacity-80 hover:opacity-100"
          }`}
        >
          {mode === "college" && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-primary-500 text-white uppercase">
              Selected
            </div>
          )}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">College Viva</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Deeper syllabus probes. Probes &quot;why did you say this?&quot; and generates follow-ups to test conceptual depth.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-primary-400 font-medium">
            <span>Deep Follow-ups • Adaptive</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Interview Prep */}
        <button
          onClick={() => setPreset("interview")}
          className={`text-left p-6 rounded-2xl transition-all relative overflow-hidden flex flex-col justify-between ${
            mode === "interview"
              ? "glass-panel-glow ring-2 ring-primary-500/80 scale-[1.02]"
              : "glass-panel hover:border-white/20 opacity-80 hover:opacity-100"
          }`}
        >
          {mode === "interview" && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-primary-500 text-white uppercase">
              Selected
            </div>
          )}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-accent-amber/10 border border-accent-amber/20 flex items-center justify-center text-accent-amber">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Interview Prep</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Simulates technical & behavioral rounds with strict pacing, communication metrics, and filler word tracking.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-accent-amber font-medium">
            <span>Stricter • Pace & Clarity Scored</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Material Ingestion Card */}
      <div className="max-w-3xl mx-auto glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-bold text-white">Viva Content & Questions</h2>
          </div>

          {/* Input Method Toggle Tabs */}
          <div className="flex items-center bg-surfaceLight/80 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setInputTab("text")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                inputTab === "text"
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Paste Text / Q&A
            </button>
            <button
              onClick={() => setInputTab("pdf")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                inputTab === "pdf"
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Upload PDF</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Viva Title / Topic
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surfaceLight/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
              placeholder="e.g. CBSE Class 10 Science Chapter 6 Viva"
            />
          </div>

          {inputTab === "pdf" ? (
            <div className="space-y-4">
              {/* PDF Dropzone */}
              <div className="border-2 border-dashed border-white/15 hover:border-primary-500/50 rounded-2xl p-6 sm:p-8 text-center transition-colors relative bg-surfaceLight/20">
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Click to upload or drag & drop a PDF
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Upload textbook chapters, question bank PDFs, or syllabus documents (.pdf)
                    </p>
                  </div>
                </div>
              </div>

              {pdfParsing && (
                <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-primary-200">
                    Parsing PDF text, chunking & embedding into RAG vector store...
                  </span>
                </div>
              )}

              {pdfMetadata && (
                <div className="p-4 rounded-2xl bg-surfaceLight/70 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>PDF Parsed & Embedded Successfully</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setPdfMetadata(null);
                      }}
                      className="text-gray-400 hover:text-rose-400 text-xs flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/5">
                      <span className="text-gray-400 block text-[10px] uppercase">File Name</span>
                      <span className="text-white font-medium truncate block">{pdfMetadata.filename}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5">
                      <span className="text-gray-400 block text-[10px] uppercase">Pages Extracted</span>
                      <span className="text-white font-medium">{pdfMetadata.num_pages} Pages</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 col-span-2 sm:col-span-1">
                      <span className="text-gray-400 block text-[10px] uppercase">Questions Detected</span>
                      <span className="text-emerald-400 font-medium">{pdfMetadata.questions_detected} Questions</span>
                    </div>
                  </div>

                  {/* Extracted Text Preview Toggle */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">
                      Extracted Text Preview:
                    </label>
                    <textarea
                      rows={5}
                      value={contentText}
                      onChange={(e) => setContentText(e.target.value)}
                      className="w-full bg-surfaceLight/90 border border-white/10 rounded-xl p-3 text-xs text-gray-300 font-mono leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  {mode === "school" ? "Question List (Fixed Mode)" : "Syllabus / Topic / Questions"}
                </label>
                <span className="text-[11px] text-gray-500">Paste Q&A or textbook chapter text</span>
              </div>
              <textarea
                rows={8}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                className="w-full bg-surfaceLight/50 border border-white/10 rounded-xl p-4 text-xs sm:text-sm text-gray-200 focus:outline-none focus:border-primary-500 font-mono leading-relaxed transition-colors"
                placeholder="Paste your questions with optional answers here..."
              />
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary-400" />
                <span>Max 15-30 Mins</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-accent-cyan" />
                <span>Streaming Speech</span>
              </div>
            </div>

            <button
              onClick={handleStartViva}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 group transition-all disabled:opacity-50"
            >
              <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>{loading ? "Preparing Session..." : "Enter Live Viva Room"}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
