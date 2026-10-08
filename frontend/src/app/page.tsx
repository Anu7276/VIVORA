"use client";

import { useState, useEffect, useRef } from "react";
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
  Pause,
  RotateCcw,
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
  Radio,
  Star,
  Quote
} from "lucide-react";

const FULL_QUESTION =
  "Explain why TCP uses a three-way handshake instead of a two-way handshake, and what failure scenario occurs under duplicate connection requests?";

const FULL_CANDIDATE_SPEECH =
  "A two-way handshake is insufficient because old delayed duplicate SYN segments could arrive at the server, leading to half-open ghost connections without client acknowledgment. The three-way handshake ensures sequence number synchronization...";

const FULL_FOLLOWUP =
  "Good explanation. How does TCP SYN cookies mitigate exhaustion attacks against this exact state backlog?";

function HeroLaptopVideoSimulator({ onLaunch }: { onLaunch: () => void }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [timelineMs, setTimelineMs] = useState(2500);

  const TOTAL_DURATION_MS = 18000;

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTimelineMs((prev) => {
        if (prev >= TOTAL_DURATION_MS) return 0;
        return prev + 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  let phase: "EXAMINER" | "CANDIDATE" | "EVALUATION" | "FOLLOWUP" = "EXAMINER";
  let statusBadge = "Examiner Audio (TTS Active)";
  let isSynthesizerActive = false;
  let isCandidateSpeaking = false;
  let readinessScore = 74;
  let wpm = 138;

  let visibleQuestion = FULL_QUESTION;
  let visibleSpeech = "";
  let isFollowupVisible = false;
  let visibleFollowup = "";

  if (timelineMs < 4000) {
    phase = "EXAMINER";
    statusBadge = "Examiner Synthesizing Turn";
    isSynthesizerActive = true;
    const charCount = Math.floor((timelineMs / 3600) * FULL_QUESTION.length);
    visibleQuestion = FULL_QUESTION.slice(0, Math.max(18, charCount));
    readinessScore = 74;
  } else if (timelineMs < 11000) {
    phase = "CANDIDATE";
    statusBadge = "Candidate Speech Stream";
    isCandidateSpeaking = true;
    const progress = (timelineMs - 4000) / 7000;
    const charCount = Math.floor(progress * FULL_CANDIDATE_SPEECH.length);
    visibleSpeech = FULL_CANDIDATE_SPEECH.slice(0, Math.max(8, charCount));
    readinessScore = Math.min(94, 74 + Math.floor(progress * 20));
    wpm = 136 + Math.floor(progress * 6);
  } else if (timelineMs < 13500) {
    phase = "EVALUATION";
    statusBadge = "Evaluating Rubric & Depth";
    visibleSpeech = FULL_CANDIDATE_SPEECH;
    readinessScore = 94;
    wpm = 142;
  } else {
    phase = "FOLLOWUP";
    statusBadge = "Adaptive Follow-up Active";
    visibleSpeech = FULL_CANDIDATE_SPEECH;
    isFollowupVisible = true;
    isSynthesizerActive = true;
    const progress = (timelineMs - 13500) / 4000;
    const charCount = Math.floor(progress * FULL_FOLLOWUP.length);
    visibleFollowup = FULL_FOLLOWUP.slice(0, Math.max(10, charCount));
    readinessScore = 94;
    wpm = 142;
  }

  const seconds = Math.floor(timelineMs / 1000);
  const progressPercent = Math.min(100, (timelineMs / TOTAL_DURATION_MS) * 100);

  return (
    <div id="product" className="lg:col-span-7 w-full relative px-1 sm:px-2">
      {/* Laptop Container */}
      <div className="relative mx-auto transition-transform duration-500 hover:scale-[1.01]">
        
        {/* Top Display Lid (Screen + Bezel) */}
        <div className="relative rounded-[20px] sm:rounded-[26px] md:rounded-[32px] bg-[#121316] p-2 sm:p-2.5 md:p-3 border border-[#2b2d33] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.45),0_10px_30px_-10px_rgba(0,0,0,0.3)] ring-1 ring-white/10">
          
          {/* Webcam & Mic Notch / Pill Bar at Top Bezel */}
          <div className="absolute top-1 sm:top-1.5 inset-x-0 flex items-center justify-center pointer-events-none z-30">
            <div className="flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-[#1b1c20]/80">
              <span className="w-0.5 h-0.5 rounded-full bg-[#33363f]" />
              <span className="w-2 h-2 rounded-full bg-[#0a0a0c] ring-1 ring-[#3a3d46] relative flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-[#1c2438] block" />
              </span>
              <span className="w-1 h-1 rounded-full bg-emerald-400/90 shadow-[0_0_3px_#34d399]" />
            </div>
          </div>

          {/* Inner Screen Display */}
          <div className="relative bg-white rounded-[14px] sm:rounded-[18px] md:rounded-[22px] overflow-hidden border border-[#22242a] shadow-inner">
            
            {/* Subtle Glass Reflection Glare */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.06] z-20" />

            {/* Window Titlebar with Video Simulation Pill */}
            <div className="h-10 sm:h-11 bg-[#FAF9F5] border-b border-[#EBE7DD] px-3 sm:px-4 flex items-center justify-between text-xs text-[#5A5D64] relative z-10">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56] border border-[#E0443E]/50 shadow-2xs inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50 shadow-2xs inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F] border border-[#1AAB29]/50 shadow-2xs inline-block" />
              </div>

              {/* Center status title */}
              <div className="font-mono text-[10px] sm:text-[11px] text-[#6F7069] flex items-center space-x-1.5 sm:space-x-2 truncate px-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-[#7D9F68] animate-pulse" : "bg-amber-400"}`} />
                <span className="truncate">Computer Networks • Transport Layer Viva Preparation</span>
              </div>

              {/* Video Timeline & Live REC indicator */}
              <div className="flex items-center space-x-2 shrink-0">
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 text-[9px] font-mono font-medium uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />
                  <span>REC</span>
                </span>
                <span className="text-[10px] sm:text-[11px] font-mono text-[#5A5D64] hidden sm:inline">
                  00:{seconds.toString().padStart(2, "0")} / 00:18
                </span>
              </div>
            </div>

            {/* Product Interior Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-12 min-h-[420px] sm:min-h-[450px] relative z-10">
              
              {/* Left Subsystem Pane (4 cols) */}
              <div className="sm:col-span-4 bg-[#FAF9F5]/70 border-b sm:border-b-0 sm:border-r border-[#EBE7DD] p-3.5 sm:p-4 flex flex-col justify-between space-y-3.5">
                <div className="space-y-3">
                  
                  {/* Active Document Card */}
                  <div className="bg-white border border-[#DDD9CF] p-3 rounded-xl space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-[#5A5D64]">
                      <span>INGESTED MATERIAL</span>
                      <span className="text-[#7D9F68]">RAG Isolated</span>
                    </div>
                    <h4 className="text-xs font-semibold text-[#20211E] truncate">
                      Tanenbaum_Ch4_TransportLayer.pdf
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-[#6F7069]">14 sections parsed • 3 key invariants tagged</p>
                  </div>

                  {/* Examiner Card with Dynamic Voice Activity */}
                  <div className={`bg-white border p-3 rounded-xl space-y-2 shadow-2xs transition-all duration-300 ${
                    isSynthesizerActive ? "border-[#7D9F68]/60 ring-1 ring-[#7D9F68]/20" : "border-[#DDD9CF]"
                  }`}>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-[#20211E] text-white flex items-center justify-center text-[10px] font-mono shrink-0">
                        AI
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#20211E] truncate">Dr. Aris (Examiner)</div>
                        <div className="text-[10px] text-[#6F7069] truncate">Stanford Rubric Calibration</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 pt-0.5">
                      <div className={`w-1 rounded-full bg-[#7D9F68] transition-all duration-150 ${isSynthesizerActive ? "h-4 animate-bounce" : "h-2"}`} />
                      <div className={`w-1 rounded-full bg-[#7D9F68] transition-all duration-150 ${isSynthesizerActive ? "h-6 animate-pulse" : "h-3"}`} />
                      <div className={`w-1 rounded-full bg-[#7D9F68] transition-all duration-150 ${isSynthesizerActive ? "h-3.5 animate-bounce" : "h-1.5"}`} />
                      <div className={`w-1 rounded-full bg-[#7D9F68] transition-all duration-150 ${isSynthesizerActive ? "h-5 animate-pulse" : "h-2.5"}`} />
                      <span className="text-[10px] sm:text-[11px] font-mono text-[#7D9F68] ml-1.5 truncate">
                        {isSynthesizerActive ? "Audio Synthesizer Active" : "Examiner Listening"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Real-time readiness gauge (Animates dynamically) */}
                <div className="bg-white border border-[#DDD9CF] p-3 rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#6F7069] text-[11px]">Oral Defense Readiness</span>
                    <span className="font-mono font-bold text-[#7D9F68] text-xs transition-all duration-300">
                      {readinessScore}%
                    </span>
                  </div>
                  <div className="w-full bg-[#FAF9F5] h-1.5 rounded-full overflow-hidden border border-[#EBE7DD]">
                    <div 
                      className="bg-[#7D9F68] h-full transition-all duration-500 ease-out" 
                      style={{ width: `${readinessScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Stage: Interactive Conversation (8 cols) */}
              <div className="sm:col-span-8 p-4 sm:p-5 md:p-6 flex flex-col justify-between bg-white space-y-4">
                
                {/* Active Question Dialogue */}
                <div className="space-y-3.5">
                  
                  {/* AI Examiner Prompt */}
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#F2EFE6] border border-[#DDD9CF] flex items-center justify-center text-[#7D9F68] font-serif italic text-xs shrink-0 mt-0.5">
                      Q3
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="text-[10px] sm:text-[11px] font-mono text-[#5A5D64] uppercase tracking-wider flex items-center justify-between">
                        <span>AI Examiner Prompt</span>
                        {phase === "EXAMINER" && (
                          <span className="text-[10px] text-[#7D9F68] font-mono animate-pulse">● Speaking...</span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-serif text-[#20211E] leading-relaxed min-h-[38px]">
                        "{visibleQuestion}"
                        {phase === "EXAMINER" && visibleQuestion.length < FULL_QUESTION.length && (
                          <span className="inline-block w-1 h-3.5 bg-[#7D9F68] ml-0.5 animate-pulse align-middle" />
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Candidate Speech Transcript (Typewriter / Live Speech Stream) */}
                  <div className={`ml-1 sm:ml-9 bg-[#FAF9F5] border rounded-xl sm:rounded-2xl p-3 sm:p-3.5 space-y-1.5 shadow-2xs transition-all duration-300 ${
                    isCandidateSpeaking ? "border-[#7D9F68]/70 ring-2 ring-[#7D9F68]/15" : "border-[#DDD9CF]"
                  }`}>
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-[#6F7069]">
                      <span className="flex items-center space-x-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isCandidateSpeaking ? "bg-[#7D9F68] animate-ping" : "bg-[#7D9F68]"}`} />
                        <span>Candidate Speech Stream</span>
                      </span>
                      <span>{wpm} WPM • Clarity: 96%</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-[#20211E] leading-relaxed font-sans min-h-[46px]">
                      {visibleSpeech ? (
                        <>
                          "{visibleSpeech}"
                          {isCandidateSpeaking && (
                            <span className="inline-block w-1.5 h-3 bg-[#7D9F68] ml-1 animate-pulse align-middle" />
                          )}
                        </>
                      ) : (
                        <span className="text-[#a0a39d] italic">Waiting for candidate response...</span>
                      )}
                    </p>
                  </div>

                  {/* AI Adaptive Follow-up Probe */}
                  <div className={`flex items-start space-x-3 pt-1 transition-all duration-500 ${
                    isFollowupVisible ? "opacity-100 translate-y-0" : "opacity-30 translate-y-1"
                  }`}>
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-mono text-xs shrink-0 mt-0.5 transition-colors ${
                      isFollowupVisible ? "bg-[#7D9F68] text-white shadow-xs" : "bg-[#7D9F68]/10 text-[#7D9F68]"
                    }`}>
                      ↳
                    </div>
                    <div className="space-y-0.5 flex-1">
                      <div className="text-[10px] sm:text-[11px] font-mono text-[#7D9F68] uppercase font-semibold flex items-center justify-between">
                        <span>Adaptive Follow-up Trigger</span>
                        {isFollowupVisible && phase === "FOLLOWUP" && (
                          <span className="text-[10px] font-mono text-[#7D9F68] animate-pulse">Probing Invariant...</span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-[#20211E] leading-relaxed">
                        {isFollowupVisible ? (
                          <>
                            "{visibleFollowup}"
                            {visibleFollowup.length < FULL_FOLLOWUP.length && (
                              <span className="inline-block w-1 h-3 bg-[#7D9F68] ml-0.5 animate-pulse align-middle" />
                            )}
                          </>
                        ) : (
                          <span className="text-[#a0a39d] italic">Follow-up cross-examination will trigger based on response depth...</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Interactive Voice Dock */}
                <div className="pt-3 border-t border-[#EBE7DD] flex items-center justify-between">
                  {/* Left: Dynamic Status Indicator */}
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7D9F68] animate-pulse" />
                    <span className="text-[10px] sm:text-[11px] font-mono text-[#6F7069] truncate">
                      {statusBadge}
                    </span>
                  </div>

                    {/* Right: Launch Live Simulator CTA */}
                    <button
                      onClick={onLaunch}
                      className="text-[11px] sm:text-xs font-semibold text-[#7D9F68] hover:underline flex items-center space-x-1 shrink-0"
                    >
                      <span>Launch Live Simulator</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Laptop Base (Hinge + Lower Unibody Deck + Thumb Notch) */}
        <div className="relative -mt-0.5">
          <div className="w-28 sm:w-40 md:w-52 h-1 sm:h-1.5 mx-auto bg-[#1b1c20] rounded-b-[2px] shadow-inner border-t border-[#0d0e10]" />
          
          <div className="relative w-[104%] -left-[2%] h-3 sm:h-4 md:h-5 bg-gradient-to-b from-[#2e3136] via-[#202226] to-[#141517] rounded-b-[14px] sm:rounded-b-[20px] md:rounded-b-[24px] border-t border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="w-12 sm:w-16 md:w-20 h-1 sm:h-1.5 bg-[#0e0f11] mx-auto rounded-b-[4px] border-t border-black/40 shadow-inner" />
          </div>

          <div className="w-[88%] h-3 sm:h-5 mx-auto -mt-1 bg-black/40 blur-xl rounded-full pointer-events-none" />
        </div>

      </div>
    </div>
  );
}

function MobileChatVideoSimulator() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeMs, setTimeMs] = useState(0);
  const TOTAL_DURATION_MS = 18000;
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTimeMs((prev) => {
        if (prev >= TOTAL_DURATION_MS) return 0;
        return prev + 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Auto-scroll chat to latest message as video plays
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [timeMs]);

  // Derived state based on timeline
  const FULL_CANDIDATE_ANSWER =
    "Supervised learning trains on labelled datasets with input-output pairs, whereas unsupervised discovers intrinsic patterns without ground-truth labels.";
  const STUDENT_INTRO = "im home and ready";

  const isBubble1Visible = timeMs >= 2200;
  const isTypingBubble1 = timeMs < 2200;

  // Student typing into input field (2.6s - 4.8s)
  const isStudentTypingText = timeMs >= 2600 && timeMs < 4800;
  const currentInputValue = isStudentTypingText
    ? STUDENT_INTRO.slice(0, Math.floor(((timeMs - 2600) / 2000) * STUDENT_INTRO.length))
    : "";

  const isBubble2Visible = timeMs >= 4800;
  const isTypingBubble2 = timeMs >= 5200 && timeMs < 7800;
  const isBubble3Visible = timeMs >= 7800;

  // Student speaking answer (8.4s - 13.6s)
  const isStudentSpeaking = timeMs >= 8400 && timeMs < 13600;
  const spokenChars = isStudentSpeaking
    ? Math.floor(((timeMs - 8400) / 4800) * FULL_CANDIDATE_ANSWER.length)
    : FULL_CANDIDATE_ANSWER.length;
  const currentSpokenText = isStudentSpeaking
    ? FULL_CANDIDATE_ANSWER.slice(0, Math.max(12, spokenChars))
    : FULL_CANDIDATE_ANSWER;
  const isBubble4Visible = timeMs >= 8400;

  // Evaluation & Follow-up
  const isEvaluating = timeMs >= 13600 && timeMs < 16000;
  const isBubble5Visible = timeMs >= 16000;

  // Dynamic Island status text
  let dynamicIslandText = "14ms latency";
  if (isTypingBubble1 || isTypingBubble2) {
    dynamicIslandText = "Dr. Aris typing...";
  } else if (isStudentSpeaking) {
    dynamicIslandText = "Voice Streaming 🎙";
  } else if (isEvaluating) {
    dynamicIslandText = "Scoring: 94% Depth";
  }

  const seconds = Math.floor(timeMs / 1000);
  const progressPercent = Math.min(100, (timeMs / TOTAL_DURATION_MS) * 100);

  return (
    <div className="w-full flex flex-col items-center">
      {/* ── Realistic iPhone Device Mockup ────────────────────────────── */}
      <div className="relative w-full max-w-[340px] sm:max-w-[360px] bg-[#1C1C1E] p-[10px] sm:p-[12px] rounded-[52px] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/20 transition-transform duration-300 hover:scale-[1.01]">
        
        {/* Side Hardware Buttons */}
        <div className="absolute -left-[3px] top-[115px] w-[3px] h-[26px] bg-[#3A3A3C] rounded-l-xs" />
        <div className="absolute -left-[3px] top-[155px] w-[3px] h-[50px] bg-[#3A3A3C] rounded-l-xs" />
        <div className="absolute -left-[3px] top-[215px] w-[3px] h-[50px] bg-[#3A3A3C] rounded-l-xs" />
        <div className="absolute -right-[3px] top-[165px] w-[3px] h-[65px] bg-[#3A3A3C] rounded-r-xs" />

        {/* iPhone Screen Glass */}
        <div className="w-full bg-[#FFFFFF] rounded-[42px] overflow-hidden flex flex-col h-[620px] sm:h-[660px] relative select-none">
          
          {/* iOS Status Bar + Dynamic Island */}
          <div className="h-10 px-6 pt-3 flex items-center justify-between shrink-0 z-20 bg-white">
            <span className="text-[12px] font-semibold text-[#1C1C1E] tracking-tight font-sans">9:41</span>
            
            {/* Dynamic Island with Live Video Simulation Status */}
            <div className="px-3 h-5 bg-black rounded-full flex items-center justify-center space-x-1.5 shadow-xs transition-all">
              <div className={`w-1.5 h-1.5 rounded-full ${isStudentSpeaking ? "bg-[#007AFF] animate-ping" : isEvaluating ? "bg-amber-400" : "bg-[#34C759] animate-pulse"}`} />
              <span className="text-[9px] font-mono font-medium text-white/90 truncate max-w-[110px]">
                {dynamicIslandText}
              </span>
              {isStudentSpeaking && (
                <div className="flex items-center space-x-0.5">
                  <span className="w-0.5 h-2 bg-white rounded-full animate-pulse" />
                  <span className="w-0.5 h-3 bg-white rounded-full animate-pulse delay-75" />
                  <span className="w-0.5 h-1.5 bg-white rounded-full animate-pulse delay-150" />
                </div>
              )}
            </div>

            <div className="flex items-center space-x-1.5 text-[#1C1C1E]">
              <span className="text-[10px] font-bold">5G</span>
              <div className="w-5 h-2.5 border border-[#1C1C1E] rounded-xs p-0.5 flex items-center">
                <div className="h-full w-3 bg-[#1C1C1E] rounded-2xs" />
              </div>
            </div>
          </div>

          {/* iMessage Header Bar with Video indicator */}
          <div className="px-4 py-2 border-b border-[#E5E5EA] flex items-center justify-between bg-[#F9F9FB]/90 backdrop-blur-md shrink-0">
            <div className="flex items-center space-x-0.5 text-[#007AFF]">
              <span className="text-base font-bold leading-none -mt-0.5">‹</span>
              <span className="text-[13px] font-medium">Messages</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  👨‍🏫
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#34C759] border border-white" />
              </div>
              <span className="text-[11px] font-semibold text-[#1C1C1E] mt-0.5">Dr. Aris (Examiner)</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-[#7D9F68] bg-[#f0fdf4] px-1.5 py-0.5 rounded-full border border-[#bbf7d0] font-bold">
                LIVE
              </span>
            </div>
          </div>

          {/* ── Conversation Stream (Auto-scrolling Live Video Simulation) ── */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FFFFFF] font-sans scroll-smooth">
            
            {/* Timestamp Header */}
            <div className="text-center py-0.5">
              <span className="text-[10px] font-medium text-[#8E8E93]">Today 9:41 AM</span>
            </div>

            {/* Bubble 1: Examiner Greeting */}
            {isBubble1Visible && (
              <div className="flex flex-col items-start max-w-[85%] space-y-1 animate-fadeIn">
                <div className="bg-[#E9E9EB] text-[#000000] text-[13.5px] leading-snug px-3.5 py-2.5 rounded-[18px] rounded-tl-[4px] shadow-2xs">
                  <p>⏰ It's study time!! u home now? i've got a practice quiz ready for u</p>
                </div>
              </div>
            )}

            {/* Examiner Typing Indicator for Message 1 */}
            {isTypingBubble1 && (
              <div className="flex items-center space-x-1.5 bg-[#E9E9EB] px-3.5 py-2.5 rounded-full w-fit shadow-xs animate-fadeIn">
                <span className="w-1.5 h-1.5 bg-[#8E8E93] rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-[#8E8E93] rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-[#8E8E93] rounded-full animate-bounce" />
              </div>
            )}

            {/* Bubble 2: Student Response */}
            {isBubble2Visible && (
              <div className="flex flex-col items-end ml-auto max-w-[85%] space-y-0.5 animate-fadeIn">
                <div className="bg-[#007AFF] text-white text-[13.5px] leading-snug px-3.5 py-2.5 rounded-[18px] rounded-tr-[4px] shadow-2xs">
                  <p>im home and ready</p>
                </div>
                <span className="text-[10px] text-[#8E8E93] pr-1 font-sans">Delivered</span>
              </div>
            )}

            {/* Examiner Typing Indicator for Problem 1 */}
            {isTypingBubble2 && (
              <div className="flex items-center space-x-1.5 bg-[#E9E9EB] px-3.5 py-2.5 rounded-full w-fit shadow-xs animate-fadeIn">
                <span className="w-1.5 h-1.5 bg-[#8E8E93] rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-[#8E8E93] rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-[#8E8E93] rounded-full animate-bounce" />
              </div>
            )}

            {/* Bubble 3: Examiner Problem 1 */}
            {isBubble3Visible && (
              <div className="flex flex-col items-start max-w-[88%] space-y-1 animate-fadeIn">
                <div className="bg-[#E9E9EB] text-[#000000] text-[13.5px] leading-snug px-3.5 py-2.5 rounded-[18px] rounded-tl-[4px] shadow-2xs">
                  <p>We'll begin with problem 1. Explain the fundamental difference between supervised and unsupervised machine learning.</p>
                </div>
              </div>
            )}

            {/* Bubble 4: Student Live Spoken Answer (Animated Live Voice Streaming) */}
            {isBubble4Visible && (
              <div className="flex flex-col items-end ml-auto max-w-[88%] space-y-0.5 animate-fadeIn">
                <div className="bg-[#007AFF] text-white text-[13px] leading-snug px-3.5 py-2.5 rounded-[18px] rounded-tr-[4px] shadow-2xs">
                  <p>
                    {currentSpokenText}
                    {isStudentSpeaking && (
                      <span className="inline-block w-1.5 h-3 bg-white ml-1 animate-pulse align-middle" />
                    )}
                  </p>
                </div>
                <span className="text-[10px] text-[#8E8E93] pr-1 font-sans flex items-center space-x-1">
                  {isStudentSpeaking ? (
                    <span className="text-[#007AFF] font-mono font-medium">● Speaking into mic...</span>
                  ) : (
                    <span>Delivered</span>
                  )}
                </span>
              </div>
            )}

            {/* Evaluating / Scoring Indicator */}
            {isEvaluating && (
              <div className="flex items-center space-x-1.5 bg-[#E9E9EB] px-3.5 py-2.5 rounded-full w-fit shadow-xs animate-fadeIn">
                <span className="w-1.5 h-1.5 bg-[#8E8E93] rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-[#8E8E93] rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-[#8E8E93] rounded-full animate-bounce" />
              </div>
            )}

            {/* Bubble 5: Adaptive Follow-up Probe */}
            {isBubble5Visible && (
              <div className="flex flex-col items-start max-w-[88%] space-y-1 animate-fadeIn">
                <div className="text-[9px] font-bold font-mono text-[#7D9F68] bg-[#f0fdf4] px-2 py-0.5 rounded-full border border-[#bbf7d0] w-fit">
                  ADAPTIVE FOLLOW-UP PROBE
                </div>
                <div className="bg-[#E9E9EB] text-[#000000] text-[13.5px] leading-snug px-3.5 py-2.5 rounded-[18px] rounded-tl-[4px] shadow-2xs">
                  <p>Good. Now give me a practical real-world scenario where semi-supervised learning is strictly preferred.</p>
                </div>

                {/* Blue typing indicator bubble */}
                <div className="flex items-center space-x-1.5 bg-[#007AFF] px-3 py-2 rounded-full w-fit mt-1 shadow-xs">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
                </div>
              </div>
            )}
          </div>

          {/* ── Bottom iMessage Input Bar with Simulated Typing ── */}
          <div className="bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#E5E5EA] px-3 py-2 flex items-center space-x-2 shrink-0">
            {/* Plus (+) Button */}
            <div className="w-7 h-7 rounded-full bg-[#E5E5EA] text-[#8E8E93] flex items-center justify-center text-sm font-semibold leading-none shrink-0">
              +
            </div>

            {/* Pill Input */}
            <div className="flex-1 bg-[#FFFFFF] border border-[#C7C7CC] rounded-full px-3 py-1.5 flex items-center justify-between shadow-2xs">
              <span className={`text-[13px] font-sans ${currentInputValue ? "text-black font-normal" : "text-[#8E8E93]"}`}>
                {currentInputValue || "iMessage"}
              </span>

              {/* Microphone icon / Wave */}
              {isStudentSpeaking ? (
                <div className="flex items-center space-x-0.5 px-1.5 py-0.5 bg-[#34C759] text-white rounded-full animate-pulse text-[10px]">
                  <Mic className="w-3 h-3" />
                </div>
              ) : (
                <Mic className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
              )}
            </div>

            {/* Blue Send Button when typing */}
            {currentInputValue && (
              <div className="w-7 h-7 rounded-full bg-[#007AFF] text-white flex items-center justify-center shadow-xs shrink-0 animate-fadeIn">
                <ArrowRight className="w-3.5 h-3.5 -rotate-90" />
              </div>
            )}
          </div>

          {/* Home Indicator Bar */}
          <div className="h-3.5 bg-white flex items-center justify-center shrink-0">
            <div className="w-28 h-1 bg-[#1C1C1E]/30 rounded-full" />
          </div>
        </div>
      </div>

    </div>
  );
}

export default function VIVORAEditorialHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Interactive Practice Drawer / Modal
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [selectedMode, setSelectedMode] = useState<"interview" | "college" | "school">("college");
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [jobRole, setJobRole] = useState("Frontend Developer");
  const [experienceLevel, setExperienceLevel] = useState("Mid-Level");
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

  const cleanDocumentSubject = (raw: string): string => {
    if (!raw) return "Computer Science";
    const clean = raw.replace(/\.[a-zA-Z0-9]+$/, "").replace(/[_\-]+/g, " ");
    const words = clean.split(/\s+/).filter(
      (w) =>
        !/^(exam|examination|notes|note|assignments|assignment|syllabus|manual|handout|module|chapter|unit|test|cheatsheet|guide|doc|pdf|file)$/i.test(
          w
        )
    );
    const result = words.join(" ").trim();
    return result.length >= 2 ? result : (clean.trim() || "Computer Science");
  };

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
      const activeMode = customMode || selectedMode;
      let sessionTitle = customTitle || title;
      if (activeMode === "interview") {
        sessionTitle = `${jobRole || "Professional"} Interview`;
      } else if (activeMode === "college") {
        const rawSubject = customTitle || title || (selectedFile ? selectedFile.name : "") || promptText || "College Viva Voce";
        sessionTitle = cleanDocumentSubject(rawSubject);
      } else {
        const rawSubject = customTitle || title || (selectedFile ? selectedFile.name : "") || promptText || "School Viva Practice";
        sessionTitle = cleanDocumentSubject(rawSubject);
      }

      let finalContent = customContent || contentText || promptText;
      if (activeMode === "interview") {
        finalContent = (contentText ? `Resume / Background:\n${contentText}\n\n` : "") + 
                       (promptText ? `Target Role Notes:\n${promptText}` : "");
        if (!finalContent.trim()) {
          finalContent = `Target Role: ${jobRole}`;
        }
      }

      const res = await createSession({
        title: sessionTitle,
        mode: activeMode,
        content_text: finalContent,
        document_id: uploadedDocumentId || undefined,
        job_role: activeMode === "interview" ? jobRole : undefined,
        experience_level: activeMode === "interview" ? experienceLevel : undefined,
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
      const docType = selectedMode === "interview" 
        ? "resume" 
        : (selectedMode === "school" ? "questions" : "syllabus");
      const rawName = file.name.replace(/\.[^/.]+$/, "").replace(/[_\-]+/g, " ");
      const cleanedSubject = cleanDocumentSubject(rawName);
      const docTitle = selectedMode === "interview" 
        ? `${jobRole || "Candidate"} Resume` 
        : cleanedSubject;

      const data = await uploadFileMaterial(file, docTitle, docType);
      setUploadedDocumentId(data.document_id);
      if (data.extracted_text) {
        setContentText(data.extracted_text);
      }
      if (selectedMode !== "interview") {
        setTitle(docTitle);
      }
      setPdfParsing(false);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to process PDF.");
      setPdfParsing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1a1b1e] selection:bg-[#2d4a3e]/15 selection:text-[#2d4a3e] relative font-sans">
      
      {/* ── FLOATING GLASSMORPHIC CAPSULE NAVBAR ───────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-3 sm:pt-4 px-3 sm:px-6 pointer-events-none transition-all duration-300">
        <div className="max-w-5xl mx-auto pointer-events-auto">
          
          {/* Main Floating Capsule */}
          <div className={`backdrop-blur-2xl border rounded-full px-4 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between transition-all duration-300 ${
            scrollY > 20 
              ? "bg-white/95 border-[#E2DFD6] shadow-[0_12px_36px_rgba(0,0,0,0.09),0_2px_6px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]" 
              : "bg-white/90 border-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.07),0_1px_3px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.03]"
          }`}>
            
            {/* Left: Brand Logo & Emblem (Flex-1 for balanced 3-column centering) */}
            <div className="flex items-center space-x-2.5 flex-1 justify-start">
              <Link href="/" className="flex items-center space-x-2.5 group">
                <div className="w-7 h-7 rounded-full bg-[#1C1C1E] flex items-center justify-center text-white text-xs font-mono group-hover:scale-105 transition-transform shadow-xs">
                  ✦
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-serif italic text-2xl text-[#1a1b1e] tracking-tight font-medium">
                    vivora
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide bg-[#7D9F68]/12 text-[#2d4a3e] border border-[#7D9F68]/25 uppercase">
                    AI VIVA
                  </span>
                </div>
              </Link>
            </div>

            {/* Center Navigation Links (Mathematically Centered in Navbar) */}
            <nav className="hidden md:flex items-center space-x-1 px-1.5 py-1 rounded-full bg-black/[0.03] border border-black/[0.03]">
              <a 
                href="#product" 
                className="px-3.5 py-1 rounded-full text-[13px] font-medium text-[#4f5259] hover:text-[#1a1b1e] hover:bg-white hover:shadow-2xs transition-all"
              >
                Product
              </a>
              <a 
                href="#how-it-works" 
                className="px-3.5 py-1 rounded-full text-[13px] font-medium text-[#4f5259] hover:text-[#1a1b1e] hover:bg-white hover:shadow-2xs transition-all"
              >
                How it works
              </a>
              <a 
                href="#use-cases" 
                className="px-3.5 py-1 rounded-full text-[13px] font-medium text-[#4f5259] hover:text-[#1a1b1e] hover:bg-white hover:shadow-2xs transition-all"
              >
                For Students
              </a>
              <a 
                href="#insights" 
                className="px-3.5 py-1 rounded-full text-[13px] font-medium text-[#4f5259] hover:text-[#1a1b1e] hover:bg-white hover:shadow-2xs transition-all"
              >
                Insights
              </a>
            </nav>

            {/* Right Action: User Status / Login / Get Started Button (Flex-1 to balance Left) */}
            <div className="hidden md:flex items-center space-x-3 flex-1 justify-end">
              {user ? (
                <div className="flex items-center space-x-2 bg-black/[0.03] pl-2 pr-3 py-1 rounded-full border border-black/[0.04]">
                  <div className="w-5 h-5 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center text-[10px] font-medium">
                    {user.name ? user.name[0].toUpperCase() : "U"}
                  </div>
                  <span className="text-xs text-[#3a3d42] font-medium max-w-[100px] truncate">{user.name}</span>
                  <button
                    onClick={() => {
                      clearAuthToken();
                      setUser(null);
                    }}
                    className="text-[11px] text-[#5A5D64] hover:text-[#1a1b1e] transition-colors ml-1"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link 
                  href="/login" 
                  className="px-3 py-1 text-[13px] font-medium text-[#4f5259] hover:text-[#1a1b1e] transition-colors rounded-full hover:bg-black/[0.03]"
                >
                  Login
                </Link>
              )}

              <button
                onClick={() => setShowSetupModal(true)}
                className="px-4 py-2 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] text-white text-[13px] font-medium transition-all shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.18)] flex items-center space-x-1.5 group active:scale-95 shrink-0"
              >
                <span>Get started</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Mobile Hamburger Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-[#1a1b1e] rounded-full hover:bg-black/[0.04] transition-colors ml-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile Dropdown Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-2 bg-white/95 backdrop-blur-xl border border-[#DDD9CF] rounded-2xl p-4 shadow-xl space-y-3 animate-fadeIn text-sm">
              <a href="#product" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 px-2 rounded-lg hover:bg-black/[0.04] text-[#5c5f66] font-medium">Product</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 px-2 rounded-lg hover:bg-black/[0.04] text-[#5c5f66] font-medium">How it works</a>
              <a href="#use-cases" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 px-2 rounded-lg hover:bg-black/[0.04] text-[#5c5f66] font-medium">For Students</a>
              <a href="#insights" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 px-2 rounded-lg hover:bg-black/[0.04] text-[#5c5f66] font-medium">Insights</a>
              <div className="pt-2 border-t border-[#EBE7DD] flex items-center justify-between">
                {user ? (
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-[#3a3d42] font-medium">{user.name}</span>
                    <button
                      onClick={() => {
                        clearAuthToken();
                        setUser(null);
                        setMobileMenuOpen(false);
                      }}
                      className="text-[#5A5D64] hover:text-[#1a1b1e]"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <Link href="/login" className="text-[#5c5f66] font-medium">Login</Link>
                )}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowSetupModal(true);
                  }}
                  className="px-4 py-2 rounded-full bg-[#20211E] text-white text-xs font-medium flex items-center space-x-1"
                >
                  <span>Get started</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <section className="pt-28 md:pt-36 pb-16 md:pb-24 px-6 relative overflow-hidden">
        
        {/* Atmospheric Mountain Background (Cinematic Misty Valley & Morning Ridge) */}
        <div 
          className="nature-memory-layer nature-mask-hero animate-nature-drift inset-0 top-0 h-[760px] md:h-[860px] w-full"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=2400&q=90')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 22%',
            opacity: 0.92,
            transform: `translate3d(0, ${scrollY * 0.05}px, 0)`,
          }}
        />
        
        {/* Soft atmospheric gradient wash ensuring flawless text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/20 via-transparent to-[#FAF9F5] pointer-events-none z-0" />
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#FAF9F5] via-[#FAF9F5]/85 to-transparent pointer-events-none z-0" />

        {/* ── 2-COLUMN HERO LAYOUT: COPY (LEFT) & LAPTOP MOCKUP (RIGHT) ─────── */}
        <div className="max-w-[1400px] mx-auto relative z-10 pt-2 lg:pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 xl:gap-12 items-center">
            
            {/* Left Column: Hero Editorial Copy & Actions (5 cols) */}
            <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
              
              {/* Announcement pill */}
              <div className="inline-flex items-center space-x-2 px-4 py-1 rounded-full bg-[#FAF9F5]/90 backdrop-blur-md border border-[#DDD9CF] text-[11px] font-mono uppercase tracking-widest text-[#4a5043] shadow-xs">
                <span className="text-[#7D9F68]">✦</span>
                <span>CREDIBILITY • DISCIPLINE • COMMUNICATION</span>
              </div>

              {/* Editorial Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[44px] xl:text-[54px] 2xl:text-[60px] font-serif font-normal text-[#20211E] tracking-tight leading-[1.08]">
                Your next answer<br />
                <span className="italic font-normal">starts here.</span>
              </h1>

              {/* Supporting Copy */}
              <p className="text-sm sm:text-base xl:text-lg text-[#555850] max-w-lg font-normal leading-relaxed">
                Study. Practice. Speak. Improve.<br className="hidden sm:inline" />
                Enter your viva with clarity and effortless intellectual composure.
              </p>

              {/* Primary CTA Button */}
              <div className="pt-1 flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => setShowSetupModal(true)}
                  className="px-8 py-3.5 rounded-full bg-[#20211E] hover:bg-[#343631] text-white text-[14px] font-medium shadow-md hover:shadow-lg transition-all flex items-center space-x-2.5 group"
                >
                  <span>Try VIVORA free</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </div>

              {/* Trust points row */}
              <div className="pt-1 text-[11px] font-mono text-[#787c74] flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3">
                <span>No credit card required</span>
                <span>•</span>
                <span>Instant syllabus ingestion</span>
                <span>•</span>
                <span>5 deep-memory viva defenses</span>
              </div>
            </div>

            {/* Right Column: Hero Laptop Screen Mockup (Animated Live Video Simulator) */}
            <HeroLaptopVideoSimulator onLaunch={() => setShowSetupModal(true)} />

          </div>
        </div>
      </section>

      {/* ── SECTION 2: PRODUCT VALUE ────────────────────────────────────────── */}
      <section className="py-24 md:py-32 px-6 border-t border-[#EBE7DD] bg-[#FAF9F5] relative overflow-hidden">
        
        {/* Atmospheric Nature Layer (Morning Forest Canopy & Sunbeams) */}
        <div 
          className="nature-memory-layer nature-mask-full animate-nature-drift-reverse inset-0 w-full h-full"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=85')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
            opacity: 0.58,
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
            <p className="text-base text-[#555850] leading-relaxed">
              VIVORA brings preparation, practice, feedback, and confidence into one intelligent workspace.
            </p>
          </div>

          {/* 3 Step Editorial Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* 01 - Learn */}
            <div className="glass-card rounded-3xl p-7 space-y-6 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300">
              <div className="space-y-4">
                <span className="font-mono text-xs text-[#5A5D64] font-semibold">01 — LEARN</span>
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
            <div className="glass-card rounded-3xl p-7 space-y-6 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300">
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
            <div className="glass-card rounded-3xl p-7 space-y-6 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300">
              <div className="space-y-4">
                <span className="font-mono text-xs text-[#5A5D64] font-semibold">03 — IMPROVE</span>
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
      <section className="py-24 md:py-32 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD] relative overflow-hidden">
        
        {/* Atmospheric Nature Layer (Misty Mountain Forest & Quiet Mist) */}
        <div 
          className="nature-memory-layer nature-mask-full animate-nature-drift inset-0 w-full h-full"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=2400&q=85')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 45%',
            opacity: 0.62,
            transform: `translate3d(0, ${(scrollY - 1000) * 0.04}px, 0)`,
          }}
        />

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          
          <div className="lg:col-span-5 space-y-6">
            {/* Radiant Category Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#7D9F68]/12 border border-[#7D9F68]/30 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7D9F68] animate-pulse" />
              <span className="text-xs font-mono text-[#243c32] uppercase tracking-widest font-bold">
                Adaptive Oral Defense
              </span>
            </div>

            {/* High-Impact Headline with Rich Font Effects */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[64px] font-serif font-normal tracking-tight leading-[1.06]">
              <span className="bg-gradient-to-br from-[#111215] via-[#20211E] to-[#454740] bg-clip-text text-transparent drop-shadow-[0_1px_2px_rgba(0,0,0,0.06)] block">
                Not another chatbot.
              </span>
              <span className="italic font-normal bg-gradient-to-r from-[#244b34] via-[#4d7a3f] to-[#7D9F68] bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(125,159,104,0.28)] block mt-1">
                A real conversation.
              </span>
            </h2>

            {/* Elevated Editorial Body Copy */}
            <p className="text-base sm:text-lg text-[#555850] font-sans font-normal leading-relaxed max-w-lg">
              VIVORA listens, asks follow-up questions, adapts to your answers, and helps you practice under real conversational pressure.
            </p>

            {/* Interactive Primary CTA Button */}
            <div className="pt-2">
              <button
                onClick={() => setShowSetupModal(true)}
                className="px-7 py-3 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] text-white text-sm font-medium shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.24)] flex items-center space-x-2.5 transition-all group active:scale-95 ring-1 ring-white/10"
              >
                <span>Start a Viva</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Interactive Mobile Chat Video Simulator */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center py-4">
            <MobileChatVideoSimulator />
          </div>
        </div>
      </section>

      {/* ── SECTION 4: LIVES WHERE YOU STUDY ─────────────────────────────────── */}
      <section className="py-24 md:py-32 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD] relative overflow-hidden">
        
        {/* Soft Ambient Radial Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-[#7D9F68]/8 via-[#7D9F68]/4 to-transparent blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto text-center space-y-12 relative z-10">
          
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Section Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#7D9F68]/12 border border-[#7D9F68]/30 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7D9F68] animate-pulse" />
              <span className="text-xs font-mono text-[#243c32] uppercase tracking-widest font-bold">
                Anywhere Study Companion
              </span>
            </div>

            {/* High-Impact Headline with Rich Font Scale & Effects */}
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-[56px] font-serif font-normal tracking-tight leading-[1.08]">
              <span className="bg-gradient-to-br from-[#121316] via-[#20211E] to-[#454840] bg-clip-text text-transparent block sm:inline">
                Your preparation doesn't have to{" "}
              </span>
              <span className="italic font-normal bg-gradient-to-r from-[#244b34] via-[#4d7a3f] to-[#7D9F68] bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(125,159,104,0.28)]">
                stay in one tab.
              </span>
            </h2>

            {/* Elevated Paragraph */}
            <p className="text-base sm:text-lg text-[#555850] font-sans font-normal leading-relaxed max-w-xl mx-auto pt-1">
              Drill concepts on your phone, rehearse interview answers during walks, or review analytics between classes.
            </p>
          </div>

          {/* 3 Luxury Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-4">
            
            {/* Card 1: Daily Drills */}
            <div className="bg-white/95 backdrop-blur-md border border-[#E5E2D9] p-7 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:border-[#7D9F68]/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between space-y-5 relative group overflow-hidden">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#244b34] font-bold tracking-wider bg-[#f0fdf4] px-2.5 py-1 rounded-full border border-[#bbf7d0]">
                    01 • DAILY DRILLS
                  </span>
                  <span className="text-xs text-[#7D9F68] font-mono">2 min</span>
                </div>
                <h4 className="text-lg font-bold text-[#1C1C1E] tracking-tight group-hover:text-[#244b34] transition-colors">
                  Bite-sized Viva Questions
                </h4>
                <p className="text-sm text-[#555850] leading-relaxed font-sans">
                  Receive 2-minute quick-fire concept challenges on your phone to maintain recall before exam week.
                </p>
              </div>

              <div className="pt-3 border-t border-[#F0ECE1] flex items-center text-xs text-[#7D9F68] font-medium font-mono">
                <span>Adaptive mobile drills →</span>
              </div>
            </div>

            {/* Card 2: Voice Rehearsal */}
            <div className="bg-white/95 backdrop-blur-md border border-[#E5E2D9] p-7 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:border-[#7D9F68]/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between space-y-5 relative group overflow-hidden">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#244b34] font-bold tracking-wider bg-[#f0fdf4] px-2.5 py-1 rounded-full border border-[#bbf7d0]">
                    02 • VOICE REHEARSAL
                  </span>
                  <span className="text-xs text-[#7D9F68] font-mono">Hands-Free</span>
                </div>
                <h4 className="text-lg font-bold text-[#1C1C1E] tracking-tight group-hover:text-[#244b34] transition-colors">
                  Hands-Free Oral Practice
                </h4>
                <p className="text-sm text-[#555850] leading-relaxed font-sans">
                  Answer questions out loud without touching your keyboard. The Web Speech engine transcribes seamlessly.
                </p>
              </div>

              <div className="pt-3 border-t border-[#F0ECE1] flex items-center text-xs text-[#7D9F68] font-medium font-mono">
                <span>Real-time voice stream →</span>
              </div>
            </div>

            {/* Card 3: Weak Topic Alerts */}
            <div className="bg-white/95 backdrop-blur-md border border-[#E5E2D9] p-7 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:border-[#7D9F68]/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between space-y-5 relative group overflow-hidden">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#244b34] font-bold tracking-wider bg-[#f0fdf4] px-2.5 py-1 rounded-full border border-[#bbf7d0]">
                    03 • WEAK TOPIC ALERTS
                  </span>
                  <span className="text-xs text-[#7D9F68] font-mono">Smart Recall</span>
                </div>
                <h4 className="text-lg font-bold text-[#1C1C1E] tracking-tight group-hover:text-[#244b34] transition-colors">
                  Smart Concept Spaced Recall
                </h4>
                <p className="text-sm text-[#555850] leading-relaxed font-sans">
                  VIVORA surfaces questions on topics where your depth or clarity scores were low during previous rounds.
                </p>
              </div>

              <div className="pt-3 border-t border-[#F0ECE1] flex items-center text-xs text-[#7D9F68] font-medium font-mono">
                <span>Personalized analytics →</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 5: PERFORMANCE & INSIGHTS ────────────────────────────────── */}
      <section id="insights" className="py-24 md:py-32 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD] relative overflow-hidden">
        
        {/* Full-Bleed Atmospheric Mountain Ridge Background */}
        <div 
          className="nature-memory-layer nature-mask-full animate-nature-drift-reverse inset-0 w-full h-full"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2400&q=85')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
            opacity: 0.65,
            transform: `translate3d(0, ${(scrollY - 2000) * 0.04}px, 0)`,
          }}
        />

        {/* Ambient atmospheric gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FAF9F5]/70 via-transparent to-[#FAF9F5]/60 pointer-events-none z-0" />
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#FAF9F5] to-transparent pointer-events-none z-0" />

        <div className="max-w-5xl mx-auto space-y-14 relative z-10">
          
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-mono text-[#7D9F68] uppercase tracking-wider font-semibold flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#7D9F68] animate-pulse" />
              <span>Analytics & Readiness</span>
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#20211E] tracking-tight leading-tight">
              From "I think I know it"<br />
              <span className="italic text-[#7D9F68]">to "I can explain it."</span>
            </h2>
            <p className="text-base text-[#555850] leading-relaxed">
              Understand where your verbal explanations falter and bridge gaps before stepping in front of professors or interview panels.
            </p>
          </div>

          {/* Glassmorphic Metric Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#5A5D64]">
                <span>CONCEPT MASTERY</span>
                <span className="w-2 h-2 rounded-full bg-[#7D9F68]" />
              </div>
              <div className="text-3xl font-serif font-bold text-[#20211E]">94%</div>
              <div className="w-full bg-[#E5E0D4] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#20211E] h-full rounded-full w-[94%]" />
              </div>
              <p className="text-[11px] text-[#6F7069]">Invariants & definitions verified</p>
            </div>

            <div className="glass-card p-5 rounded-2xl shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#5A5D64]">
                <span>VIVA READINESS</span>
                <span className="w-2 h-2 rounded-full bg-[#7D9F68]" />
              </div>
              <div className="text-3xl font-serif font-bold text-[#7D9F68]">High (88%)</div>
              <div className="w-full bg-[#E5E0D4] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#7D9F68] h-full rounded-full w-[88%]" />
              </div>
              <p className="text-[11px] text-[#6F7069]">Confidence across 14 modules</p>
            </div>

            <div className="glass-card p-5 rounded-2xl shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#5A5D64]">
                <span>SPEAKING CLARITY</span>
                <span className="w-2 h-2 rounded-full bg-[#7D9F68]" />
              </div>
              <div className="text-3xl font-serif font-bold text-[#20211E]">91%</div>
              <div className="w-full bg-[#E5E0D4] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#20211E] h-full rounded-full w-[91%]" />
              </div>
              <p className="text-[11px] text-[#6F7069]">Pacing (142 WPM) & minimal fillers</p>
            </div>

            <div className="glass-card p-5 rounded-2xl shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#5A5D64]">
                <span>PRACTICE STREAK</span>
                <span className="w-2 h-2 rounded-full bg-[#7D9F68]" />
              </div>
              <div className="text-3xl font-serif font-bold text-[#7D9F68]">6 Days</div>
              <div className="w-full bg-[#E5E0D4] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#7D9F68] h-full rounded-full w-[60%]" />
              </div>
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
      <section className="py-24 md:py-32 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD] relative overflow-hidden">
        
        {/* Soft Ambient Background Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-[#7D9F68]/10 via-[#7D9F68]/5 to-transparent blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto text-center space-y-12 relative z-10">
          
          {/* Section Pill Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#7D9F68]/12 border border-[#7D9F68]/30 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7D9F68] animate-pulse" />
            <span className="text-xs font-mono text-[#243c32] uppercase tracking-widest font-bold">
              Candidate Voices & Research Defense
            </span>
          </div>

          {/* Statement Headline with Rich Font Scale & Effects */}
          <div className="max-w-4xl mx-auto relative">
            <Quote className="w-12 h-12 text-[#7D9F68]/20 absolute -top-8 -left-4 sm:-left-8 -rotate-12 pointer-events-none" />
            <blockquote className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-serif font-normal tracking-tight leading-[1.12]">
              <span className="bg-gradient-to-br from-[#121316] via-[#20211E] to-[#454840] bg-clip-text text-transparent">
                "Preparation feels completely different when you can{" "}
              </span>
              <span className="italic font-normal bg-gradient-to-r from-[#244b34] via-[#4d7a3f] to-[#7D9F68] bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(125,159,104,0.3)]">
                practice the conversation
              </span>
              <span className="bg-gradient-to-br from-[#121316] via-[#20211E] to-[#454840] bg-clip-text text-transparent">
                {" "}before it happens."
              </span>
            </blockquote>
          </div>

          {/* 3 Luxury Testimonial Proof Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-6">
            
            {/* Card 1: Elena Rostova */}
            <div className="bg-white/95 backdrop-blur-md border border-[#E5E2D9] p-6 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:border-[#7D9F68]/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between space-y-5 relative group overflow-hidden">
              <Quote className="w-16 h-16 text-[#7D9F68]/5 absolute top-2 right-2 pointer-events-none group-hover:text-[#7D9F68]/10 transition-colors" />
              
              <div className="space-y-3">
                {/* 5 Stars Rating & Institution Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1 text-[#7D9F68]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#7D9F68] text-[#7D9F68]" />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#244b34] border border-[#bbf7d0]">
                    Cambridge
                  </span>
                </div>

                <p className="text-[14px] text-[#33363F] font-serif leading-relaxed italic">
                  "Practicing PBFT view-change questions on Vivora helped me pass my PhD qualifying oral exam without freezing on follow-up probes."
                </p>
              </div>

              {/* Author Profile */}
              <div className="flex items-center space-x-3 pt-3 border-t border-[#F0ECE1]">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2d4a3e] to-[#7D9F68] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  ER
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#1C1C1E] flex items-center space-x-1">
                    <span>Elena Rostova</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#7D9F68] shrink-0" />
                  </div>
                  <div className="text-[11px] text-[#70756b] truncate">PhD Candidate in Distributed Systems</div>
                </div>
              </div>
            </div>

            {/* Card 2: Marcus Vance */}
            <div className="bg-white/95 backdrop-blur-md border border-[#E5E2D9] p-6 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:border-[#7D9F68]/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between space-y-5 relative group overflow-hidden">
              <Quote className="w-16 h-16 text-[#7D9F68]/5 absolute top-2 right-2 pointer-events-none group-hover:text-[#7D9F68]/10 transition-colors" />
              
              <div className="space-y-3">
                {/* 5 Stars Rating & Institution Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1 text-[#7D9F68]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#7D9F68] text-[#7D9F68]" />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#244b34] border border-[#bbf7d0]">
                    Placement
                  </span>
                </div>

                <p className="text-[14px] text-[#33363F] font-serif leading-relaxed italic">
                  "The live whiteboard with audio feedback felt exactly like my final rounds at top tech firms. The confidence boost was huge."
                </p>
              </div>

              {/* Author Profile */}
              <div className="flex items-center space-x-3 pt-3 border-t border-[#F0ECE1]">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1C1C1E] to-[#454740] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  MV
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#1C1C1E] flex items-center space-x-1">
                    <span>Marcus Vance</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#7D9F68] shrink-0" />
                  </div>
                  <div className="text-[11px] text-[#70756b] truncate">Final Year B.Tech SWE</div>
                </div>
              </div>
            </div>

            {/* Card 3: Priya Sharma */}
            <div className="bg-white/95 backdrop-blur-md border border-[#E5E2D9] p-6 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:border-[#7D9F68]/40 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between space-y-5 relative group overflow-hidden">
              <Quote className="w-16 h-16 text-[#7D9F68]/5 absolute top-2 right-2 pointer-events-none group-hover:text-[#7D9F68]/10 transition-colors" />
              
              <div className="space-y-3">
                {/* 5 Stars Rating & Institution Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1 text-[#7D9F68]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#7D9F68] text-[#7D9F68]" />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#244b34] border border-[#bbf7d0]">
                    ETH Zürich
                  </span>
                </div>

                <p className="text-[14px] text-[#33363F] font-serif leading-relaxed italic">
                  "Being able to drop a biology chapter PDF and immediately get drilled on photosynthesis mechanisms transformed my revision."
                </p>
              </div>

              {/* Author Profile */}
              <div className="flex items-center space-x-3 pt-3 border-t border-[#F0ECE1]">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#3b572a] to-[#2d4a3e] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  PS
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#1C1C1E] flex items-center space-x-1">
                    <span>Priya Sharma</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#7D9F68] shrink-0" />
                  </div>
                  <div className="text-[11px] text-[#70756b] truncate">Master of Science • ETH Zürich</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 8: FINAL CINEMATIC CTA ──────────────────────────────────── */}
      <section className="py-28 md:py-36 px-6 bg-[#FAF9F5] border-t border-[#EBE7DD] relative overflow-hidden">
        
        {/* Atmospheric Nature Layer (Grand Alpine Sunrise & Morning Mist) */}
        <div 
          className="nature-memory-layer nature-mask-cta animate-nature-drift inset-0 h-full w-full"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=2400&q=90')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 38%',
            opacity: 0.82,
            transform: `translate3d(0, ${(scrollY - 2800) * 0.04}px, 0)`,
          }}
        />

        {/* Ambient atmospheric warm glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAF9F5]/40 via-transparent to-[#FAF9F5]/30 pointer-events-none z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[350px] bg-gradient-to-r from-[#FAF9F5]/80 via-[#FAF9F5]/50 to-[#FAF9F5]/80 blur-2xl pointer-events-none rounded-full z-0" />

        <div className="max-w-3xl mx-auto text-center space-y-6 relative z-10">
          
          {/* Announcement pill */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#DDD9CF] text-[11px] font-mono uppercase tracking-widest text-[#4a5043] shadow-xs">
            <span className="text-[#7D9F68]">✦</span>
            <span>BECOME UNSTOPPABLE IN YOUR NEXT VIVA</span>
          </div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-serif font-normal text-[#20211E] tracking-tight leading-[1.08]">
            Your next answer<br />
            <span className="italic">starts here.</span>
          </h2>

          <p className="text-base sm:text-lg font-serif italic text-[#4a4d45]">
            Study. Practice. Speak. Improve.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-8 py-3.5 rounded-full bg-[#20211E] hover:bg-[#343631] text-white text-sm font-medium shadow-[0_10px_30px_rgba(32,33,30,0.25)] hover:shadow-[0_15px_35px_rgba(32,33,30,0.35)] transition-all flex items-center space-x-2 group"
            >
              <span>Try VIVORA free</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>

          <div className="pt-2 text-[11px] font-mono text-[#6F7069]">
            Free practice sessions included • No payment required
          </div>
        </div>
      </section>

      {/* ── LUXURY EDITORIAL FOOTER ────────────────────────────────────────── */}
      <footer className="bg-white border-t border-[#EBE7DD] pt-20 pb-12 px-6 text-sm text-[#555850] relative overflow-hidden">
        
        {/* Soft background ambient accent */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[250px] bg-gradient-to-b from-[#7D9F68]/5 to-transparent blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 relative z-10">
          
          {/* Brand & Mission Column (5 cols) */}
          <div className="md:col-span-5 space-y-5">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-8 h-8 rounded-full bg-[#1C1C1E] flex items-center justify-center text-white text-xs font-mono group-hover:scale-105 transition-transform shadow-xs">
                ✦
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-serif italic text-2xl text-[#1a1b1e] tracking-tight font-medium">
                  vivora
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider bg-[#7D9F68]/12 text-[#2d4a3e] border border-[#7D9F68]/25 uppercase">
                  AI VIVA
                </span>
              </div>
            </Link>

            <p className="text-sm text-[#555850] font-sans leading-relaxed max-w-sm">
              AI-powered viva and oral interview preparation platform for students and candidates who want to think clearly, speak confidently, and defend ideas under real conversational pressure.
            </p>

            {/* Privacy & Engine Badge */}
            <div className="pt-1 flex flex-wrap gap-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] text-xs font-mono text-[#244b34] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
                <span>Zero Audio Stored on Disk</span>
              </div>

              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#DDD9CF] text-xs font-mono text-[#555850]">
                <span>14ms Latency Engine</span>
              </div>
            </div>
          </div>

          {/* Links Column: Product (2 cols) */}
          <div className="md:col-span-2 space-y-4">
            <div className="font-mono text-xs font-bold text-[#1a1b1e] uppercase tracking-wider">
              Product
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button onClick={() => setShowSetupModal(true)} className="hover:text-[#1a1b1e] transition-colors hover:translate-x-0.5 duration-150 flex items-center">
                  AI Study Mode
                </button>
              </li>
              <li>
                <button onClick={() => setShowSetupModal(true)} className="hover:text-[#1a1b1e] transition-colors hover:translate-x-0.5 duration-150 flex items-center">
                  Oral Viva Simulator
                </button>
              </li>
              <li>
                <button onClick={() => setShowSetupModal(true)} className="hover:text-[#1a1b1e] transition-colors hover:translate-x-0.5 duration-150 flex items-center">
                  Interview Practice
                </button>
              </li>
              <li>
                <a href="#insights" className="hover:text-[#1a1b1e] transition-colors hover:translate-x-0.5 duration-150 flex items-center">
                  Performance Insights
                </a>
              </li>
            </ul>
          </div>

          {/* Links Column: Resources (2 cols) */}
          <div className="md:col-span-2 space-y-4">
            <div className="font-mono text-xs font-bold text-[#1a1b1e] uppercase tracking-wider">
              Resources
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#how-it-works" className="hover:text-[#1a1b1e] transition-colors hover:translate-x-0.5 duration-150 flex items-center">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#use-cases" className="hover:text-[#1a1b1e] transition-colors hover:translate-x-0.5 duration-150 flex items-center">
                  Student Case Studies
                </a>
              </li>
              <li>
                <a href="#product" className="hover:text-[#1a1b1e] transition-colors hover:translate-x-0.5 duration-150 flex items-center">
                  Rubric Scoring Guide
                </a>
              </li>
              <li>
                <a href="#product" className="hover:text-[#1a1b1e] transition-colors hover:translate-x-0.5 duration-150 flex items-center">
                  Audio Help Center
                </a>
              </li>
            </ul>
          </div>

          {/* Links Column: Company & Legal (3 cols) */}
          <div className="md:col-span-3 space-y-4">
            <div className="font-mono text-xs font-bold text-[#1a1b1e] uppercase tracking-wider">
              Platform & Legal
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <span className="hover:text-[#1a1b1e] cursor-pointer transition-colors hover:translate-x-0.5 duration-150 inline-block">
                  About VIVORA Architecture
                </span>
              </li>
              <li>
                <span className="hover:text-[#1a1b1e] cursor-pointer transition-colors hover:translate-x-0.5 duration-150 inline-block">
                  Privacy Policy & COPPA Compliance
                </span>
              </li>
              <li>
                <span className="hover:text-[#1a1b1e] cursor-pointer transition-colors hover:translate-x-0.5 duration-150 inline-block">
                  Terms of Service & Licensing
                </span>
              </li>
              <li>
                <span className="hover:text-[#1a1b1e] cursor-pointer transition-colors hover:translate-x-0.5 duration-150 inline-block">
                  Security & LLM Safety Guards
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright & Guarantee Bar */}
        <div className="max-w-6xl mx-auto pt-8 mt-12 border-t border-[#EBE7DD] flex flex-col sm:flex-row items-center justify-between text-xs text-[#5A5D64] gap-4">
          <div className="flex items-center space-x-2">
            <span>© 2026 VIVORA AI Technologies. All rights reserved.</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] font-mono">
            <span>Next.js 15 App Router</span>
            <span>•</span>
            <span>FastAPI Real-time Engine</span>
            <span>•</span>
            <span className="text-[#244b34] font-medium">100% Privacy-Preserving</span>
          </div>
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
              <button onClick={() => setShowSetupModal(false)} className="text-[#5A5D64] hover:text-[#1a1b1e]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3 Distinct Agent Modes */}
            <div className="grid grid-cols-3 gap-2 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setSelectedMode("school");
                  if (!selectedFile) {
                    setTitle("");
                    setContentText("");
                  }
                  setError(null);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  selectedMode === "school"
                    ? "bg-[#2d4a3e] text-white border-[#2d4a3e] shadow-xs"
                    : "bg-[#FAF9F5] text-[#5c5f66] border-[#EBE7DD] hover:border-[#D6D0C2]"
                }`}
              >
                🏫 School Viva
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMode("college");
                  if (!selectedFile) {
                    setTitle("");
                    setContentText("");
                  }
                  setError(null);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  selectedMode === "college"
                    ? "bg-[#2d4a3e] text-white border-[#2d4a3e] shadow-xs"
                    : "bg-[#FAF9F5] text-[#5c5f66] border-[#EBE7DD] hover:border-[#D6D0C2]"
                }`}
              >
                🎓 College Viva
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMode("interview");
                  setJobRole("Frontend Developer");
                  if (!selectedFile) {
                    setContentText("");
                  }
                  setError(null);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  selectedMode === "interview"
                    ? "bg-[#2d4a3e] text-white border-[#2d4a3e] shadow-xs"
                    : "bg-[#FAF9F5] text-[#5c5f66] border-[#EBE7DD] hover:border-[#D6D0C2]"
                }`}
              >
                💼 Job Interview
              </button>
            </div>

            {/* Mode Description Banner */}
            <div className="p-3 rounded-2xl bg-[#F4F1EA] border border-[#EBE7DD] text-xs text-[#555850] space-y-1">
              {selectedMode === "school" && (
                <>
                  <div className="font-semibold text-[#2d4a3e]">🏫 School Viva Agent</div>
                  <div>Upload textbook Q&A, study notes, or syllabus (PDF or text). AI asks direct viva questions to test your knowledge with simple, encouraging evaluation.</div>
                </>
              )}
              {selectedMode === "college" && (
                <>
                  <div className="font-semibold text-[#2d4a3e]">🎓 College Viva Agent</div>
                  <div>Upload textbook chapters, syllabus outline, or lab practicals (PDF or text). Gemini prepares conceptual viva questions with targeted cross-examination (*"Why this, why not that?"*).</div>
                </>
              )}
              {selectedMode === "interview" && (
                <>
                  <div className="font-semibold text-[#2d4a3e]">💼 Job Interview Agent</div>
                  <div>Upload your Resume (PDF) and enter the Target Role applied for. AI asks questions tailored specifically to your real resume projects, background, and role.</div>
                </>
              )}
            </div>

            {/* Inputs Tailored to Mode */}
            {selectedMode === "interview" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#5A5D64] uppercase">Target Job Role Applied For *</label>
                  <input
                    type="text"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g. Frontend React Developer, Python Backend Engineer, Data Scientist, Product Manager..."
                    className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl px-3.5 py-2.5 text-xs text-[#1a1b1e] focus:outline-none focus:border-[#2d4a3e]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#5A5D64] uppercase">Experience Level</label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {["Entry-Level / Fresher", "Mid-Level (2-5 yrs)", "Senior / Lead (5+ yrs)"].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setExperienceLevel(lvl.split(" ")[0])}
                        className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                          experienceLevel === lvl.split(" ")[0]
                            ? "bg-[#2d4a3e] text-white border-[#2d4a3e]"
                            : "bg-[#FAF9F5] text-[#5c5f66] border-[#EBE7DD]"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resume PDF Attachment */}
                <div className="space-y-1 pt-1">
                  <label className="flex items-center justify-between p-3 rounded-xl border border-dashed border-[#2d4a3e]/40 bg-[#FAF9F5] hover:bg-[#F4F1EA] cursor-pointer transition-colors">
                    <div className="flex items-center space-x-2 text-xs font-medium text-[#2d4a3e]">
                      <UploadCloud className="w-4 h-4" />
                      <span>{pdfParsing ? "Parsing Resume PDF..." : "📄 Attach Resume (PDF)"}</span>
                    </div>
                    <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {selectedFile && (
                    <div className="text-[11px] font-mono text-[#2d4a3e] flex items-center justify-between px-2 pt-1">
                      <span className="truncate">✓ Attached: {selectedFile.name}</span>
                      <button type="button" onClick={() => setSelectedFile(null)} className="text-red-500 hover:underline ml-2">Remove</button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-[#5A5D64] uppercase">Focus Areas (Optional)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {["System Design", "DSA", "React / Frontend", "SQL & DBs", "Behavioural", "ML / AI"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setPromptText(promptText.includes(tag) ? promptText.replace(tag, "").replace(/,\s*/g, ", ").trim().replace(/^,|,$/g, "").trim() : (promptText ? `${promptText}, ${tag}` : tag))}
                        className={`px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                          promptText.includes(tag)
                            ? "bg-[#2d4a3e] text-white border-[#2d4a3e]"
                            : "bg-[#FAF9F5] text-[#5c5f66] border-[#EBE7DD] hover:border-[#2d4a3e]/40"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Or type custom focus areas..."
                    className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl px-3.5 py-2 text-xs text-[#1a1b1e] focus:outline-none focus:border-[#2d4a3e]"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#5A5D64] uppercase">
                    {selectedMode === "school" ? "Chapter / Subject Name" : "Subject & Syllabus / Lab Topic"}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={selectedMode === "school" ? "e.g. Class 10 Biology — Life Processes" : "e.g. Operating Systems: Process Synchronization"}
                    className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl px-3.5 py-2.5 text-xs text-[#1a1b1e] focus:outline-none focus:border-[#2d4a3e]"
                  />
                </div>

                {/* PDF Attachment Option */}
                <div className="space-y-1">
                  <label className="flex items-center justify-between p-3 rounded-xl border border-dashed border-[#2d4a3e]/40 bg-[#FAF9F5] hover:bg-[#F4F1EA] cursor-pointer transition-colors">
                    <div className="flex items-center space-x-2 text-xs font-medium text-[#2d4a3e]">
                      <UploadCloud className="w-4 h-4" />
                      <span>
                        {pdfParsing
                          ? "Parsing PDF..."
                          : selectedMode === "school"
                          ? "📄 Attach Textbook / Q&A Notes (PDF)"
                          : "📄 Attach Textbook Chapter / Lab Manual (PDF)"}
                      </span>
                    </div>
                    <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {selectedFile && (
                    <div className="text-[11px] font-mono text-[#2d4a3e] flex items-center justify-between px-2 pt-1">
                      <span className="truncate">✓ Attached: {selectedFile.name}</span>
                      <button type="button" onClick={() => setSelectedFile(null)} className="text-red-500 hover:underline ml-2">Remove</button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-[#5A5D64] uppercase">
                    {selectedMode === "school" ? "Key Topics (Optional)" : "Key Concepts / Topics (Optional)"}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedMode === "school"
                      ? ["Photosynthesis", "Cell Division", "Electricity", "History", "Trigonometry", "Grammar"]
                      : ["Algorithms", "DBMS", "Networks", "OS Concepts", "Data Structures", "Cloud"]
                    ).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setPromptText(promptText.includes(tag) ? promptText.replace(tag, "").replace(/,\s*/g, ", ").trim().replace(/^,|,$/g, "").trim() : (promptText ? `${promptText}, ${tag}` : tag))}
                        className={`px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                          promptText.includes(tag)
                            ? "bg-[#2d4a3e] text-white border-[#2d4a3e]"
                            : "bg-[#FAF9F5] text-[#5c5f66] border-[#EBE7DD] hover:border-[#2d4a3e]/40"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder={selectedMode === "school" ? "Or type topics, e.g. Respiration, Algebra..." : "Or type concepts, e.g. TCP/IP, Deadlock..."}
                    className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl px-3.5 py-2 text-xs text-[#1a1b1e] focus:outline-none focus:border-[#2d4a3e]"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {error}
              </div>
            )}

            {/* Launch Action Button */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#EBE7DD]">
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="px-4 py-2 rounded-full text-xs font-medium text-[#71767f] hover:text-[#1a1b1e]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStartSession()}
                disabled={loading}
                className="px-6 py-2.5 rounded-full bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white text-xs font-medium transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Preparing Viva Session...</span>
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
