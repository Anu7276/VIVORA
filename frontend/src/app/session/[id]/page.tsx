"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, SessionData, getAuthToken } from "@/lib/api";
import { BrowserVoiceClient } from "@/lib/voice";
import { getSessionWebSocketUrl } from "@/lib/wsClient";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  RotateCcw,
  SkipForward,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Timer as TimerIcon,
  Volume2,
  Sparkles,
  ArrowRight,
  LogOut,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
  Send,
  Square,
  Diamond,
  Circle as CircleIcon,
  ArrowUpRight,
  Minus,
  PenTool,
  Type,
  Maximize2,
  Undo2,
  Redo2,
  Plus,
  Compass,
  MessageSquare,
  Camera
} from "lucide-react";

export default function SessionRoomPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(3);
  const [sessionLang, setSessionLang] = useState("en-IN");
  
  // Voice & STT state
  const [isMicActive, setIsMicActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0.2);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [latestEval, setLatestEval] = useState<any>(null);
  const [evalHistory, setEvalHistory] = useState<any[]>([]);
  const [showReferenceAnswer, setShowReferenceAnswer] = useState(false);
  const [degradedWarning, setDegradedWarning] = useState<string | null>(null);
  const [doubtExplanation, setDoubtExplanation] = useState<string | null>(null);
  const [showDoubtModal, setShowDoubtModal] = useState(false);
  const [doubtInput, setDoubtInput] = useState("");
  const [showEndModal, setShowEndModal] = useState(false);
  
  // Countdown Timer (Starts at 60 mins: 3600 seconds)
  const [remainingSeconds, setRemainingSeconds] = useState(3600);
  const [manualInput, setManualInput] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Whiteboard Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "rect" | "diamond" | "circle" | "arrow" | "line" | "draw" | "text">("draw");
  const [canvasColor, setCanvasColor] = useState("#0f766e");
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(100);

  const wsRef = useRef<WebSocket | null>(null);
  const voiceClientRef = useRef<BrowserVoiceClient | null>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Fetch initial session
  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId).then((data) => {
      setSession(data);
      if (data.questions && data.questions.length > 0) {
        setTotalQuestions(data.questions.length);
        setCurrentQuestion((prev: any) => prev || data.questions[0]);
      }
    }).catch(console.error);
  }, [sessionId]);

  // Countdown timer interval
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs} mins`;
  };

  // Setup candidate webcam feed
  useEffect(() => {
    let active = true;

    async function enableCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
            audio: false,
          });
          if (active) {
            mediaStreamRef.current = stream;
            setHasCameraPermission(true);
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(console.warn);
            }
          }
        }
      } catch (err) {
        console.warn("Camera access denied or unavailable:", err);
        if (active) {
          setHasCameraPermission(false);
        }
      }
    }

    if (isCameraActive) {
      enableCamera();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    }

    return () => {
      active = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isCameraActive]);

  // Sync stream to video element when rendered
  useEffect(() => {
    if (videoRef.current && mediaStreamRef.current && isCameraActive) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
        videoRef.current.play().catch(console.warn);
      }
    }
  }, [hasCameraPermission, isCameraActive]);

  // Whiteboard Canvas Interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high DPI canvas resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);


  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    ctx.strokeStyle = canvasColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  };

  // Connect WebSocket and Voice Client
  useEffect(() => {
    if (!sessionId) return;

    voiceClientRef.current = new BrowserVoiceClient();
    const wsUrl = getSessionWebSocketUrl(sessionId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected to Viva session room");
      const token = getAuthToken();
      if (token) {
        ws.send(JSON.stringify({ type: "auth", token }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WS Message:", data);

        if (data.type === "session_started") {
          if (data.language) {
            setSessionLang(data.language);
            voiceClientRef.current = new BrowserVoiceClient(data.language);
          }
          if (data.total_questions) {
            setTotalQuestions(data.total_questions);
          }
        } else if (data.type === "question_ready") {
          setCurrentQuestion(data.question);
          setQuestionIndex(data.question_index);
          setTotalQuestions(data.total_questions || totalQuestions);
          setTranscript("");
          setIsEvaluating(false);
          setDoubtExplanation(null);
          setShowReferenceAnswer(false);

          // AI TTS speaks the question
          if (data.speech?.speakable_text) {
            setIsAISpeaking(true);
            BrowserVoiceClient.speak(data.speech.speakable_text, {
              rate: data.speech.tts_payload?.rate || 0.95,
              pitch: data.speech.tts_payload?.pitch || 1.0,
              lang: sessionLang,
              onEnd: () => {
                setIsAISpeaking(false);
                startMicrophone();
              },
            });
          }
        } else if (data.type === "question_repeated") {
          if (data.speech?.speakable_text) {
            setIsAISpeaking(true);
            BrowserVoiceClient.speak(data.speech.speakable_text, {
              lang: sessionLang,
              onEnd: () => {
                setIsAISpeaking(false);
                startMicrophone();
              },
            });
          }
        } else if (data.type === "evaluating") {
          setIsEvaluating(true);
        } else if (data.type === "evaluation_result") {
          setIsEvaluating(false);
          setLatestEval(data.evaluation);
          setEvalHistory((prev) => [...prev, data.evaluation]);
        } else if (data.type === "degraded_mode") {
          setDegradedWarning(data.message);
        } else if (data.type === "followup_question") {
          setCurrentQuestion({
            ...data.question,
            order_no: data.question?.order_no ? `${data.question.order_no} (Follow-up)` : `${questionIndex + 1} (Follow-up)`,
          });
          setTranscript("");
          if (data.speech?.speakable_text) {
            setIsAISpeaking(true);
            BrowserVoiceClient.speak(data.speech.speakable_text, {
              lang: sessionLang,
              onEnd: () => {
                setIsAISpeaking(false);
                startMicrophone();
              },
            });
          }
        } else if (data.type === "doubt_answered") {
          setDoubtExplanation(data.doubt?.explanation);
          if (data.doubt?.explanation) {
            setIsAISpeaking(true);
            BrowserVoiceClient.speak(data.doubt.explanation, {
              lang: sessionLang,
              onEnd: () => {
                setIsAISpeaking(false);
              },
            });
          }
        } else if (data.type === "session_completed") {
          router.push(`/report/${sessionId}`);
        }
      } catch (err) {
        console.error("Error processing WS message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
    };

    return () => {
      stopMicrophone();
      BrowserVoiceClient.stopSpeaking();
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [sessionId]);

  const startMicrophone = () => {
    if (!voiceClientRef.current) return;
    setIsMicActive(true);
    setMicNotice(null);
    BrowserVoiceClient.stopSpeaking();
    setIsAISpeaking(false);

    if (!voiceClientRef.current.isSupported()) {
      setMicNotice("Speech recognition is not supported in this browser. You can type or use text answers!");
      setManualInput(true);
    }

    voiceClientRef.current.startListening({
      onPartialTranscript: (text) => {
        setTranscript(text);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({ type: "stt_partial", transcript: text })
          );
        }
      },
      onFinalTranscript: (text) => {
        setTranscript(text);
      },
      onAudioLevel: (level) => {
        setAudioLevel(level);
      },
      onError: (err) => {
        console.warn("STT warning:", err);
        setMicNotice("Microphone notice: " + (typeof err === "string" ? err : "Please allow mic access or use text input"));
      },
    });
  };

  const stopMicrophone = () => {
    setIsMicActive(false);
    if (voiceClientRef.current) {
      voiceClientRef.current.stopListening();
    }
  };

  const handleToggleMic = () => {
    if (isMicActive) {
      stopMicrophone();
    } else {
      startMicrophone();
    }
  };

  const handleReplayQuestion = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "repeat_question" }));
    }
  };

  const handleSubmitAnswer = () => {
    if (!transcript.trim()) return;
    stopMicrophone();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "submit_answer",
          transcript: transcript.trim(),
        })
      );
    }
  };

  const handleNextQuestion = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "skip_question" }));
    }
  };

  const handleAskDoubt = () => {
    if (!doubtInput.trim()) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "ask_doubt",
          doubt: doubtInput.trim(),
        })
      );
      setDoubtInput("");
      setShowDoubtModal(false);
    }
  };

  const handleEndInterview = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_session" }));
    }
    router.push(`/report/${sessionId}`);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F9F8F5] text-[#1a1b1e] font-sans select-none overflow-hidden">
      
      {/* ── TOP HEADER BAR ─────────────────────────────────────────────────── */}
      <header className="h-16 bg-white border-b border-[#E8E4DA] px-6 flex items-center justify-between z-20 shrink-0 shadow-2xs">
        {/* Brand & Topic Section */}
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1C1C1E] flex items-center justify-center text-white text-xs font-mono font-medium shadow-xs">
              ✦
            </div>
            <span className="font-serif italic text-xl text-[#1a1b1e] font-semibold tracking-tight">
              vivora
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider bg-[#7D9F68]/15 text-[#2d4a3e] border border-[#7D9F68]/30 uppercase">
              AI VIVA
            </span>
          </div>

          <div className="h-4 w-px bg-[#E2DED4]" />

          {/* Mode & Topic Badge */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-[#1a1b1e] uppercase tracking-wide">
              {session?.mode ? `${session.mode} Studio` : "Technical Viva"}
            </span>
            <span className="text-xs text-[#8c9099]">•</span>
            <span className="text-xs text-[#555850] font-medium max-w-[220px] md:max-w-xs truncate">
              {currentQuestion?.topic || (session as any)?.title || "Oral Technical Examination"}
            </span>
          </div>
        </div>

        {/* Center: Question Progress Stepper */}
        <div className="hidden lg:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#FAF9F5] border border-[#E8E4DA]">
          <span className="text-[11px] font-mono font-semibold uppercase text-[#7D9F68] tracking-wider mr-1">
            Question
          </span>
          {Array.from({ length: totalQuestions }).map((_, idx) => (
            <div
              key={idx}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold transition-all ${
                idx === questionIndex
                  ? "bg-[#2D4A3E] text-white shadow-xs scale-105"
                  : idx < questionIndex
                  ? "bg-[#E8F3E5] text-[#2D4A3E] border border-[#7D9F68]/40"
                  : "bg-white text-[#94a3b8] border border-[#E2DED4]"
              }`}
            >
              {idx < questionIndex ? "✓" : idx + 1}
            </div>
          ))}
          <span className="text-[11px] font-mono text-[#8c9099] ml-1">
            of {totalQuestions}
          </span>
        </div>

        {/* Right Header Area: Latency + Timer + End Action */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[11px] font-mono text-[#244B34] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
            <span>14ms Latency</span>
          </div>

          <div className="flex items-center space-x-2 font-mono text-xs text-[#475569] bg-[#FAF9F5] px-3 py-1.5 rounded-full border border-[#E8E4DA] shadow-2xs">
            <TimerIcon className="w-3.5 h-3.5 text-[#7D9F68] animate-pulse" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <button
            onClick={() => setShowEndModal(true)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold font-mono text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center space-x-1.5"
          >
            <span>End Session</span>
          </button>
        </div>
      </header>

      {/* ── MAIN STUDIO CONTENT ────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden p-4 md:p-5 gap-5">
        
        {/* ── LEFT/CENTER STAGE: VIRTUAL INTERVIEW ROOM + QUESTION ARENA ────── */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0 pr-1">
          
          {/* 1. DUAL VIDEO STAGE: EXAMINER & CANDIDATE TILES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[250px] md:h-[280px] shrink-0">
            
            {/* Tile A: AI Examiner (Dr. Aris) */}
            <div className="bg-[#0e1014] border border-neutral-800 rounded-2xl relative overflow-hidden flex flex-col justify-between p-4 shadow-md">
              {/* Top Bar inside Examiner Tile */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-xs font-semibold text-neutral-200">
                    Dr. Aris
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700/60 uppercase">
                    AI Examiner
                  </span>
                </div>

                {isAISpeaking ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 flex items-center space-x-1.5 shadow-[0_0_12px_rgba(52,211,153,0.3)] animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Speaking Question</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-neutral-400">
                    Listening
                  </span>
                )}
              </div>

              {/* Center Animated Voice Orb / Wave Presence */}
              <div className="flex-1 flex flex-col items-center justify-center relative">
                {/* Concentric Sonic Rings */}
                <div className="relative flex items-center justify-center">
                  {isAISpeaking && (
                    <>
                      <div className="absolute w-28 h-28 rounded-full border border-emerald-500/30 animate-ping opacity-60 pointer-events-none" />
                      <div className="absolute w-36 h-36 rounded-full border border-emerald-500/20 animate-pulse pointer-events-none" />
                    </>
                  )}
                  <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-neutral-800 via-neutral-900 to-black border-2 flex items-center justify-center shadow-xl transition-all ${
                    isAISpeaking ? "border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.35)] scale-105" : "border-neutral-700"
                  }`}>
                    <span className="text-2xl font-serif font-bold text-emerald-400">✦</span>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <p className="text-xs font-sans text-neutral-300 font-medium">
                    {isAISpeaking ? "Dr. Aris is articulating question..." : "Attentively analyzing your defense"}
                  </p>
                </div>
              </div>

              {/* Bottom Examiner Audio Strip */}
              <div className="flex items-center justify-between z-10 pt-2 border-t border-neutral-800/80 text-[11px] font-mono text-neutral-400">
                <div className="flex items-center space-x-1.5">
                  <div className={`w-1 h-3 rounded-full bg-emerald-400 ${isAISpeaking ? "animate-pulse" : "opacity-30"}`} />
                  <div className={`w-1 h-5 rounded-full bg-emerald-400 ${isAISpeaking ? "animate-pulse" : "opacity-30"}`} />
                  <div className={`w-1 h-2 rounded-full bg-emerald-400 ${isAISpeaking ? "animate-pulse" : "opacity-30"}`} />
                  <div className={`w-1 h-4 rounded-full bg-emerald-400 ${isAISpeaking ? "animate-pulse" : "opacity-30"}`} />
                  <span className="ml-1 text-[10px] text-neutral-400">Voice Synthesis Engine</span>
                </div>

                <button
                  onClick={handleReplayQuestion}
                  className="px-2.5 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition-colors flex items-center space-x-1 text-[11px]"
                >
                  <Volume2 className="w-3 h-3 text-emerald-400" />
                  <span>Replay</span>
                </button>
              </div>
            </div>

            {/* Tile B: Candidate Video Feed (You) */}
            <div className="bg-[#0e1014] border border-neutral-800 rounded-2xl relative overflow-hidden flex flex-col justify-between p-4 shadow-md">
              {/* Live Video Camera Stream */}
              {isCameraActive ? (
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
                      el.srcObject = mediaStreamRef.current;
                      el.play().catch(console.warn);
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
              ) : (
                <div className="absolute inset-0 bg-[#12151a] flex flex-col items-center justify-center space-y-2 text-neutral-400">
                  <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400">
                    <Camera className="w-7 h-7 opacity-50" />
                  </div>
                  <span className="text-xs font-mono text-neutral-400">Camera Paused</span>
                </div>
              )}

              {/* Overlaid Top Bar inside Candidate Tile */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-xs font-mono">
                  <div className={`w-2 h-2 rounded-full ${isCameraActive ? "bg-[#34C759] animate-pulse" : "bg-neutral-500"}`} />
                  <span className="text-white font-medium">You (Candidate)</span>
                </div>

                <div className="flex items-center space-x-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-mono text-emerald-400 font-bold">
                  <span>LIVE HD</span>
                </div>
              </div>

              {/* Overlaid Bottom Bar with Quick Camera & Mic Toggles */}
              <div className="flex items-center justify-between z-10 pt-2">
                <div className="flex items-center space-x-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-mono text-neutral-300">
                  <div className={`w-1.5 h-1.5 rounded-full ${isMicActive ? "bg-[#34C759] animate-pulse" : "bg-amber-400"}`} />
                  <span>{isMicActive ? "Mic Listening" : "Mic Muted"}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleToggleMic}
                    className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
                      isMicActive
                        ? "bg-[#2D4A3E]/90 border-emerald-500/40 text-emerald-300"
                        : "bg-black/60 border-white/10 text-neutral-300 hover:text-white"
                    }`}
                    title={isMicActive ? "Mute Microphone" : "Unmute Microphone"}
                  >
                    {isMicActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => setIsCameraActive(!isCameraActive)}
                    className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
                      isCameraActive
                        ? "bg-[#2D4A3E]/90 border-emerald-500/40 text-emerald-300"
                        : "bg-black/60 border-white/10 text-neutral-300 hover:text-white"
                    }`}
                    title={isCameraActive ? "Turn Off Camera" : "Turn On Camera"}
                  >
                    {isCameraActive ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. CURRENT QUESTION SHOWCASE ARENA */}
          <div className="bg-white border border-[#E8E4DA] rounded-2xl p-5 shadow-xs space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#7D9F68]" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#2D4A3E]">
                  Question {questionIndex + 1} of {totalQuestions}
                </span>
                <span className="text-xs text-[#8c9099]">•</span>
                <span className="text-xs font-mono text-[#555850]">Oral Evaluation</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleReplayQuestion}
                  className="flex items-center space-x-1 px-3 py-1 rounded-full bg-[#FAF9F5] hover:bg-[#EBE7DD] border border-[#DDD9CF] text-xs font-mono text-[#555850] transition-colors"
                >
                  <Volume2 className="w-3 h-3 text-[#7D9F68]" />
                  <span>Replay Audio</span>
                </button>

                <button
                  onClick={() => setShowDoubtModal(true)}
                  className="flex items-center space-x-1 px-3 py-1 rounded-full bg-[#FAF9F5] hover:bg-[#EBE7DD] border border-[#DDD9CF] text-xs font-mono text-[#4f46e5] transition-colors"
                >
                  <HelpCircle className="w-3 h-3 text-[#4f46e5]" />
                  <span>Ask Doubt</span>
                </button>
              </div>
            </div>

            <p className="text-lg md:text-xl font-serif text-[#1a1b1e] font-medium leading-relaxed">
              "{currentQuestion?.question_text ||
                (session?.questions?.[0]?.question_text || "Welcome to your Viva! Could you introduce your technical approach and how you would design this system for scale?")}"
            </p>
          </div>

          {/* 3. CANDIDATE LIVE SPOKEN ANSWER & TRANSCRIPT BAR */}
          <div className="bg-white border border-[#E8E4DA] rounded-2xl p-5 shadow-xs flex-1 flex flex-col justify-between space-y-3 min-h-[190px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-2 text-[#555850]">
                  <span className="font-semibold uppercase tracking-wider">Candidate Response</span>
                  {isMicActive ? (
                    <span className="flex items-center space-x-1.5 text-[#2D4A3E] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-ping" />
                      <span>Live Speech Recognition</span>
                    </span>
                  ) : (
                    <span className="text-[#8c9099] italic">Microphone Paused</span>
                  )}
                </div>

                <button
                  onClick={() => setManualInput(!manualInput)}
                  className="text-[11px] text-[#555850] hover:text-[#1a1b1e] underline underline-offset-2 transition-colors"
                >
                  {manualInput ? "Switch to Voice Mode" : "Switch to Text Input"}
                </button>
              </div>

              {/* Dynamic Answer Box (Voice stream or Textarea) */}
              {manualInput ? (
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Type your structured technical response here..."
                  className="w-full h-24 bg-[#FAF9F5] border border-[#E2DED4] rounded-xl p-3 text-sm text-[#1a1b1e] focus:outline-none focus:border-[#2D4A3E] resize-none font-sans"
                />
              ) : (
                <div className="min-h-[75px] max-h-36 overflow-y-auto bg-[#FAF9F5] border border-[#E2DED4] rounded-xl p-3 text-sm text-[#1a1b1e] font-sans leading-relaxed">
                  {transcript ? (
                    <span className="font-medium text-[#1a1b1e]">{transcript}</span>
                  ) : (
                    <span className="text-[#8c9099] italic">
                      {isMicActive
                        ? "Listening to your voice... Speak clearly and articulate your reasoning."
                        : "Click 'Start Speaking' to dictate your answer or switch to text input above."}
                    </span>
                  )}
                </div>
              )}

              {micNotice && (
                <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-start space-x-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <span>{micNotice}</span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E8E4DA]">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleToggleMic}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex items-center space-x-2 ${
                    isMicActive
                      ? "bg-red-50 text-red-600 border border-red-200 shadow-xs"
                      : "bg-[#2D4A3E] text-white hover:bg-[#395e4f] shadow-xs"
                  }`}
                >
                  {isMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isMicActive ? "Pause Mic" : "Start Speaking"}</span>
                </button>

                {isMicActive && (
                  <div className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#FAF9F5] rounded-lg border border-[#E8E4DA]">
                    <div className="w-1 h-3 rounded-full bg-[#34C759] animate-pulse" />
                    <div className="w-1 h-5 rounded-full bg-[#34C759] animate-pulse" />
                    <div className="w-1 h-2 rounded-full bg-[#34C759] animate-pulse" />
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmitAnswer}
                disabled={isEvaluating || !transcript.trim()}
                className="px-6 py-2.5 rounded-xl bg-[#20211E] hover:bg-[#343631] disabled:opacity-40 text-white font-mono font-bold text-xs flex items-center space-x-2 shadow-sm transition-all"
              >
                {isEvaluating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Scoring Answer...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Answer</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR: VIVA INTELLIGENCE & EVALUATION ─────────────────── */}
        <aside className="w-80 md:w-96 shrink-0 bg-white border border-[#E8E4DA] rounded-2xl p-5 shadow-xs flex flex-col justify-between overflow-y-auto space-y-4">
          <div className="space-y-4">
            {/* Sidebar Title */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DA]">
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-[#7D9F68]" />
                <span className="font-mono text-xs font-bold text-[#1a1b1e] uppercase tracking-wider">
                  Viva Intelligence
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#DDD9CF] text-[#555850]">
                Real-time
              </span>
            </div>

            {/* Rubric Evaluation Result (When available) */}
            {latestEval ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-[#FAF9F5] border border-[#E2DED4] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#555850] font-bold">
                      Question Score
                    </span>
                    <span className="text-sm font-mono font-bold text-[#2D4A3E] bg-[#E8F3E5] px-2.5 py-0.5 rounded-full border border-[#7D9F68]/30">
                      {latestEval.score_total || latestEval.score}/100
                    </span>
                  </div>

                  {/* 3 Metric Progress Bars */}
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-[#555850] mb-1">
                        <span>Correctness</span>
                        <span className="font-bold text-[#2D4A3E]">{latestEval.correctness_score ?? 85}%</span>
                      </div>
                      <div className="w-full bg-[#E5E0D4] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#2D4A3E] h-full rounded-full transition-all"
                          style={{ width: `${latestEval.correctness_score ?? 85}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-[#555850] mb-1">
                        <span>Depth & Reasoning</span>
                        <span className="font-bold text-[#0284c7]">{latestEval.depth_score ?? 80}%</span>
                      </div>
                      <div className="w-full bg-[#E5E0D4] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#0284c7] h-full rounded-full transition-all"
                          style={{ width: `${latestEval.depth_score ?? 80}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-[#555850] mb-1">
                        <span>Communication Clarity</span>
                        <span className="font-bold text-[#7c3aed]">{latestEval.clarity_score ?? 90}%</span>
                      </div>
                      <div className="w-full bg-[#E5E0D4] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#7c3aed] h-full rounded-full transition-all"
                          style={{ width: `${latestEval.clarity_score ?? 90}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Feedback Note */}
                  {latestEval.feedback && (
                    <div className="pt-2 text-xs text-[#334155] leading-relaxed border-t border-[#E8E4DA]">
                      <span className="font-semibold font-mono text-[10px] text-[#7D9F68] uppercase block mb-1">
                        Examiner Note
                      </span>
                      {latestEval.feedback}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleNextQuestion}
                  className="w-full py-2.5 rounded-xl bg-[#2D4A3E] hover:bg-[#395e4f] text-white font-mono text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <span>Proceed to Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* Rubric Evaluation Guide when waiting for answer */
              <div className="bg-[#FAF9F5] border border-[#E2DED4] rounded-xl p-4 space-y-3">
                <span className="text-xs font-mono uppercase tracking-wider text-[#555850] font-bold block">
                  Scoring Criteria
                </span>
                <p className="text-xs text-[#555850] leading-relaxed">
                  Your spoken or written answers are evaluated in real-time across three key academic pillars:
                </p>

                <ul className="space-y-2 text-xs text-[#334155]">
                  <li className="flex items-start space-x-2">
                    <span className="text-[#2D4A3E] font-bold">1.</span>
                    <span><strong>Conceptual Correctness:</strong> Accuracy of facts, definitions, and theories.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-[#0284c7] font-bold">2.</span>
                    <span><strong>Technical Depth:</strong> Ability to justify trade-offs and edge-cases.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-[#7c3aed] font-bold">3.</span>
                    <span><strong>Verbal Clarity:</strong> Articulation, composure, and confidence under pressure.</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Doubt Explanation Card */}
            {doubtExplanation && (
              <div className="bg-[#f5f3ff] border border-[#ddd6fe] rounded-xl p-3.5 space-y-1.5 animate-fadeIn">
                <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-[#6d28d9]">
                  <HelpCircle className="w-3.5 h-3.5 text-[#6d28d9]" />
                  <span>Doubt Clarification</span>
                </div>
                <p className="text-xs text-[#4c1d95] leading-relaxed">{doubtExplanation}</p>
              </div>
            )}
          </div>

          {/* Bottom Security & Engine Info */}
          <div className="pt-3 border-t border-[#E8E4DA] text-[11px] font-mono text-[#8c9099] space-y-1">
            <div className="flex items-center justify-between">
              <span>Privacy Guard</span>
              <span className="text-[#2D4A3E] font-semibold">Zero Audio Stored</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Speech Engine</span>
              <span>Fast Whisper / Web Speech</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ── ASK DOUBT MODAL ─────────────────────────────────────────────────── */}
      {showDoubtModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#cbd5e1] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-[#4f46e5]" />
                <h3 className="font-semibold text-[#0f172a] text-base">Ask a Doubt / Clarification</h3>
              </div>
              <button onClick={() => setShowDoubtModal(false)} className="text-[#94a3b8] hover:text-[#0f172a]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#64748b]">
              Ask the AI examiner to clarify the question or explain a specific concept without penalizing your score.
            </p>

            <textarea
              value={doubtInput}
              onChange={(e) => setDoubtInput(e.target.value)}
              placeholder="e.g. Could you clarify what you mean by consensus invariant in this scenario?"
              className="w-full h-24 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-3 text-sm text-[#0f172a] focus:outline-none focus:border-[#4f46e5] resize-none font-sans"
            />

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setShowDoubtModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-[#64748b] hover:text-[#0f172a]"
              >
                Cancel
              </button>
              <button
                onClick={handleAskDoubt}
                className="px-4 py-1.5 rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white font-mono font-semibold text-xs transition-all shadow-sm"
              >
                Submit Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── END INTERVIEW CONFIRMATION MODAL ─────────────────────────────────── */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-fadeIn text-center">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
            <h3 className="font-semibold text-[#0f172a] text-lg">End Interview Session?</h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Are you sure you want to conclude the examination? Your responses will be evaluated and your scorecard generated.
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => setShowEndModal(false)}
                className="px-4 py-2 rounded-lg bg-[#f1f5f9] text-xs font-mono text-[#475569] hover:bg-[#e2e8f0]"
              >
                Resume
              </button>
              <button
                onClick={handleEndInterview}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-mono font-bold text-white shadow-sm"
              >
                Conclude & View Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
