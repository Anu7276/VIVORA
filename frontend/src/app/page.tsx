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
  ChevronRight, 
  MessageSquare, 
  X,
  HelpCircle,
  Play
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [promptText, setPromptText] = useState("");
  const [mode, setMode] = useState<"interview" | "college" | "school">("interview");
  const [title, setTitle] = useState("System Design Mock Interview & Technical Viva");
  const [contentText, setContentText] = useState("System Architecture, Microservices, Load Balancers, Distributed Caching, Consensus, CAP Theorem");
  
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
    <div className="min-h-screen bg-[#090b10] text-[#e2e8f0] flex flex-col selection:bg-[#00ea64]/30 selection:text-[#00ea64]">
      
      {/* ── TOP NAVIGATION BAR ──────────────────────────────────────────────── */}
      <header className="h-16 border-b border-[#1f2232] bg-[#0d0f17]/90 backdrop-blur-md px-6 md:px-12 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#00ea64] flex items-center justify-center font-mono font-bold text-[#090b10] text-sm shadow-[0_0_12px_rgba(0,234,100,0.4)] group-hover:scale-105 transition-transform">
              V
            </div>
            <div className="flex flex-col">
              <span className="font-mono font-bold text-white text-base tracking-wider leading-none">
                VIVORA<span className="text-[#00ea64]">.AI</span>
              </span>
              <span className="text-[10px] font-mono text-[#64748b]">AI Viva & Interview Simulator</span>
            </div>
          </Link>
        </div>

        {/* Center Mode Badges */}
        <div className="hidden md:flex items-center bg-[#151724] p-1 rounded-xl border border-[#23273a] text-xs font-medium space-x-1">
          <button
            onClick={() => {
              setMode("interview");
              setTitle("System Design Mock Interview & Technical Viva");
              setContentText("System Architecture, Microservices, Load Balancer, Distributed Cache, Consensus");
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              mode === "interview"
                ? "bg-[#00ea64] text-[#090b10] font-bold shadow-[0_0_10px_rgba(0,234,100,0.3)]"
                : "text-[#94a3b8] hover:text-white"
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
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              mode === "college"
                ? "bg-[#00ea64] text-[#090b10] font-bold shadow-[0_0_10px_rgba(0,234,100,0.3)]"
                : "text-[#94a3b8] hover:text-white"
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
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              mode === "school"
                ? "bg-[#00ea64] text-[#090b10] font-bold shadow-[0_0_10px_rgba(0,234,100,0.3)]"
                : "text-[#94a3b8] hover:text-white"
            }`}
          >
            <School className="w-3.5 h-3.5" />
            <span>School Viva</span>
          </button>
        </div>

        {/* Right Nav Action */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-1.5 text-xs font-mono text-[#00ea64] bg-[#00ea64]/10 px-2.5 py-1 rounded-full border border-[#00ea64]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ea64] animate-ping" />
            <span>Webcam & Voice AI Active</span>
          </div>

          {user ? (
            <div className="flex items-center space-x-2.5">
              <span className="text-xs font-medium text-[#cbd5e1] hidden sm:inline">{user.name}</span>
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
              className="px-3.5 py-1.5 rounded-lg bg-[#191c2b] hover:bg-[#23273c] text-xs font-semibold text-white border border-[#2c3048] transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-10 relative overflow-hidden">
        
        {/* Ambient background glow elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-[#00ea64]/10 via-[#6366f1]/10 to-transparent blur-3xl pointer-events-none rounded-full" />

        <div className="w-full max-w-3xl flex flex-col items-center space-y-6 relative z-10">
          
          {/* Headline */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#161926] border border-[#262a3f] text-xs font-mono text-[#00ea64] mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#00ea64]" />
              <span>Next-Gen Voice AI Examiner</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white tracking-tight leading-tight">
              What do you want to prepare, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ea64] to-[#38bdf8]">{userName}</span>?
            </h1>
            <p className="text-sm md:text-base text-[#94a3b8] max-w-xl mx-auto leading-relaxed">
              Rehearse live technical system design interviews and oral defense vivas with an intelligent, voice-driven AI examiner and interactive whiteboard.
            </p>
          </div>

          {/* Elevated Central Console Card */}
          <div className="w-full bg-[#12141e]/90 border border-[#23273a] hover:border-[#00ea64]/50 rounded-2xl p-4 md:p-5 shadow-2xl backdrop-blur-xl transition-all focus-within:border-[#00ea64] focus-within:shadow-[0_0_30px_rgba(0,234,100,0.12)] space-y-3">
            
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter your interview topic, syllabus chapter, or specific technical questions (e.g. Design a distributed message queue like Kafka with partition replication and leader election)..."
              rows={3}
              className="w-full bg-transparent text-sm md:text-base text-[#f1f5f9] placeholder-[#64748b] resize-none focus:outline-none font-sans leading-relaxed"
            />

            {/* Bottom tools row */}
            <div className="flex items-center justify-between pt-3 border-t border-[#1e2233]">
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#181a27] hover:bg-[#202334] text-xs text-[#94a3b8] hover:text-white cursor-pointer border border-[#2b2f44] transition-all">
                  <UploadCloud className="w-3.5 h-3.5 text-[#00ea64]" />
                  <span>{pdfParsing ? "Parsing PDF..." : "Attach PDF"}</span>
                  <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                </label>

                {selectedFile && (
                  <span className="text-xs bg-[#00ea64]/10 text-[#00ea64] px-2.5 py-1 rounded-md font-mono truncate max-w-[180px] border border-[#00ea64]/30">
                    📄 {selectedFile.name}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleStartSession(promptText || title, promptText || contentText, mode)}
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-[#00ea64] hover:bg-[#10b981] text-[#090b10] font-mono font-bold text-xs flex items-center space-x-2 shadow-[0_0_16px_rgba(0,234,100,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[#090b10] border-t-transparent rounded-full animate-spin" />
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

          {/* Quick Preset Pills */}
          <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
            <span className="text-[#64748b] font-mono text-[11px] mr-1">Quick Presets:</span>
            <button
              onClick={() => {
                setMode("interview");
                setTitle("System Design: Distributed Cache & Redis");
                setContentText("Cache-Aside, Write-Through, Consistency, LRU Eviction, Redis Cluster Sharding");
                handleStartSession("System Design: Distributed Cache & Redis", "Cache-Aside, Write-Through, Consistency, LRU Eviction, Redis Cluster Sharding", "interview");
              }}
              className="px-3 py-1 rounded-lg bg-[#141622] hover:bg-[#1f2235] text-[#cbd5e1] border border-[#23273c] hover:border-[#00ea64] transition-all flex items-center space-x-1"
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
              className="px-3 py-1 rounded-lg bg-[#141622] hover:bg-[#1f2235] text-[#cbd5e1] border border-[#23273c] hover:border-[#00ea64] transition-all flex items-center space-x-1"
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
              className="px-3 py-1 rounded-lg bg-[#141622] hover:bg-[#1f2235] text-[#cbd5e1] border border-[#23273c] hover:border-[#00ea64] transition-all flex items-center space-x-1"
            >
              <span>🏫 Class 10 Biology Viva</span>
            </button>
          </div>

          {/* ── WORKSPACE ACTION CARDS GRID ───────────────────────────────────── */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-4">
            
            {/* Card 1: Live System Design Interview Room */}
            <div
              onClick={() => handleStartSession("System Design Mock Interview & Viva", contentText, "interview")}
              className="bg-[#12141e] hover:bg-[#171926] border border-[#23273a] hover:border-[#00ea64] rounded-2xl p-4 flex items-start justify-between cursor-pointer transition-all shadow-lg group"
            >
              <div className="flex items-start space-x-3">
                <div className="p-2.5 rounded-xl bg-[#00ea64]/10 text-[#00ea64] border border-[#00ea64]/20 group-hover:scale-105 transition-transform">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm group-hover:text-[#00ea64] transition-colors">
                    VIVORA Live Technical Interview
                  </h3>
                  <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
                    Interactive whiteboard canvas, real-time candidate webcam, and AI examiner speech stream.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#64748b] group-hover:text-[#00ea64] group-hover:translate-x-1 transition-all mt-1" />
            </div>

            {/* Card 2: University Viva Voce */}
            <div
              onClick={() => handleStartSession("University Oral Defense Viva", contentText, "college")}
              className="bg-[#12141e] hover:bg-[#171926] border border-[#23273a] hover:border-[#6366f1] rounded-2xl p-4 flex items-start justify-between cursor-pointer transition-all shadow-lg group"
            >
              <div className="flex items-start space-x-3">
                <div className="p-2.5 rounded-xl bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm group-hover:text-[#a5b4fc] transition-colors">
                    College Viva Voce
                  </h3>
                  <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
                    Rigorous conceptual interrogation with dynamic follow-ups on thesis and lab experiments.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#64748b] group-hover:text-[#6366f1] group-hover:translate-x-1 transition-all mt-1" />
            </div>
          </div>

          {error && (
            <div className="w-full p-3.5 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#f87171] text-xs text-center font-mono">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

