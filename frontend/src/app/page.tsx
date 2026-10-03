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
  Home as HomeIcon,
  BookOpen, 
  MessageSquare, 
  Calendar, 
  Settings, 
  HelpCircle, 
  Plus, 
  Sparkles, 
  Mic, 
  ArrowUp, 
  Layers, 
  Bookmark, 
  FileText, 
  Table, 
  X, 
  CheckCircle2, 
  UploadCloud, 
  LogOut, 
  ClipboardCheck, 
  ChevronRight,
  School,
  GraduationCap,
  Briefcase,
  Monitor,
  Video,
  ArrowRight
} from "lucide-react";

interface QAPair {
  question: string;
  answer: string;
}

const PRESET_SCHOOL_SETS: Record<string, { title: string; pairs: QAPair[] }> = {
  biology: {
    title: "CBSE Class 10 Biology: Life Processes Viva",
    pairs: [
      {
        question: "What is photosynthesis and in which cell organelle does it take place?",
        answer: "Photosynthesis is the process by which green plants synthesize glucose using sunlight, water, and carbon dioxide. It takes place inside chloroplasts containing chlorophyll."
      },
      {
        question: "Why do herbivores have a longer small intestine than carnivores?",
        answer: "Herbivores eat plant matter and cellulose, which takes a longer time to digest, hence requiring a longer small intestine. Carnivores eat meat which is easier to digest."
      },
      {
        question: "What is the role of hemoglobin in human respiration?",
        answer: "Hemoglobin is a respiratory pigment in red blood cells that has high affinity for oxygen, transporting it from the lungs to tissues throughout the body."
      }
    ]
  },
  physics: {
    title: "CBSE Class 9 Physics: Force & Laws of Motion",
    pairs: [
      {
        question: "State Newton's First Law of Motion and give a daily life example.",
        answer: "An object continues in its state of rest or uniform motion in a straight line unless acted upon by an external unbalanced force. For example, passengers lean backward when a bus starts suddenly."
      },
      {
        question: "Define momentum and state its SI unit.",
        answer: "Momentum is the product of mass and velocity of an object (p = mv). Its SI unit is kilogram meter per second (kg·m/s)."
      },
      {
        question: "Why does a cricket player pull his hands backward while catching a ball?",
        answer: "Pulling hands back increases the time taken to stop the ball, which decreases the rate of change of momentum and thus reduces the impact force on the hands."
      }
    ]
  }
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [promptText, setPromptText] = useState("");
  const [activeTab, setActiveTab] = useState<"learn" | "viva_modal" | "pdf_modal">("learn");

  // Mode and session builder states
  const [mode, setMode] = useState<"school" | "college" | "interview">("interview");
  const [title, setTitle] = useState("System Design Mock Interview & Technical Viva");
  const [contentText, setContentText] = useState("System Architecture, Load Balancer, Caching, Sharding, Microservices, CAP Theorem");
  const [qaPairs, setQaPairs] = useState<QAPair[]>(PRESET_SCHOOL_SETS.biology.pairs);
  const [language, setLanguage] = useState("en-IN");
  
  // PDF upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSurvey, setShowSurvey] = useState(true);

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

  const handleQuickPill = (topic: string, modeType: "school" | "college" | "interview") => {
    setMode(modeType);
    setPromptText(topic);
    setTitle(topic);
    if (modeType === "interview") {
      setContentText("Distributed Consensus, PBFT, Raft, Scalable Systems, Latency Optimization");
    }
  };

  const handleStartSession = async (customTitle?: string, customContent?: string, customMode?: "school" | "college" | "interview") => {
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
      let finalContent = customContent || contentText || promptText;

      if (sessionMode === "school" && qaPairs.length > 0 && !customContent) {
        finalContent = qaPairs
          .filter((p) => p.question.trim().length > 0)
          .map((p, idx) => `Q${idx + 1}: ${p.question.trim()}\nAns: ${p.answer.trim()}`)
          .join("\n\n");
      }

      const res = await createSession({
        title: sessionTitle,
        mode: sessionMode,
        content_text: finalContent,
        language: language,
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

  const userName = user?.name?.split(" ")[0] || "Pramila";

  return (
    <div className="flex h-screen w-screen bg-[#faf9f6] text-[#1f2937] font-sans antialiased overflow-hidden">
      
      {/* ── LEFT SLIM NAVIGATION RAIL (Clean Minimalist Design) ───────────────── */}
      <nav className="w-16 md:w-18 bg-[#faf9f6] border-r border-[#e8e6df] flex flex-col items-center justify-between py-6 z-20 shrink-0">
        <div className="flex flex-col items-center space-y-7">
          {/* Logo / Monogram */}
          <div className="w-9 h-9 rounded-xl bg-[#4a7c59] text-white flex items-center justify-center font-serif font-bold text-lg shadow-sm hover:scale-105 transition-transform cursor-pointer">
            V
          </div>

          {/* Navigation Icon Links */}
          <div className="flex flex-col items-center space-y-4 text-[#6b7280]">
            <button
              onClick={() => setActiveTab("learn")}
              className="p-2.5 rounded-xl bg-[#f0eee6] text-[#2d5a3f] hover:text-[#2d5a3f] transition-all"
              title="Home"
            >
              <HomeIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleQuickPill("CBSE Class 10 Biology Viva", "school")}
              className="p-2.5 rounded-xl hover:bg-[#f0eee6] hover:text-[#1f2937] transition-all"
              title="Study Materials"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleStartSession("System Design Mock Interview", undefined, "interview")}
              className="p-2.5 rounded-xl hover:bg-[#f0eee6] hover:text-[#1f2937] transition-all"
              title="Live Voice Interview"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button
              className="p-2.5 rounded-xl hover:bg-[#f0eee6] hover:text-[#1f2937] transition-all"
              title="Schedule / Calendar"
            >
              <Calendar className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Rail: Settings & Profile Avatar */}
        <div className="flex flex-col items-center space-y-4">
          {user ? (
            <button
              onClick={() => {
                clearAuthToken();
                setUser(null);
              }}
              title="Logout"
              className="text-[#9ca3af] hover:text-[#ef4444] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <Link
              href="/login"
              className="text-xs font-medium text-[#4a7c59] hover:underline"
            >
              Login
            </Link>
          )}

          {/* User Botanical Avatar */}
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#4a7c59]/40 shadow-sm cursor-pointer hover:ring-2 hover:ring-[#4a7c59] transition-all">
            <img
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop"
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-24 py-12 flex flex-col items-center relative">
        <div className="w-full max-w-2xl lg:max-w-3xl flex flex-col items-center space-y-8 my-auto">
          
          {/* Main Literary Serif Heading (Matching Image 1) */}
          <h1 className="text-3xl md:text-4xl lg:text-[42px] font-serif font-normal text-[#1e293b] text-center tracking-tight">
            What do you want to learn, {userName}?
          </h1>

          {/* Elevated Rounded Prompt Console Card */}
          <div className="w-full bg-white rounded-2xl border border-[#e5e0d4] shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-4 flex flex-col space-y-3 transition-all focus-within:border-[#4a7c59] focus-within:shadow-[0_8px_30px_rgba(74,124,89,0.08)]">
            
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="I want to study for math, biology viva, or system design interview..."
              rows={3}
              className="w-full bg-transparent text-base md:text-lg text-[#1f2937] placeholder-[#9ca3af] resize-none focus:outline-none font-sans leading-relaxed"
            />

            {/* Bottom Inner Tools: Attachment + Mic + Submit Arrow Button */}
            <div className="flex items-center justify-between pt-2 border-t border-[#f3f1ea]">
              <div className="flex items-center space-x-2">
                <label className="p-2 rounded-full hover:bg-[#f4f2eb] text-[#6b7280] hover:text-[#1f2937] cursor-pointer transition-colors">
                  <Plus className="w-5 h-5" />
                  <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                </label>

                {selectedFile && (
                  <span className="text-xs bg-[#eef2ed] text-[#345d41] px-2.5 py-1 rounded-full font-medium truncate max-w-[200px]">
                    📄 {selectedFile.name}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleStartSession(promptText || "Voice Viva Practice", promptText, "interview")}
                  className="p-2 rounded-full hover:bg-[#f4f2eb] text-[#6b7280] hover:text-[#4a7c59] transition-colors"
                  title="Voice Mode"
                >
                  <Mic className="w-5 h-5" />
                </button>

                <button
                  onClick={() => handleStartSession(promptText || "System Design Mock Interview", promptText, mode)}
                  disabled={loading}
                  className="w-8 h-8 rounded-full bg-[#9ca3af] hover:bg-[#4a7c59] text-white flex items-center justify-center transition-all shadow-sm hover:scale-105 disabled:opacity-50"
                  title="Submit / Start"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Micro Toolbar: "Type / to use commands" */}
          <div className="w-full flex flex-col space-y-3">
            <div className="bg-[#f0ece1]/70 border border-[#e5e0d4] rounded-xl px-4 py-2 flex items-center justify-between text-xs text-[#6b7280]">
              <span className="font-medium text-[#4b5563]">Type / to use commands</span>
              <div className="flex items-center space-x-2.5 text-[#9ca3af]">
                <BookOpen className="w-3.5 h-3.5 hover:text-[#1f2937] cursor-pointer" />
                <Layers className="w-3.5 h-3.5 hover:text-[#1f2937] cursor-pointer" />
                <Bookmark className="w-3.5 h-3.5 hover:text-[#1f2937] cursor-pointer" />
                <FileText className="w-3.5 h-3.5 hover:text-[#1f2937] cursor-pointer" />
                <Table className="w-3.5 h-3.5 hover:text-[#1f2937] cursor-pointer" />
                <X className="w-3.5 h-3.5 hover:text-[#1f2937] cursor-pointer" />
              </div>
            </div>

            {/* Quick Action Pill Buttons (Matching Reference Image 1) */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => handleQuickPill("CBSE Class 10 Biology: Life Processes Quiz", "school")}
                className="px-4 py-1.5 rounded-full bg-white border border-[#e5e0d4] hover:border-[#4a7c59] hover:bg-[#f7f5f0] text-xs font-medium text-[#374151] flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <span>❓ Quiz me</span>
              </button>
              <button
                onClick={() => handleQuickPill("Analyze my Class Notes on Operating Systems", "college")}
                className="px-4 py-1.5 rounded-full bg-white border border-[#e5e0d4] hover:border-[#4a7c59] hover:bg-[#f7f5f0] text-xs font-medium text-[#374151] flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <span>🔍 Analyze my notes</span>
              </button>
              <button
                onClick={() => handleQuickPill("System Design Mock Interview (Live Whiteboard)", "interview")}
                className="px-4 py-1.5 rounded-full bg-[#4a7c59] hover:bg-[#3d6849] text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <span>🎙️ Live System Design Interview</span>
              </button>
              <button
                onClick={() => handleQuickPill("Distributed Systems & PBFT Viva", "college")}
                className="px-4 py-1.5 rounded-full bg-white border border-[#e5e0d4] hover:border-[#4a7c59] hover:bg-[#f7f5f0] text-xs font-medium text-[#374151] flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <span>... More</span>
              </button>
            </div>
          </div>

          {/* ── GET STARTED SECTION (Matching Reference Image 1) ──────────────── */}
          <div className="w-full space-y-3 pt-6">
            <div className="flex items-center space-x-2 text-xs text-[#6b7280]">
              <span className="font-semibold uppercase tracking-wider text-[#374151]">Get started</span>
              <span className="px-1.5 py-0.2 rounded bg-[#eef2ed] text-[#345d41] font-mono text-[10px] font-bold">
                New
              </span>
            </div>

            {/* List Action Cards */}
            <div className="space-y-2.5">
              
              {/* Card 1: Live System Design Interview with Video & Whiteboard */}
              <div
                onClick={() => handleStartSession("System Design Mock Interview", "High Level Design, Microservices, Load Balancer, Scalable Architecture", "interview")}
                className="w-full bg-white hover:bg-[#fbf9f4] border border-[#e5e0d4] hover:border-[#4a7c59] rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-[#00ea64]/15 text-[#00ea64] flex items-center justify-center">
                    <Video className="w-4 h-4 text-[#2d5a3f]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1f2937] group-hover:text-[#2d5a3f]">
                      Start System Design Mock Interview (Live Whiteboard & Webcam)
                    </h4>
                    <p className="text-xs text-[#6b7280]">
                      HackerRank style live viva with interactive canvas, AI examiner and candidate camera.
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#9ca3af] group-hover:text-[#2d5a3f] transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Card 2: Create a study space */}
              <div
                onClick={() => handleStartSession("CBSE Class 10 Biology Viva", undefined, "school")}
                className="w-full bg-white hover:bg-[#fbf9f4] border border-[#e5e0d4] rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm"
              >
                <span className="text-sm font-medium text-[#374151]">Create a school / college viva class</span>
                <Plus className="w-4 h-4 text-[#9ca3af]" />
              </div>

              {/* Card 3: Connect to Canvas */}
              <div className="w-full bg-white hover:bg-[#fbf9f4] border border-[#e5e0d4] rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm">
                <span className="text-sm font-medium text-[#374151]">Connect to Canvas / LMS</span>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-red-400 border-dashed" />
              </div>

              {/* Card 4: Set up Voice Viva with Vivora */}
              <div
                onClick={() => handleStartSession("General Engineering Viva", undefined, "college")}
                className="w-full bg-white hover:bg-[#fbf9f4] border border-[#e5e0d4] rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm"
              >
                <span className="text-sm font-medium text-[#374151]">Set up real-time voice viva with Vivora</span>
                <ChevronRight className="w-4 h-4 text-[#9ca3af]" />
              </div>
            </div>
          </div>

          {error && (
            <div className="w-full p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center">
              {error}
            </div>
          )}
        </div>

        {/* ── FLOATING SURVEY CARD (Matching Bottom Right of Image 1) ─────────── */}
        {showSurvey && (
          <div className="fixed bottom-6 right-6 z-30 bg-white border border-[#e5e0d4] rounded-2xl p-4 shadow-xl max-w-xs space-y-3 animate-fadeIn">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-[#f0eee6] text-[#4a7c59]">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1f2937]">Help us by taking a quick survey</h4>
                  <p className="text-[11px] text-[#6b7280]">Don't worry, it takes less than a minute.</p>
                </div>
              </div>
              <button onClick={() => setShowSurvey(false)} className="text-[#9ca3af] hover:text-[#1f2937]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => {
                alert("Thank you for your feedback!");
                setShowSurvey(false);
              }}
              className="w-full py-2 rounded-xl bg-[#6b8e76] hover:bg-[#577761] text-white text-xs font-semibold font-sans transition-all shadow-sm"
            >
              Take Survey
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
