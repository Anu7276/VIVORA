"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  createSession, 
  uploadFileMaterial, 
  getCurrentUser, 
  getStoredUser, 
  getAuthToken, 
  clearAuthToken, 
  UserProfile 
} from "@/lib/api";
import Link from "next/link";
import { 
  Mic, 
  Video, 
  Sparkles, 
  ArrowRight, 
  Plus, 
  FileText, 
  UploadCloud, 
  LogOut, 
  CheckCircle2, 
  BookOpen, 
  Layers, 
  Cpu, 
  GraduationCap, 
  School, 
  Briefcase, 
  ShieldCheck, 
  MessageSquare, 
  HelpCircle,
  Play,
  Award,
  Zap,
  Clock,
  ChevronRight
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [promptText, setPromptText] = useState("");
  const [mode, setMode] = useState<"interview" | "college" | "school">("interview");
  const [title, setTitle] = useState("System Design Mock Interview & Technical Viva");
  const [contentText, setContentText] = useState("System Architecture, Microservices, Load Balancer, Distributed Caching, Consensus, CAP Theorem");
  
  // PDF Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user profile on mount
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
    }
    if (getAuthToken()) {
      getCurrentUser()
        .then((u) => setUser(u))
        .catch(() => setUser(null));
    }
  }, []);

  const handleStartSession = async (
    customTitle?: string,
    customContent?: string,
    customMode?: "interview" | "college" | "school"
  ) => {
    setError(null);
    setLoading(true);

    const token = getAuthToken();
    if (!token) {
      router.push("/login?redirect=/");
      return;
    }

    try {
      const sessionTitle = customTitle || title || promptText || "System Design Mock Interview";
      const sessionMode = customMode || mode;
      const finalContent = customContent || contentText || promptText || "General Engineering Viva";

      const res = await createSession({
        title: sessionTitle,
        mode: sessionMode,
        content_text: finalContent,
        document_id: uploadedDocumentId || undefined,
      });

      router.push(`/session/${res.session_id}`);
    } catch (err: any) {
      console.error("Session creation error:", err);
      setError(err.message || "Failed to initialize viva session. Please try again.");
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!getAuthToken()) {
      router.push("/login?redirect=/");
      return;
    }

    setSelectedFile(file);
    setPdfParsing(true);
    setError(null);

    try {
      const data = await uploadFileMaterial(file, title, mode === "school" ? "questions" : "syllabus");
      setUploadedDocumentId(data.document_id);
      if (data.extracted_text) {
        setContentText(data.extracted_text);
      }
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
      setPdfParsing(false);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to process PDF.");
      setPdfParsing(false);
    }
  };

  const userName = user?.name?.split(" ")[0] || "Candidate";

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#1e293b] flex flex-col antialiased">
      
      {/* ── TOP HEADER NAVIGATION (Professional Light Editorial Theme) ───────── */}
      <header className="h-16 border-b border-[#e2e8f0] bg-white/90 backdrop-blur-md px-6 md:px-12 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#0f766e] flex items-center justify-center font-mono font-bold text-white text-sm shadow-sm group-hover:scale-105 transition-transform">
              V
            </div>
            <div className="flex flex-col">
              <span className="font-mono font-bold text-[#0f172a] text-base tracking-wider leading-none">
                VIVORA<span className="text-[#0f766e]">.AI</span>
              </span>
              <span className="text-[10px] font-mono text-[#64748b]">AI Viva & Interview Simulator</span>
            </div>
          </Link>
        </div>

        {/* Center Mode Selector Pills */}
        <div className="hidden md:flex items-center bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0] text-xs font-medium space-x-1">
          <button
            onClick={() => {
              setMode("interview");
              setTitle("System Design Mock Interview & Technical Viva");
              setContentText("System Architecture, Microservices, Load Balancers, Distributed Caching, Consensus");
            }}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              mode === "interview"
                ? "bg-white text-[#0f766e] font-bold shadow-sm border border-[#cbd5e1]"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Tech Interview</span>
          </button>
          <button
            onClick={() => {
              setMode("college");
              setTitle("University Viva Voce: Distributed Systems");
              setContentText("PBFT, Raft Consensus, Byzantine Fault Tolerance, CAP Theorem");
            }}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              mode === "college"
                ? "bg-white text-[#0f766e] font-bold shadow-sm border border-[#cbd5e1]"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>College Viva</span>
          </button>
          <button
            onClick={() => {
              setMode("school");
              setTitle("Class 10 Biology: Life Processes Viva");
              setContentText("Q1: What is photosynthesis?\nAns: Process of converting light energy to chemical energy.\n\nQ2: What is hemoglobin?\nAns: Oxygen-carrying pigment in blood.");
            }}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              mode === "school"
                ? "bg-white text-[#0f766e] font-bold shadow-sm border border-[#cbd5e1]"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <School className="w-3.5 h-3.5" />
            <span>School Viva</span>
          </button>
        </div>

        {/* Right Nav Action */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-1.5 text-xs font-mono text-[#0f766e] bg-[#f0fdf4] px-3 py-1 rounded-full border border-[#bbf7d0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
            <span>Voice & Webcam Ready</span>
          </div>

          {user ? (
            <div className="flex items-center space-x-3">
              <span className="text-xs font-medium text-[#334155] hidden sm:inline">{user.name}</span>
              <button
                onClick={() => {
                  clearAuthToken();
                  setUser(null);
                }}
                className="text-xs font-mono text-[#ef4444] hover:underline"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-lg bg-[#0f766e] hover:bg-[#115e59] text-xs font-semibold text-white shadow-sm transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-4xl flex flex-col items-center space-y-8">
          
          {/* Top Badge & Headline */}
          <div className="text-center space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] text-xs font-mono font-medium text-[#0f766e]">
              <Sparkles className="w-3.5 h-3.5 text-[#10b981]" />
              <span>Real-Time Voice AI Examiner</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-[#0f172a] tracking-tight leading-tight">
              Master Your Oral Viva & Technical Interview
            </h1>

            <p className="text-sm md:text-base text-[#64748b] leading-relaxed">
              Rehearse live system design architecture interviews, university thesis defenses, and school oral drills with interactive whiteboard canvases and real-time AI examiners.
            </p>
          </div>

          {/* ── CENTRAL CONSOLE CARD ─────────────────────────────────────────── */}
          <div className="w-full bg-white border border-[#e2e8f0] rounded-2xl p-5 md:p-6 shadow-xl space-y-4 transition-all focus-within:border-[#0f766e] focus-within:ring-2 focus-within:ring-[#0f766e]/10">
            
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="What topic or syllabus would you like to prepare? (e.g. System Design: Scalable URL Shortener with Redis Cache, Distributed Rate Limiter, and Sharding)..."
              rows={3}
              className="w-full bg-transparent text-sm md:text-base text-[#1e293b] placeholder-[#94a3b8] resize-none focus:outline-none font-sans leading-relaxed"
            />

            {/* Bottom Tools & Start CTA */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#f1f5f9]">
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#f8fafc] hover:bg-[#f1f5f9] text-xs font-medium text-[#475569] hover:text-[#0f172a] cursor-pointer border border-[#e2e8f0] transition-all">
                  <UploadCloud className="w-3.5 h-3.5 text-[#0f766e]" />
                  <span>{pdfParsing ? "Parsing PDF..." : "Attach PDF / Notes"}</span>
                  <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                </label>

                {selectedFile && (
                  <span className="text-xs bg-[#f0fdf4] text-[#0f766e] px-2.5 py-1 rounded-md font-mono truncate max-w-[180px] border border-[#bbf7d0]">
                    📄 {selectedFile.name}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleStartSession(promptText || title, promptText || contentText, mode)}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white font-mono font-bold text-xs flex items-center space-x-2 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Initializing Room...</span>
                    </>
                  ) : (
                    <>
                      <span>Start Voice Viva</span>
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── 1-CLICK CURATED PRESET PILLS ─────────────────────────────────── */}
          <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
            <span className="text-[#64748b] font-mono text-[11px] mr-1">Popular Presets:</span>
            <button
              onClick={() => {
                setMode("interview");
                setTitle("System Design: Distributed Cache & Redis");
                setContentText("Cache-Aside, Write-Through, Consistency, LRU Eviction, Redis Cluster Sharding");
                handleStartSession("System Design: Distributed Cache & Redis", "Cache-Aside, Write-Through, Consistency, LRU Eviction, Redis Cluster Sharding", "interview");
              }}
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#e2e8f0] hover:border-[#0f766e] shadow-sm transition-all flex items-center space-x-1.5"
            >
              <span>💻 Distributed Cache Design</span>
            </button>
            <button
              onClick={() => {
                setMode("college");
                setTitle("Operating Systems: Virtual Memory & Page Faults");
                setContentText("Virtual Memory, Paging, Page Table, TLB, Page Fault Handler, Thrashing");
                handleStartSession("Operating Systems: Virtual Memory & Page Faults", "Virtual Memory, Paging, Page Table, TLB, Page Fault Handler, Thrashing", "college");
              }}
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#e2e8f0] hover:border-[#0f766e] shadow-sm transition-all flex items-center space-x-1.5"
            >
              <span>🎓 OS Virtual Memory Viva</span>
            </button>
            <button
              onClick={() => {
                setMode("school");
                setTitle("CBSE Class 10 Biology: Life Processes");
                setContentText("Photosynthesis, Respiration, Hemoglobin, Circulation, Excretion");
                handleStartSession("CBSE Class 10 Biology: Life Processes", "Photosynthesis, Respiration, Hemoglobin, Circulation, Excretion", "school");
              }}
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#e2e8f0] hover:border-[#0f766e] shadow-sm transition-all flex items-center space-x-1.5"
            >
              <span>🏫 Class 10 Biology Viva</span>
            </button>
          </div>

          {/* ── WORKSPACE PREVIEW CARDS ───────────────────────────────────────── */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            
            {/* Mode 1: Technical Architecture & System Design */}
            <div
              onClick={() => handleStartSession("System Design Mock Interview & Viva", contentText, "interview")}
              className="bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#0f766e] rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all shadow-sm hover:shadow-md group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] text-[#0f766e] flex items-center justify-center border border-[#bbf7d0]">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0f172a] text-sm group-hover:text-[#0f766e] transition-colors">
                    VIVORA Live Technical Interview
                  </h3>
                  <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                    Interactive whiteboard canvas, live candidate webcam stream, and real-time AI examiner speech.
                  </p>
                </div>
              </div>
              <div className="pt-4 flex items-center text-xs font-semibold text-[#0f766e] space-x-1">
                <span>Enter Studio</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Mode 2: University Oral Defense */}
            <div
              onClick={() => handleStartSession("University Oral Defense Viva", contentText, "college")}
              className="bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#4f46e5] rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all shadow-sm hover:shadow-md group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#eef2ff] text-[#4f46e5] flex items-center justify-center border border-[#c7d2fe]">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0f172a] text-sm group-hover:text-[#4f46e5] transition-colors">
                    University Oral Defense
                  </h3>
                  <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                    Deep conceptual interrogation ("why" and "how") with adaptive difficulty and thesis analysis.
                  </p>
                </div>
              </div>
              <div className="pt-4 flex items-center text-xs font-semibold text-[#4f46e5] space-x-1">
                <span>Start Defense</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Mode 3: School Concepts Drill */}
            <div
              onClick={() => handleStartSession("School Chapter Concepts Viva", undefined, "school")}
              className="bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#0284c7] rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all shadow-sm hover:shadow-md group"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#f0f9ff] text-[#0284c7] flex items-center justify-center border border-[#bae6fd]">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0f172a] text-sm group-hover:text-[#0284c7] transition-colors">
                    School Chapter Drill
                  </h3>
                  <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                    Sequential question progression, voice doubt clarification, and generous thinking pauses.
                  </p>
                </div>
              </div>
              <div className="pt-4 flex items-center text-xs font-semibold text-[#0284c7] space-x-1">
                <span>Start Practice</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {error && (
            <div className="w-full p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center font-mono">
              {error}
            </div>
          )}
        </div>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#e2e8f0] bg-white py-6 px-6 text-center text-xs text-[#64748b]">
        <p>© 2026 VIVORA AI. Intelligent Viva & Technical Interview Simulator. Audio processed in memory only — no audio is stored.</p>
      </footer>
    </div>
  );
}
