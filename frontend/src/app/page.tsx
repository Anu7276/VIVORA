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
  ArrowRight, 
  Mic, 
  UploadCloud, 
  Play, 
  Sparkles, 
  Volume2, 
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  Menu, 
  X, 
  Layers, 
  Activity, 
  Award, 
  ShieldCheck, 
  FileText, 
  Compass, 
  Cpu, 
  GraduationCap, 
  Briefcase,
  MessageSquare, 
  PhoneCall, 
  Check, 
  CornerDownRight,
  TrendingUp,
  BrainCircuit,
  Radio
} from "lucide-react";

export default function VIVORAEditorialHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Interactive Practice Drawer / Modal
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [selectedMode, setSelectedMode] = useState<"interview" | "college" | "school">("interview");
  const [title, setTitle] = useState("System Design & Technical Architecture Viva");
  const [contentText, setContentText] = useState("System Architecture, Microservices, Load Balancers, Distributed Caching, Consensus, CAP Theorem");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scroll listener for subtle nature parallax
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      const sessionMode = customMode || selectedMode;
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
      const data = await uploadFileMaterial(file, title, selectedMode === "school" ? "questions" : "syllabus");
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

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1a1b1e] selection:bg-[#2d4a3e]/15 selection:text-[#2d4a3e] relative font-sans">
      
      {/* ── MINIMAL FLOATING HEADER ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#FAF9F5]/85 backdrop-blur-md border-b border-[#EBE7DD]/80 transition-all">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Left: Brand Logo & Emblem */}
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-5 h-5 rounded-full bg-[#2d4a3e] flex items-center justify-center text-white text-[10px] font-mono group-hover:scale-105 transition-transform shadow-xs">
              ✦
            </div>
            <span className="font-serif italic text-xl text-[#1a1b1e] tracking-tight font-medium">
              vivora
            </span>
          </Link>

          {/* Center Navigation (Desktop) */}
          <nav className="hidden md:flex items-center space-x-8 text-[13px] font-medium text-[#5c5f66]">
            <a href="#product" className="hover:text-[#1a1b1e] transition-colors">Product</a>
            <a href="#how-it-works" className="hover:text-[#1a1b1e] transition-colors">How it works</a>
            <a href="#use-cases" className="hover:text-[#1a1b1e] transition-colors">For Students</a>
            <a href="#insights" className="hover:text-[#1a1b1e] transition-colors">Insights</a>
          </nav>

          {/* Right Action: Login / Get Started */}
          <div className="hidden md:flex items-center space-x-5 text-[13px]">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-[#5c5f66] font-medium">{user.name}</span>
                <button
                  onClick={() => {
                    clearAuthToken();
                    setUser(null);
                  }}
                  className="text-xs text-[#8c9099] hover:text-[#1a1b1e] transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link href="/login" className="text-[#5c5f66] hover:text-[#1a1b1e] font-medium transition-colors">
                Login
              </Link>
            )}

            <button
              onClick={() => setShowSetupModal(true)}
              className="px-4 py-1.5 rounded-full bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white text-[13px] font-medium transition-all shadow-xs flex items-center space-x-1 hover:space-x-1.5"
            >
              <span>Get started</span>
              <span className="text-xs">→</span>
            </button>
          </div>

          {/* Mobile Hamburger Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#1a1b1e]"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#FAF9F5] border-b border-[#EBE7DD] px-6 py-4 space-y-3 animate-fadeIn text-sm">
            <a href="#product" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#5c5f66]">Product</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#5c5f66]">How it works</a>
            <a href="#use-cases" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#5c5f66]">For Students</a>
            <a href="#insights" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-[#5c5f66]">Insights</a>
            <div className="pt-2 border-t border-[#EBE7DD] flex items-center justify-between">
              <Link href="/login" className="text-[#5c5f66] font-medium">Login</Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowSetupModal(true);
                }}
                className="px-4 py-1.5 rounded-full bg-[#1a1b1e] text-white text-xs font-medium"
              >
                Get started →
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <section className="pt-32 md:pt-40 pb-16 md:pb-24 px-6 relative overflow-hidden">
        
        {/* Atmospheric Nature Memory Fragment 01 (Misty Forest & Mountain Ridge) */}
        <div 
          className="nature-memory-layer nature-mask-organic-hero animate-nature-drift inset-0 -top-28 h-[850px] w-full"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600&auto=format&fit=crop')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 35%',
            opacity: 0.16,
            transform: `translate3d(0, ${scrollY * 0.08}px, 0)`,
          }}
        />
        
        {/* Soft atmospheric ivory wash & gradient aura */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/40 via-transparent to-[#FAF9F5] pointer-events-none z-0" />
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[700px] md:w-[1000px] h-[450px] bg-gradient-to-b from-[#e8e4d3]/30 via-[#e0ddd0]/15 to-transparent blur-3xl pointer-events-none rounded-full z-0" />

        <div className="max-w-4xl mx-auto flex flex-col items-center text-center space-y-6 relative z-10">
          
          {/* Announcement pill */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#F2EFE6]/90 backdrop-blur-xs border border-[#E5E0D4] text-[12px] font-medium text-[#4a5043] shadow-2xs">
            <span>✦</span>
            <span>Meet Vivora AI</span>
          </div>

          {/* Editorial Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-serif font-normal text-[#1a1b1e] tracking-tight leading-[1.08] max-w-3xl">
            Study smarter.<br />
            Speak better.<br />
            <span className="italic text-[#2d4a3e]">Perform with confidence.</span>
          </h1>

          {/* Supporting Copy */}
          <p className="text-base sm:text-lg text-[#5c5f66] max-w-xl font-normal leading-relaxed pt-1">
            Your AI workspace for studying, viva preparation, technical interviews, and real-world communication.
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-6 py-3 rounded-full bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white text-[14px] font-medium shadow-sm hover:shadow-md transition-all flex items-center space-x-2 group"
            >
              <span>Try Vivora free</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </button>

            <a
              href="#product"
              className="px-5 py-3 rounded-full bg-white hover:bg-[#F2EFE6] text-[#33373b] border border-[#E5E0D4] text-[14px] font-medium transition-all shadow-2xs"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* ── HERO PRODUCT VISUAL (ELEVATED REALISTIC WORKSPACE) ─────────────── */}
        <div id="product" className="max-w-5xl mx-auto mt-14 md:mt-20 relative z-10">
          
          {/* Main Floating Product Deck */}
          <div className="bg-white rounded-3xl border border-[#E5E0D4] shadow-[0_20px_50px_-10px_rgba(40,45,35,0.08),0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden transition-all">
            
            {/* Window Titlebar */}
            <div className="h-11 bg-[#FAF9F5] border-b border-[#EBE7DD] px-4 flex items-center justify-between text-xs text-[#8c9099]">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e5e0d4]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e5e0d4]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e5e0d4]" />
              </div>
              <div className="font-mono text-[11px] text-[#5c5f66] flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2d4a3e]" />
                <span>Distributed Systems • Oral Defense Stage</span>
              </div>
              <span className="text-[11px] font-mono text-[#8c9099]">Session #8921</span>
            </div>

            {/* Product Interior Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
              
              {/* Left Subsystem Pane (4 cols) */}
              <div className="lg:col-span-4 bg-[#FAF9F5]/70 border-r border-[#EBE7DD] p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  
                  {/* Active Document Card */}
                  <div className="bg-white border border-[#E5E0D4] p-3.5 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#8c9099]">
                      <span>INGESTED MATERIAL</span>
                      <span className="text-[#2d4a3e]">RAG Isolated</span>
                    </div>
                    <h4 className="text-xs font-semibold text-[#1a1b1e]">
                      MIT 6.824: Distributed Systems (Lecture 06 - Raft & PBFT)
                    </h4>
                    <p className="text-[11px] text-[#71767f]">14 sections parsed • 3 key invariants tagged</p>
                  </div>

                  {/* Examiner Card */}
                  <div className="bg-white border border-[#E5E0D4] p-3.5 rounded-xl space-y-2 shadow-2xs">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-[#2d4a3e] text-white flex items-center justify-center text-[10px] font-mono">
                        AI
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1a1b1e]">Dr. Aris (Examiner)</div>
                        <div className="text-[10px] text-[#71767f]">Low-Latency Neural Voice</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 pt-1">
                      <div className="w-1 h-3 rounded-full bg-[#2d4a3e] animate-pulse" />
                      <div className="w-1 h-5 rounded-full bg-[#2d4a3e] animate-pulse" />
                      <div className="w-1 h-2.5 rounded-full bg-[#2d4a3e] animate-pulse" />
                      <div className="w-1 h-4 rounded-full bg-[#2d4a3e] animate-pulse" />
                      <span className="text-[11px] font-mono text-[#2d4a3e] ml-2">Audio Synthesizer Active</span>
                    </div>
                  </div>
                </div>

                {/* Real-time readiness gauge */}
                <div className="bg-white border border-[#E5E0D4] p-3.5 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#5c5f66]">Oral Defense Readiness</span>
                    <span className="font-mono font-bold text-[#2d4a3e]">94%</span>
                  </div>
                  <div className="w-full bg-[#FAF9F5] h-1.5 rounded-full overflow-hidden border border-[#EBE7DD]">
                    <div className="bg-[#2d4a3e] h-full w-[94%]" />
                  </div>
                </div>
              </div>

              {/* Right Stage: Interactive Conversation (8 cols) */}
              <div className="lg:col-span-8 p-6 md:p-8 flex flex-col justify-between bg-white space-y-6">
                
                {/* Active Question Dialogue */}
                <div className="space-y-4">
                  
                  {/* AI Examiner Prompt */}
                  <div className="flex items-start space-x-3.5">
                    <div className="w-7 h-7 rounded-full bg-[#F2EFE6] border border-[#E5E0D4] flex items-center justify-center text-[#2d4a3e] font-serif italic text-xs shrink-0 mt-0.5">
                      Q3
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="text-[11px] font-mono text-[#8c9099] uppercase tracking-wider">AI Examiner Prompt</div>
                      <p className="text-sm md:text-base font-serif text-[#1a1b1e] leading-relaxed">
                        "Explain how Practical Byzantine Fault Tolerance (PBFT) guarantees safety during a view change when the primary node is suspected of being faulty."
                      </p>
                    </div>
                  </div>

                  {/* Candidate Speech Transcript */}
                  <div className="ml-10 bg-[#FAF9F5] border border-[#E5E0D4] rounded-2xl p-4 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#71767f]">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2d4a3e]" />
                        <span>Candidate Speech Stream</span>
                      </span>
                      <span>142 WPM • Clarity: 96%</span>
                    </div>
                    <p className="text-xs md:text-sm text-[#2c3038] leading-relaxed font-sans">
                      "In PBFT, safety during view changes is maintained because any prepared certificate requires <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#EBE7DD]">2f + 1</span> matching prepare messages. Since any two quorums intersect in at least one non-faulty replica..."
                    </p>
                  </div>

                  {/* AI Adaptive Follow-up Probe */}
                  <div className="flex items-start space-x-3.5 pt-2">
                    <div className="w-7 h-7 rounded-full bg-[#2d4a3e]/10 text-[#2d4a3e] flex items-center justify-center font-mono text-xs shrink-0 mt-0.5">
                      ↳
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="text-[11px] font-mono text-[#2d4a3e] uppercase font-semibold">Adaptive Follow-up</div>
                      <p className="text-xs md:text-sm text-[#3a3f47] leading-relaxed">
                        "Good. Why is <span className="font-mono text-xs">3f + 1</span> the strict lower bound for total nodes rather than <span className="font-mono text-xs">2f + 1</span>?"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Interactive Voice Dock inside preview */}
                <div className="pt-4 border-t border-[#EBE7DD] flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#2d4a3e] text-white flex items-center justify-center shadow-xs">
                      <Mic className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono text-[#5c5f66]">Voice Channel Transmitting</span>
                  </div>

                  <button
                    onClick={() => setShowSetupModal(true)}
                    className="text-xs font-semibold text-[#2d4a3e] hover:underline flex items-center space-x-1"
                  >
                    <span>Launch Live Simulator</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: PRODUCT VALUE ────────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 border-t border-[#EBE7DD] bg-[#FAF9F5] relative overflow-hidden">
        
        {/* Atmospheric Nature Memory Fragment 02 (Sunlight Through Woodland Foliage) */}
        <div 
          className="nature-memory-layer nature-mask-organic-right animate-nature-drift-reverse -right-24 top-10 w-[700px] h-[750px]"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=1400&auto=format&fit=crop')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center right',
            opacity: 0.14,
            transform: `translate3d(0, ${(scrollY - 400) * 0.05}px, 0)`,
          }}
        />

        <div className="max-w-5xl mx-auto space-y-16 relative z-10">
          
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-mono text-[#2d4a3e] uppercase tracking-wider font-semibold">
              The Learning Loop
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#1a1b1e] tracking-tight leading-tight">
              One workspace for the way you actually study.
            </h2>
            <p className="text-base text-[#5c5f66] leading-relaxed">
              VIVORA brings preparation, practice, feedback, and confidence into one intelligent workspace.
            </p>
          </div>

          {/* 3 Step Editorial Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* 01 - Learn */}
            <div className="bg-white border border-[#E5E0D4] rounded-3xl p-7 space-y-6 flex flex-col justify-between surface-hover shadow-2xs">
              <div className="space-y-4">
                <span className="font-mono text-xs text-[#8c9099] font-semibold">01 — LEARN</span>
                <h3 className="text-2xl font-serif font-normal text-[#1a1b1e] leading-snug">
                  Turn your material into understanding.
                </h3>
                <p className="text-xs text-[#5c5f66] leading-relaxed">
                  Upload lecture slides, PDF textbooks, research papers, or syllabus outlines. VIVORA extracts concepts and segments them for oral mastery.
                </p>
              </div>

              <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-[#EBE7DD] shadow-2xs space-y-2">
                <div className="flex items-center space-x-2 text-xs font-medium text-[#1a1b1e]">
                  <FileText className="w-4 h-4 text-[#2d4a3e]" />
                  <span>Textbook Chapter 04.pdf</span>
                </div>
                <div className="text-[11px] text-[#71767f] font-mono">18 Core Concepts Extracted</div>
              </div>
            </div>

            {/* 02 - Practice */}
            <div className="bg-white border border-[#E5E0D4] rounded-3xl p-7 space-y-6 flex flex-col justify-between surface-hover shadow-2xs">
              <div className="space-y-4">
                <span className="font-mono text-xs text-[#2d4a3e] font-semibold">02 — PRACTICE</span>
                <h3 className="text-2xl font-serif font-normal text-[#1a1b1e] leading-snug">
                  Practice like someone is actually asking you.
                </h3>
                <p className="text-xs text-[#5c5f66] leading-relaxed">
                  Experience realistic voice viva examinations with adaptive probing, real-time interruptions, and follow-ups tailored to your explanations.
                </p>
              </div>

              <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-[#EBE7DD] shadow-2xs space-y-2">
                <div className="flex items-center space-x-2 text-xs font-medium text-[#1a1b1e]">
                  <Volume2 className="w-4 h-4 text-[#2d4a3e]" />
                  <span>Real-time Voice Examiner</span>
                </div>
                <div className="text-[11px] text-[#71767f] font-mono">Adaptive Conceptual Probing</div>
              </div>
            </div>

            {/* 03 - Improve */}
            <div className="bg-white border border-[#E5E0D4] rounded-3xl p-7 space-y-6 flex flex-col justify-between surface-hover shadow-2xs">
              <div className="space-y-4">
                <span className="font-mono text-xs text-[#8c9099] font-semibold">03 — IMPROVE</span>
                <h3 className="text-2xl font-serif font-normal text-[#1a1b1e] leading-snug">
                  Know exactly what to improve.
                </h3>
                <p className="text-xs text-[#5c5f66] leading-relaxed">
                  Receive instant multi-rubric assessments across correctness, depth, and speech clarity, alongside a prioritized revision plan.
                </p>
              </div>

              <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-[#EBE7DD] shadow-2xs space-y-2">
                <div className="flex items-center space-x-2 text-xs font-medium text-[#1a1b1e]">
                  <Award className="w-4 h-4 text-[#2d4a3e]" />
                  <span>Multi-Metric Scorecard</span>
                </div>
                <div className="text-[11px] text-[#71767f] font-mono">Prioritized Topic Action Plan</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: AI VIVA EXPERIENCE ────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD] relative overflow-hidden">
        
        {/* Atmospheric Nature Memory Fragment 03 (Misty Morning Alpine Lake & Mountain Silhouettes) */}
        <div 
          className="nature-memory-layer nature-mask-radial animate-nature-drift -left-28 top-1/2 -translate-y-1/2 w-[800px] h-[650px]"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1600&auto=format&fit=crop')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.15,
            transform: `translate3d(0, ${(scrollY - 1000) * 0.05}px, 0)`,
          }}
        />

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-mono text-[#2d4a3e] uppercase tracking-wider font-semibold">
              Real-time Voice Engine
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#1a1b1e] tracking-tight leading-tight">
              Not another chatbot.<br />
              <span className="italic text-[#2d4a3e]">A real conversation.</span>
            </h2>
            <p className="text-sm md:text-base text-[#5c5f66] leading-relaxed">
              VIVORA listens, asks follow-up questions, adapts to your answers, and helps you practice under real conversational pressure.
            </p>
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-6 py-2.5 rounded-full bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white text-xs font-semibold shadow-xs flex items-center space-x-2 transition-all"
            >
              <span>Start a Viva</span>
              <span>→</span>
            </button>
          </div>

          {/* Interactive Phone / Device Mockup */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-md bg-white rounded-3xl border border-[#E5E0D4] p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#EBE7DD] text-xs">
                <span className="font-mono text-[#8c9099]">LIVE AUDIO EXAM</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#f0fdf4] text-[#2d4a3e] font-mono text-[11px] font-bold">14ms Latency</span>
              </div>

              {/* Dialogue Transcript */}
              <div className="space-y-4 text-xs font-sans">
                <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#E5E0D4] space-y-1">
                  <div className="text-[10px] font-mono text-[#8c9099]">AI EXAMINER</div>
                  <p className="text-[#1a1b1e] font-medium leading-relaxed">
                    "Explain the fundamental difference between supervised and unsupervised machine learning."
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#cbd5e1] ml-4 space-y-1 shadow-2xs">
                  <div className="text-[10px] font-mono text-[#2d4a3e]">STUDENT (YOU)</div>
                  <p className="text-[#33373b] leading-relaxed">
                    "Supervised learning trains on labelled datasets with input-output pairs, whereas unsupervised learning discovers intrinsic patterns without ground-truth labels."
                  </p>
                </div>

                <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#E5E0D4] space-y-1">
                  <div className="text-[10px] font-mono text-[#8c9099]">AI FOLLOW-UP</div>
                  <p className="text-[#1a1b1e] font-medium leading-relaxed">
                    "Good. Now give me a practical real-world scenario where semi-supervised learning is strictly preferred."
                  </p>
                </div>
              </div>

              {/* Waveform Micro Visualizer */}
              <div className="pt-2 flex items-center justify-center space-x-1">
                {[4, 12, 8, 16, 22, 14, 18, 10, 6, 14, 20, 8, 4].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}px` }}
                    className="w-1 rounded-full bg-[#2d4a3e] opacity-80 animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: LIVES WHERE YOU STUDY ─────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 bg-white border-t border-[#EBE7DD]">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono text-[#2d4a3e] uppercase tracking-wider font-semibold">
              Anywhere Study Companion
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#1a1b1e] tracking-tight leading-tight">
              Your preparation doesn't have to stay in one tab.
            </h2>
            <p className="text-base text-[#5c5f66] leading-relaxed">
              Drill concepts on your phone, rehearse interview answers during walks, or review analytics between classes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-[#FAF9F5] border border-[#E5E0D4] p-6 rounded-2xl space-y-3">
              <span className="text-xs font-mono text-[#2d4a3e] font-bold">01 • DAILY DRILLS</span>
              <h4 className="text-base font-semibold text-[#1a1b1e]">Bite-sized Viva Questions</h4>
              <p className="text-xs text-[#5c5f66] leading-relaxed">
                Receive 2-minute quick-fire concept challenges on your phone to maintain recall before exam week.
              </p>
            </div>

            <div className="bg-[#FAF9F5] border border-[#E5E0D4] p-6 rounded-2xl space-y-3">
              <span className="text-xs font-mono text-[#2d4a3e] font-bold">02 • VOICE REHEARSAL</span>
              <h4 className="text-base font-semibold text-[#1a1b1e]">Hands-Free Oral Practice</h4>
              <p className="text-xs text-[#5c5f66] leading-relaxed">
                Answer questions out loud without touching your keyboard. The Web Speech engine transcribes seamlessly.
              </p>
            </div>

            <div className="bg-[#FAF9F5] border border-[#E5E0D4] p-6 rounded-2xl space-y-3">
              <span className="text-xs font-mono text-[#2d4a3e] font-bold">03 • WEAK TOPIC ALERTS</span>
              <h4 className="text-base font-semibold text-[#1a1b1e]">Smart Concept Spaced Recall</h4>
              <p className="text-xs text-[#5c5f66] leading-relaxed">
                VIVORA surfaces questions on topics where your depth or clarity scores were low during previous rounds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: PERFORMANCE & INSIGHTS ────────────────────────────────── */}
      <section id="insights" className="py-20 md:py-28 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD] relative overflow-hidden">
        
        {/* Atmospheric Nature Memory Fragment 04 (Soft Mountain Cloudscape & Ridges) */}
        <div 
          className="nature-memory-layer nature-mask-organic-left animate-nature-drift-reverse -left-20 bottom-0 w-[700px] h-[600px]"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1400&auto=format&fit=crop')`,
            backgroundSize: 'cover',
            backgroundPosition: 'left center',
            opacity: 0.12,
            transform: `translate3d(0, ${(scrollY - 2000) * 0.05}px, 0)`,
          }}
        />

        <div className="max-w-5xl mx-auto space-y-14 relative z-10">
          
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-mono text-[#2d4a3e] uppercase tracking-wider font-semibold">
              Granular Analytics
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#1a1b1e] tracking-tight leading-tight">
              From "I think I know it"<br />
              <span className="italic text-[#2d4a3e]">to "I can explain it."</span>
            </h2>
            <p className="text-base text-[#5c5f66] leading-relaxed">
              Understand where your verbal explanations falter and bridge gaps before stepping in front of professors or interview panels.
            </p>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E0D4] p-5 rounded-2xl shadow-2xs space-y-2">
              <div className="text-xs font-mono text-[#8c9099]">CONCEPT MASTERY</div>
              <div className="text-3xl font-serif font-bold text-[#1a1b1e]">94%</div>
              <p className="text-[11px] text-[#71767f]">Invariants & definitions verified</p>
            </div>

            <div className="bg-white border border-[#E5E0D4] p-5 rounded-2xl shadow-2xs space-y-2">
              <div className="text-xs font-mono text-[#8c9099]">VIVA READINESS</div>
              <div className="text-3xl font-serif font-bold text-[#2d4a3e]">High</div>
              <p className="text-[11px] text-[#71767f]">Confidence across 14 modules</p>
            </div>

            <div className="bg-white border border-[#E5E0D4] p-5 rounded-2xl shadow-2xs space-y-2">
              <div className="text-xs font-mono text-[#8c9099]">SPEAKING CLARITY</div>
              <div className="text-3xl font-serif font-bold text-[#1a1b1e]">91%</div>
              <p className="text-[11px] text-[#71767f]">Pacing (142 WPM) & minimal fillers</p>
            </div>

            <div className="bg-white border border-[#E5E0D4] p-5 rounded-2xl shadow-2xs space-y-2">
              <div className="text-xs font-mono text-[#8c9099]">PRACTICE STREAK</div>
              <div className="text-3xl font-serif font-bold text-[#2d4a3e]">6 Days</div>
              <p className="text-[11px] text-[#71767f]">Exam in 12 days</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: USE CASES ─────────────────────────────────────────────── */}
      <section id="use-cases" className="py-20 md:py-28 px-6 bg-white border-t border-[#EBE7DD]">
        <div className="max-w-5xl mx-auto space-y-14">
          
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-mono text-[#2d4a3e] uppercase tracking-wider font-semibold">
              Tailored Environments
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#1a1b1e] tracking-tight leading-tight">
              Built for every moment that makes you nervous.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1: College Viva */}
            <div
              onClick={() => {
                setSelectedMode("college");
                setTitle("University Viva Voce Defense");
                setShowSetupModal(true);
              }}
              className="bg-[#FAF9F5] border border-[#E5E0D4] hover:border-[#2d4a3e] p-6 rounded-2xl space-y-3 cursor-pointer surface-hover"
            >
              <div className="w-8 h-8 rounded-xl bg-[#2d4a3e]/10 text-[#2d4a3e] flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-[#1a1b1e]">College Viva</h4>
              <p className="text-xs text-[#5c5f66] leading-relaxed">
                Practice deep conceptual probing questions before your professor or oral defense committee asks them.
              </p>
            </div>

            {/* Card 2: Technical Interview */}
            <div
              onClick={() => {
                setSelectedMode("interview");
                setTitle("System Design Mock Interview & Technical Viva");
                setShowSetupModal(true);
              }}
              className="bg-[#FAF9F5] border border-[#E5E0D4] hover:border-[#2d4a3e] p-6 rounded-2xl space-y-3 cursor-pointer surface-hover"
            >
              <div className="w-8 h-8 rounded-xl bg-[#2d4a3e]/10 text-[#2d4a3e] flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-[#1a1b1e]">Technical Interview</h4>
              <p className="text-xs text-[#5c5f66] leading-relaxed">
                Simulate real system design and architecture interviews with an interactive whiteboard and candidate video PIP.
              </p>
            </div>

            {/* Card 3: Presentation */}
            <div
              onClick={() => {
                setSelectedMode("college");
                setTitle("Thesis Presentation Rehearsal");
                setShowSetupModal(true);
              }}
              className="bg-[#FAF9F5] border border-[#E5E0D4] hover:border-[#2d4a3e] p-6 rounded-2xl space-y-3 cursor-pointer surface-hover"
            >
              <div className="w-8 h-8 rounded-xl bg-[#2d4a3e]/10 text-[#2d4a3e] flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-[#1a1b1e]">Presentation & Seminars</h4>
              <p className="text-xs text-[#5c5f66] leading-relaxed">
                Practice explaining complex engineering concepts clearly, smoothly, and without verbal hesitation.
              </p>
            </div>

            {/* Card 4: Exam Preparation */}
            <div
              onClick={() => {
                setSelectedMode("school");
                setTitle("Syllabus Active Recall Drill");
                setShowSetupModal(true);
              }}
              className="bg-[#FAF9F5] border border-[#E5E0D4] hover:border-[#2d4a3e] p-6 rounded-2xl space-y-3 cursor-pointer surface-hover"
            >
              <div className="w-8 h-8 rounded-xl bg-[#2d4a3e]/10 text-[#2d4a3e] flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-[#1a1b1e]">Exam Preparation</h4>
              <p className="text-xs text-[#5c5f66] leading-relaxed">
                Turn your dense textbook chapters and lecture notes into active recall testing rounds.
              </p>
            </div>

            {/* Card 5: Placement Preparation */}
            <div
              onClick={() => {
                setSelectedMode("interview");
                setTitle("Campus Placement Technical Screening");
                setShowSetupModal(true);
              }}
              className="bg-[#FAF9F5] border border-[#E5E0D4] hover:border-[#2d4a3e] p-6 rounded-2xl space-y-3 cursor-pointer surface-hover"
            >
              <div className="w-8 h-8 rounded-xl bg-[#2d4a3e]/10 text-[#2d4a3e] flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-[#1a1b1e]">Placement Preparation</h4>
              <p className="text-xs text-[#5c5f66] leading-relaxed">
                Build communication confidence before the real conversation with tech hiring managers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: SOCIAL PROOF / STATEMENT ──────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD]">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <blockquote className="text-2xl sm:text-3xl md:text-4xl font-serif font-normal text-[#1a1b1e] leading-snug tracking-tight">
            "Preparation feels completely different when you can practice the conversation before it happens."
          </blockquote>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-6">
            <div className="bg-white border border-[#E5E0D4] p-5 rounded-2xl space-y-2 shadow-2xs">
              <p className="text-xs text-[#5c5f66] leading-relaxed italic">
                "Practicing PBFT view-change questions on Vivora helped me pass my PhD qualifying oral exam without freezing on follow-up probes."
              </p>
              <div className="pt-2">
                <div className="text-xs font-semibold text-[#1a1b1e]">Ananya S.</div>
                <div className="text-[11px] text-[#8c9099]">CS Doctoral Candidate • University Scholar</div>
              </div>
            </div>

            <div className="bg-white border border-[#E5E0D4] p-5 rounded-2xl space-y-2 shadow-2xs">
              <p className="text-xs text-[#5c5f66] leading-relaxed italic">
                "The live whiteboard with audio feedback felt exactly like my final rounds at top tech firms. The confidence boost was huge."
              </p>
              <div className="pt-2">
                <div className="text-xs font-semibold text-[#1a1b1e]">Rohan M.</div>
                <div className="text-[11px] text-[#8c9099]">Software Engineer Candidate</div>
              </div>
            </div>

            <div className="bg-white border border-[#E5E0D4] p-5 rounded-2xl space-y-2 shadow-2xs">
              <p className="text-xs text-[#5c5f66] leading-relaxed italic">
                "Being able to drop a biology chapter PDF and immediately get drilled on photosynthesis mechanisms transformed my revision."
              </p>
              <div className="pt-2">
                <div className="text-xs font-semibold text-[#1a1b1e]">Priya K.</div>
                <div className="text-[11px] text-[#8c9099]">Undergraduate Science Student</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 8: FINAL CINEMATIC CTA ──────────────────────────────────── */}
      <section className="py-24 md:py-32 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD] relative overflow-hidden">
        
        {/* Atmospheric Nature Memory Fragment 05 (Emerald Forest Haze & Sunlight Rays) */}
        <div 
          className="nature-memory-layer nature-mask-fade-down animate-nature-drift inset-0 h-full w-full"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=1600&auto=format&fit=crop')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 45%',
            opacity: 0.22,
            transform: `translate3d(0, ${(scrollY - 3000) * 0.04}px, 0)`,
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#FAF9F5] via-[#FAF9F5]/70 to-[#FAF9F5]/30 pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-[#1a1b1e] tracking-tight leading-tight">
            Your next answer starts here.
          </h2>

          <p className="text-sm md:text-base font-serif italic text-[#5c5f66]">
            Study. Practice. Speak. Improve.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-8 py-3.5 rounded-full bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white text-sm font-medium shadow-md transition-all flex items-center space-x-2"
            >
              <span>Try Vivora for free</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-[#EBE7DD] py-16 px-6 text-xs text-[#71767f]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-10">
          
          {/* Col 1: Brand */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-4 h-4 rounded-full bg-[#2d4a3e] text-white flex items-center justify-center text-[9px]">✦</span>
              <span className="font-serif italic text-lg text-[#1a1b1e] font-medium">vivora</span>
            </div>
            <p className="text-xs text-[#71767f] leading-relaxed max-w-sm">
              AI-powered preparation for students who want to think clearly, speak confidently, and perform better under pressure.
            </p>
          </div>

          {/* Col 2: Product */}
          <div className="space-y-2.5">
            <div className="font-semibold text-[#1a1b1e]">Product</div>
            <ul className="space-y-2 text-[#71767f]">
              <li><button onClick={() => setShowSetupModal(true)} className="hover:text-[#1a1b1e]">AI Study</button></li>
              <li><button onClick={() => setShowSetupModal(true)} className="hover:text-[#1a1b1e]">Viva Simulator</button></li>
              <li><button onClick={() => setShowSetupModal(true)} className="hover:text-[#1a1b1e]">Interview Practice</button></li>
              <li><a href="#insights" className="hover:text-[#1a1b1e]">Insights</a></li>
            </ul>
          </div>

          {/* Col 3: Resources */}
          <div className="space-y-2.5">
            <div className="font-semibold text-[#1a1b1e]">Resources</div>
            <ul className="space-y-2 text-[#71767f]">
              <li><a href="#how-it-works" className="hover:text-[#1a1b1e]">Guides</a></li>
              <li><a href="#product" className="hover:text-[#1a1b1e]">Documentation</a></li>
              <li><a href="#product" className="hover:text-[#1a1b1e]">Help Center</a></li>
            </ul>
          </div>

          {/* Col 4: Company */}
          <div className="space-y-2.5">
            <div className="font-semibold text-[#1a1b1e]">Company</div>
            <ul className="space-y-2 text-[#71767f]">
              <li><span className="hover:text-[#1a1b1e] cursor-pointer">About</span></li>
              <li><span className="hover:text-[#1a1b1e] cursor-pointer">Privacy Policy</span></li>
              <li><span className="hover:text-[#1a1b1e] cursor-pointer">Terms of Service</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-10 mt-10 border-t border-[#EBE7DD] flex items-center justify-between text-[11px] text-[#8c9099]">
          <div>© 2026 VIVORA AI. All rights reserved.</div>
          <div>RAM audio stream processing • Zero audio stored on disk</div>
        </div>
      </footer>

      {/* ── INTERACTIVE LAUNCH DRAWER MODAL ──────────────────────────────────── */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E0D4] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-[#2d4a3e] text-white flex items-center justify-center text-[10px]">✦</span>
                <h3 className="font-serif font-bold text-[#1a1b1e] text-lg">Launch VIVORA Studio</h3>
              </div>
              <button onClick={() => setShowSetupModal(false)} className="text-[#8c9099] hover:text-[#1a1b1e]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-3 gap-2 text-xs font-medium">
              <button
                onClick={() => {
                  setSelectedMode("interview");
                  setTitle("System Design Mock Interview & Technical Viva");
                  setContentText("System Architecture, Microservices, Load Balancers, Distributed Caching, Consensus");
                }}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  selectedMode === "interview"
                    ? "bg-[#2d4a3e] text-white border-[#2d4a3e]"
                    : "bg-[#FAF9F5] text-[#5c5f66] border-[#EBE7DD] hover:border-[#D6D0C2]"
                }`}
              >
                Tech Interview
              </button>
              <button
                onClick={() => {
                  setSelectedMode("college");
                  setTitle("University Viva Voce: Distributed Systems");
                  setContentText("PBFT, Raft Consensus, Byzantine Fault Tolerance, CAP Theorem");
                }}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  selectedMode === "college"
                    ? "bg-[#2d4a3e] text-white border-[#2d4a3e]"
                    : "bg-[#FAF9F5] text-[#5c5f66] border-[#EBE7DD] hover:border-[#D6D0C2]"
                }`}
              >
                College Viva
              </button>
              <button
                onClick={() => {
                  setSelectedMode("school");
                  setTitle("Class 10 Biology: Life Processes Viva");
                  setContentText("Photosynthesis, Respiration, Hemoglobin, Circulation, Excretion");
                }}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  selectedMode === "school"
                    ? "bg-[#2d4a3e] text-white border-[#2d4a3e]"
                    : "bg-[#FAF9F5] text-[#5c5f66] border-[#EBE7DD] hover:border-[#D6D0C2]"
                }`}
              >
                School Viva
              </button>
            </div>

            {/* Topic Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-[#8c9099] uppercase">Topic / Syllabus Outline</label>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="e.g. Distributed Consensus, PBFT, Raft, Load Balancer trade-offs..."
                rows={3}
                className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-2xl p-3.5 text-xs text-[#1a1b1e] focus:outline-none focus:border-[#2d4a3e] resize-none"
              />
            </div>

            {/* PDF Attachment Option */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-1.5 text-xs text-[#5c5f66] hover:text-[#1a1b1e] cursor-pointer">
                <UploadCloud className="w-4 h-4 text-[#2d4a3e]" />
                <span>{pdfParsing ? "Parsing PDF..." : "Attach PDF Textbook/Notes"}</span>
                <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              </label>

              {selectedFile && (
                <span className="text-[11px] font-mono text-[#2d4a3e] truncate max-w-[180px]">
                  📄 {selectedFile.name}
                </span>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            {/* Launch Action Button */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#EBE7DD]">
              <button
                onClick={() => setShowSetupModal(false)}
                className="px-4 py-2 rounded-full text-xs font-medium text-[#71767f] hover:text-[#1a1b1e]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStartSession(promptText || title, promptText || contentText, selectedMode)}
                disabled={loading}
                className="px-6 py-2.5 rounded-full bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white text-xs font-medium transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Launching...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Live Session</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
