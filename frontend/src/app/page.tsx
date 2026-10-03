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
                className="px-4 py-1.5 rounded-full bg-[#20211E] text-white text-xs font-medium"
              >
                Get started →
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <section className="pt-28 md:pt-36 pb-16 md:pb-24 px-6 relative overflow-hidden">
        
        {/* Atmospheric Mountain Background (Cinematic Misty Valley & Morning Ridge) */}
        <div 
          className="nature-memory-layer nature-mask-hero animate-nature-drift inset-0 top-0 h-[720px] md:h-[820px] w-full"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=2400&q=85')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 28%',
            opacity: 0.78,
            transform: `translate3d(0, ${scrollY * 0.06}px, 0)`,
          }}
        />
        
        {/* Soft atmospheric gradient wash ensuring contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/30 via-transparent to-[#FAF9F5] pointer-events-none z-0" />
        <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-[#FAF9F5] via-[#FAF9F5]/80 to-transparent pointer-events-none z-0" />

        <div className="max-w-4xl mx-auto flex flex-col items-center text-center space-y-6 relative z-10 pt-4">
          
          {/* Announcement pill */}
          <div className="inline-flex items-center space-x-2 px-4 py-1 rounded-full bg-[#FAF9F5]/90 backdrop-blur-md border border-[#DDD9CF] text-[11px] font-mono uppercase tracking-widest text-[#4a5043] shadow-xs">
            <span className="text-[#7D9F68]">✦</span>
            <span>CREDIBILITY • DISCIPLINE • COMMUNICATION</span>
          </div>

          {/* Editorial Headline matching screenshot */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[72px] font-serif font-normal text-[#20211E] tracking-tight leading-[1.06] max-w-3xl">
            Your next answer<br />
            <span className="italic font-normal">starts here.</span>
          </h1>

          {/* Supporting Copy */}
          <p className="text-sm sm:text-base md:text-lg text-[#555850] max-w-xl font-normal leading-relaxed">
            Study. Practice. Speak. Improve.<br className="hidden sm:inline" />
            Enter your viva with clarity and effortless intellectual composure.
          </p>

          {/* Primary CTA Button */}
          <div className="pt-2">
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-8 py-3.5 rounded-full bg-[#20211E] hover:bg-[#343631] text-white text-[14px] font-medium shadow-md hover:shadow-lg transition-all flex items-center space-x-2.5 group"
            >
              <span>Try VIVORA free</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>

          {/* Trust points row */}
          <div className="pt-2 text-[11px] font-mono text-[#787c74] flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <span>No credit card required</span>
            <span>•</span>
            <span>Instant syllabus ingestion</span>
            <span>•</span>
            <span>5 deep-memory viva defenses</span>
          </div>
        </div>

        {/* ── HERO PRODUCT VISUAL (ELEVATED REALISTIC WORKSPACE) ─────────────── */}
        <div id="product" className="max-w-5xl mx-auto mt-14 md:mt-20 relative z-10">
          
          {/* Main Floating Product Deck */}
          <div className="bg-white rounded-3xl border border-[#DDD9CF] shadow-[0_20px_50px_-10px_rgba(32,33,30,0.06),0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden transition-all">
            
            {/* Window Titlebar */}
            <div className="h-11 bg-[#FAF9F5] border-b border-[#EBE7DD] px-4 flex items-center justify-between text-xs text-[#8c9099]">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e5e0d4]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e5e0d4]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e5e0d4]" />
              </div>
              <div className="font-mono text-[11px] text-[#6F7069] flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7D9F68]" />
                <span>Computer Networks • Transport Layer Viva Preparation</span>
              </div>
              <span className="text-[11px] font-mono text-[#8c9099]">Progress: 72%</span>
            </div>

            {/* Product Interior Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
              
              {/* Left Subsystem Pane (4 cols) */}
              <div className="lg:col-span-4 bg-[#FAF9F5]/70 border-r border-[#EBE7DD] p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  
                  {/* Active Document Card */}
                  <div className="bg-white border border-[#DDD9CF] p-3.5 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#8c9099]">
                      <span>INGESTED MATERIAL</span>
                      <span className="text-[#7D9F68]">RAG Isolated</span>
                    </div>
                    <h4 className="text-xs font-semibold text-[#20211E]">
                      Tanenbaum_Ch4_TransportLayer.pdf
                    </h4>
                    <p className="text-[11px] text-[#6F7069]">14 sections parsed • 3 key invariants tagged</p>
                  </div>

                  {/* Examiner Card */}
                  <div className="bg-white border border-[#DDD9CF] p-3.5 rounded-xl space-y-2 shadow-2xs">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-[#20211E] text-white flex items-center justify-center text-[10px] font-mono">
                        AI
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#20211E]">Dr. Aris (Examiner)</div>
                        <div className="text-[10px] text-[#6F7069]">Stanford Rubric Calibration</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 pt-1">
                      <div className="w-1 h-3 rounded-full bg-[#7D9F68] animate-pulse" />
                      <div className="w-1 h-5 rounded-full bg-[#7D9F68] animate-pulse" />
                      <div className="w-1 h-2.5 rounded-full bg-[#7D9F68] animate-pulse" />
                      <div className="w-1 h-4 rounded-full bg-[#7D9F68] animate-pulse" />
                      <span className="text-[11px] font-mono text-[#7D9F68] ml-2">Audio Synthesizer Active</span>
                    </div>
                  </div>
                </div>

                {/* Real-time readiness gauge */}
                <div className="bg-white border border-[#DDD9CF] p-3.5 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#6F7069]">Oral Defense Readiness</span>
                    <span className="font-mono font-bold text-[#7D9F68]">94%</span>
                  </div>
                  <div className="w-full bg-[#FAF9F5] h-1.5 rounded-full overflow-hidden border border-[#EBE7DD]">
                    <div className="bg-[#7D9F68] h-full w-[94%]" />
                  </div>
                </div>
              </div>

              {/* Right Stage: Interactive Conversation (8 cols) */}
              <div className="lg:col-span-8 p-6 md:p-8 flex flex-col justify-between bg-white space-y-6">
                
                {/* Active Question Dialogue */}
                <div className="space-y-4">
                  
                  {/* AI Examiner Prompt */}
                  <div className="flex items-start space-x-3.5">
                    <div className="w-7 h-7 rounded-full bg-[#F2EFE6] border border-[#DDD9CF] flex items-center justify-center text-[#7D9F68] font-serif italic text-xs shrink-0 mt-0.5">
                      Q3
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="text-[11px] font-mono text-[#8c9099] uppercase tracking-wider">AI Examiner Prompt</div>
                      <p className="text-sm md:text-base font-serif text-[#20211E] leading-relaxed">
                        "Explain why TCP uses a three-way handshake instead of a two-way handshake, and what failure scenario occurs under duplicate connection requests?"
                      </p>
                    </div>
                  </div>

                  {/* Candidate Speech Transcript */}
                  <div className="ml-10 bg-[#FAF9F5] border border-[#DDD9CF] rounded-2xl p-4 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#6F7069]">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7D9F68]" />
                        <span>Candidate Speech Stream</span>
                      </span>
                      <span>142 WPM • Clarity: 96%</span>
                    </div>
                    <p className="text-xs md:text-sm text-[#20211E] leading-relaxed font-sans">
                      "A two-way handshake is insufficient because old delayed duplicate SYN segments could arrive at the server, leading to half-open ghost connections without client acknowledgment. The three-way handshake ensures sequence number synchronization..."
                    </p>
                  </div>

                  {/* AI Adaptive Follow-up Probe */}
                  <div className="flex items-start space-x-3.5 pt-2">
                    <div className="w-7 h-7 rounded-full bg-[#7D9F68]/10 text-[#7D9F68] flex items-center justify-center font-mono text-xs shrink-0 mt-0.5">
                      ↳
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="text-[11px] font-mono text-[#7D9F68] uppercase font-semibold">Adaptive Follow-up Trigger</div>
                      <p className="text-xs md:text-sm text-[#20211E] leading-relaxed">
                        "Good explanation. How does TCP SYN cookies mitigate exhaustion attacks against this exact state backlog?"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Interactive Voice Dock inside preview */}
                <div className="pt-4 border-t border-[#EBE7DD] flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-[#20211E] text-white flex items-center justify-center shadow-xs">
                      <Mic className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono text-[#6F7069]">Voice Channel Transmitting</span>
                  </div>

                  <button
                    onClick={() => setShowSetupModal(true)}
                    className="text-xs font-semibold text-[#7D9F68] hover:underline flex items-center space-x-1"
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
        
        {/* Atmospheric Nature Layer (Morning Canopy & Golden Rays) */}
        <div 
          className="nature-memory-layer nature-mask-organic-right animate-nature-drift-reverse -right-20 top-6 w-[760px] h-[800px]"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2000&q=80')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center right',
            opacity: 0.45,
            transform: `translate3d(0, ${(scrollY - 400) * 0.04}px, 0)`,
          }}
        />

        <div className="max-w-5xl mx-auto space-y-16 relative z-10">
          
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-mono text-[#7D9F68] uppercase tracking-wider font-semibold">
              The Academic Cycle
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#20211E] tracking-tight leading-tight">
              Everything you need to prepare. Nothing you don't.
            </h2>
            <p className="text-base text-[#6F7069] leading-relaxed">
              VIVORA brings preparation, practice, feedback, and confidence into one intelligent workspace.
            </p>
          </div>

          {/* 3 Step Editorial Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* 01 - Learn */}
            <div className="bg-white border border-[#DDD9CF] rounded-3xl p-7 space-y-6 flex flex-col justify-between surface-hover shadow-2xs">
              <div className="space-y-4">
                <span className="font-mono text-xs text-[#8c9099] font-semibold">01 — LEARN</span>
                <h3 className="text-2xl font-serif font-normal text-[#20211E] leading-snug">
                  Turn your material into understanding.
                </h3>
                <p className="text-xs text-[#6F7069] leading-relaxed">
                  Upload lecture slides, PDF textbooks, research papers, or syllabus outlines. VIVORA extracts concepts and segments them for oral mastery.
                </p>
              </div>

              <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-[#EBE7DD] shadow-2xs space-y-2">
                <div className="flex items-center space-x-2 text-xs font-medium text-[#20211E]">
                  <FileText className="w-4 h-4 text-[#7D9F68]" />
                  <span>Operating Systems — Unit 3.pdf</span>
                </div>
                <div className="text-[11px] text-[#6F7069] font-mono">Concepts: Deadlock, Mutex, Semaphores</div>
              </div>
            </div>

            {/* 02 - Practice */}
            <div className="bg-white border border-[#DDD9CF] rounded-3xl p-7 space-y-6 flex flex-col justify-between surface-hover shadow-2xs">
              <div className="space-y-4">
                <span className="font-mono text-xs text-[#7D9F68] font-semibold">02 — PRACTICE</span>
                <h3 className="text-2xl font-serif font-normal text-[#20211E] leading-snug">
                  Practice like someone is actually asking.
                </h3>
                <p className="text-xs text-[#6F7069] leading-relaxed">
                  Experience realistic voice viva examinations with adaptive probing, real-time interruptions, and follow-ups tailored to your explanations.
                </p>
              </div>

              <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-[#EBE7DD] shadow-2xs space-y-2">
                <div className="flex items-center space-x-2 text-xs font-medium text-[#20211E]">
                  <Volume2 className="w-4 h-4 text-[#7D9F68]" />
                  <span>Real-time Voice Examiner</span>
                </div>
                <div className="text-[11px] text-[#6F7069] font-mono">Adaptive Conceptual Probing</div>
              </div>
            </div>

            {/* 03 - Improve */}
            <div className="bg-white border border-[#DDD9CF] rounded-3xl p-7 space-y-6 flex flex-col justify-between surface-hover shadow-2xs">
              <div className="space-y-4">
                <span className="font-mono text-xs text-[#8c9099] font-semibold">03 — IMPROVE</span>
                <h3 className="text-2xl font-serif font-normal text-[#20211E] leading-snug">
                  Know exactly what to improve.
                </h3>
                <p className="text-xs text-[#6F7069] leading-relaxed">
                  Receive instant multi-rubric assessments across correctness, depth, and speech clarity, alongside a prioritized revision plan.
                </p>
              </div>

              <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-[#EBE7DD] shadow-2xs space-y-2">
                <div className="flex items-center space-x-2 text-xs font-medium text-[#20211E]">
                  <Award className="w-4 h-4 text-[#7D9F68]" />
                  <span>Multi-Metric Scorecard</span>
                </div>
                <div className="text-[11px] text-[#6F7069] font-mono">Accuracy 88% • Articulation 94%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: AI VIVA EXPERIENCE ────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD] relative overflow-hidden">
        
        {/* Atmospheric Nature Layer (Misty Mountain Forest & Quiet Mist) */}
        <div 
          className="nature-memory-layer nature-mask-radial animate-nature-drift -left-20 top-1/2 -translate-y-1/2 w-[860px] h-[720px]"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=2000&q=80')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.45,
            transform: `translate3d(0, ${(scrollY - 1000) * 0.04}px, 0)`,
          }}
        />

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-mono text-[#7D9F68] uppercase tracking-wider font-semibold">
              Adaptive Oral Defense
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#20211E] tracking-tight leading-tight">
              Not another chatbot.<br />
              <span className="italic text-[#7D9F68]">A real conversation.</span>
            </h2>
            <p className="text-sm md:text-base text-[#6F7069] leading-relaxed">
              VIVORA listens, asks follow-up questions, adapts to your answers, and helps you practice under real conversational pressure.
            </p>
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-6 py-2.5 rounded-full bg-[#20211E] hover:bg-[#343631] text-white text-xs font-semibold shadow-xs flex items-center space-x-2 transition-all"
            >
              <span>Start a Viva</span>
              <span>→</span>
            </button>
          </div>

          {/* Interactive Phone / Device Mockup */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-md bg-white rounded-3xl border border-[#DDD9CF] p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#EBE7DD] text-xs">
                <span className="font-mono text-[#8c9099]">LIVE AUDIO EXAM</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#f0fdf4] text-[#7D9F68] font-mono text-[11px] font-bold">14ms Latency</span>
              </div>

              {/* Dialogue Transcript */}
              <div className="space-y-4 text-xs font-sans">
                <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#DDD9CF] space-y-1">
                  <div className="text-[10px] font-mono text-[#8c9099]">AI EXAMINER (DR. ARIS)</div>
                  <p className="text-[#20211E] font-medium leading-relaxed">
                    "Explain the fundamental difference between supervised and unsupervised machine learning."
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#cbd5e1] ml-4 space-y-1 shadow-2xs">
                  <div className="text-[10px] font-mono text-[#7D9F68]">STUDENT (YOU)</div>
                  <p className="text-[#20211E] leading-relaxed">
                    "Supervised learning trains on labelled datasets with input-output pairs, whereas unsupervised learning discovers intrinsic patterns without ground-truth labels."
                  </p>
                </div>

                <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#DDD9CF] space-y-1">
                  <div className="text-[10px] font-mono text-[#8c9099]">ADAPTIVE FOLLOW-UP PROBE</div>
                  <p className="text-[#20211E] font-medium leading-relaxed">
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
                    className="w-1 rounded-full bg-[#7D9F68] opacity-80 animate-pulse"
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
            <span className="text-xs font-mono text-[#7D9F68] uppercase tracking-wider font-semibold">
              Anywhere Study Companion
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#20211E] tracking-tight leading-tight">
              Your preparation doesn't have to stay in one tab.
            </h2>
            <p className="text-base text-[#6F7069] leading-relaxed">
              Drill concepts on your phone, rehearse interview answers during walks, or review analytics between classes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-[#FAF9F5] border border-[#DDD9CF] p-6 rounded-2xl space-y-3">
              <span className="text-xs font-mono text-[#7D9F68] font-bold">01 • DAILY DRILLS</span>
              <h4 className="text-base font-semibold text-[#20211E]">Bite-sized Viva Questions</h4>
              <p className="text-xs text-[#6F7069] leading-relaxed">
                Receive 2-minute quick-fire concept challenges on your phone to maintain recall before exam week.
              </p>
            </div>

            <div className="bg-[#FAF9F5] border border-[#DDD9CF] p-6 rounded-2xl space-y-3">
              <span className="text-xs font-mono text-[#7D9F68] font-bold">02 • VOICE REHEARSAL</span>
              <h4 className="text-base font-semibold text-[#20211E]">Hands-Free Oral Practice</h4>
              <p className="text-xs text-[#6F7069] leading-relaxed">
                Answer questions out loud without touching your keyboard. The Web Speech engine transcribes seamlessly.
              </p>
            </div>

            <div className="bg-[#FAF9F5] border border-[#DDD9CF] p-6 rounded-2xl space-y-3">
              <span className="text-xs font-mono text-[#7D9F68] font-bold">03 • WEAK TOPIC ALERTS</span>
              <h4 className="text-base font-semibold text-[#20211E]">Smart Concept Spaced Recall</h4>
              <p className="text-xs text-[#6F7069] leading-relaxed">
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
            <span className="text-xs font-mono text-[#7D9F68] uppercase tracking-wider font-semibold">
              Analytics & Readiness
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#20211E] tracking-tight leading-tight">
              From "I think I know it"<br />
              <span className="italic text-[#7D9F68]">to "I can explain it."</span>
            </h2>
            <p className="text-base text-[#6F7069] leading-relaxed">
              Understand where your verbal explanations falter and bridge gaps before stepping in front of professors or interview panels.
            </p>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#DDD9CF] p-5 rounded-2xl shadow-2xs space-y-2">
              <div className="text-xs font-mono text-[#8c9099]">CONCEPT MASTERY</div>
              <div className="text-3xl font-serif font-bold text-[#20211E]">94%</div>
              <p className="text-[11px] text-[#6F7069]">Invariants & definitions verified</p>
            </div>

            <div className="bg-white border border-[#DDD9CF] p-5 rounded-2xl shadow-2xs space-y-2">
              <div className="text-xs font-mono text-[#8c9099]">VIVA READINESS</div>
              <div className="text-3xl font-serif font-bold text-[#7D9F68]">High (88%)</div>
              <p className="text-[11px] text-[#6F7069]">Confidence across 14 modules</p>
            </div>

            <div className="bg-white border border-[#DDD9CF] p-5 rounded-2xl shadow-2xs space-y-2">
              <div className="text-xs font-mono text-[#8c9099]">SPEAKING CLARITY</div>
              <div className="text-3xl font-serif font-bold text-[#20211E]">91%</div>
              <p className="text-[11px] text-[#6F7069]">Pacing (142 WPM) & minimal fillers</p>
            </div>

            <div className="bg-white border border-[#DDD9CF] p-5 rounded-2xl shadow-2xs space-y-2">
              <div className="text-xs font-mono text-[#8c9099]">PRACTICE STREAK</div>
              <div className="text-3xl font-serif font-bold text-[#7D9F68]">6 Days</div>
              <p className="text-[11px] text-[#6F7069]">Exam in 12 days</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: USE CASES ─────────────────────────────────────────────── */}
      <section id="use-cases" className="py-20 md:py-28 px-6 bg-white border-t border-[#EBE7DD]">
        <div className="max-w-5xl mx-auto space-y-14">
          
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-mono text-[#7D9F68] uppercase tracking-wider font-semibold">
              Purpose-Built Modes
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#20211E] tracking-tight leading-tight">
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
              className="bg-[#FAF9F5] border border-[#DDD9CF] hover:border-[#7D9F68] p-6 rounded-2xl space-y-3 cursor-pointer surface-hover"
            >
              <div className="w-8 h-8 rounded-xl bg-[#7D9F68]/10 text-[#7D9F68] flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-[#20211E]">College Viva</h4>
              <p className="text-xs text-[#6F7069] leading-relaxed">
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
              className="bg-[#FAF9F5] border border-[#DDD9CF] hover:border-[#7D9F68] p-6 rounded-2xl space-y-3 cursor-pointer surface-hover"
            >
              <div className="w-8 h-8 rounded-xl bg-[#7D9F68]/10 text-[#7D9F68] flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-[#20211E]">Technical Interview</h4>
              <p className="text-xs text-[#6F7069] leading-relaxed">
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
              className="bg-[#FAF9F5] border border-[#DDD9CF] hover:border-[#7D9F68] p-6 rounded-2xl space-y-3 cursor-pointer surface-hover"
            >
              <div className="w-8 h-8 rounded-xl bg-[#7D9F68]/10 text-[#7D9F68] flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-[#20211E]">Presentation & Seminars</h4>
              <p className="text-xs text-[#6F7069] leading-relaxed">
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
              className="bg-[#FAF9F5] border border-[#DDD9CF] hover:border-[#7D9F68] p-6 rounded-2xl space-y-3 cursor-pointer surface-hover"
            >
              <div className="w-8 h-8 rounded-xl bg-[#7D9F68]/10 text-[#7D9F68] flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-[#20211E]">Exam Preparation</h4>
              <p className="text-xs text-[#6F7069] leading-relaxed">
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
              className="bg-[#FAF9F5] border border-[#DDD9CF] hover:border-[#7D9F68] p-6 rounded-2xl space-y-3 cursor-pointer surface-hover"
            >
              <div className="w-8 h-8 rounded-xl bg-[#7D9F68]/10 text-[#7D9F68] flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-[#20211E]">Placement Preparation</h4>
              <p className="text-xs text-[#6F7069] leading-relaxed">
                Build communication confidence before the real conversation with tech hiring managers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: SOCIAL PROOF / STATEMENT ──────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD]">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <blockquote className="text-2xl sm:text-3xl md:text-4xl font-serif font-normal text-[#20211E] leading-snug tracking-tight">
            "Preparation feels completely different when you can practice the conversation before it happens."
          </blockquote>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-6">
            <div className="bg-white border border-[#DDD9CF] p-5 rounded-2xl space-y-2 shadow-2xs">
              <p className="text-xs text-[#6F7069] leading-relaxed italic">
                "Practicing PBFT view-change questions on Vivora helped me pass my PhD qualifying oral exam without freezing on follow-up probes."
              </p>
              <div className="pt-2">
                <div className="text-xs font-semibold text-[#20211E]">Elena Rostova</div>
                <div className="text-[11px] text-[#8c9099]">PhD Candidate in Distributed Systems • Cambridge</div>
              </div>
            </div>

            <div className="bg-white border border-[#DDD9CF] p-5 rounded-2xl space-y-2 shadow-2xs">
              <p className="text-xs text-[#6F7069] leading-relaxed italic">
                "The live whiteboard with audio feedback felt exactly like my final rounds at top tech firms. The confidence boost was huge."
              </p>
              <div className="pt-2">
                <div className="text-xs font-semibold text-[#20211E]">Marcus Vance</div>
                <div className="text-[11px] text-[#8c9099]">Final Year B.Tech Software Engineering</div>
              </div>
            </div>

            <div className="bg-white border border-[#DDD9CF] p-5 rounded-2xl space-y-2 shadow-2xs">
              <p className="text-xs text-[#6F7069] leading-relaxed italic">
                "Being able to drop a biology chapter PDF and immediately get drilled on photosynthesis mechanisms transformed my revision."
              </p>
              <div className="pt-2">
                <div className="text-xs font-semibold text-[#20211E]">Priya Sharma</div>
                <div className="text-[11px] text-[#8c9099]">Master of Science Candidate • ETH Zürich</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 8: FINAL CINEMATIC CTA ──────────────────────────────────── */}
      <section className="py-24 md:py-32 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD] relative overflow-hidden">
        
        {/* Atmospheric Nature Layer (Alpine Morning Light & Misty Horizon) */}
        <div 
          className="nature-memory-layer nature-mask-fade-down animate-nature-drift inset-0 h-full w-full"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=2400&q=85')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
            opacity: 0.55,
            transform: `translate3d(0, ${(scrollY - 2800) * 0.04}px, 0)`,
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#FAF9F5] via-[#FAF9F5]/70 to-[#FAF9F5]/30 pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-[#20211E] tracking-tight leading-tight">
            Your next answer starts here.
          </h2>

          <p className="text-sm md:text-base font-serif italic text-[#6F7069]">
            Study. Practice. Speak. Improve.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-8 py-3.5 rounded-full bg-[#20211E] hover:bg-[#343631] text-white text-sm font-medium shadow-md transition-all flex items-center space-x-2"
            >
              <span>Try VIVORA free</span>
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
