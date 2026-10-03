"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, SessionData, getAuthToken } from "@/lib/api";
import { BrowserVoiceClient } from "@/lib/voice";
import { getSessionWebSocketUrl } from "@/lib/wsClient";
import AudioWave from "@/components/AudioWave";
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
  const [canvasColor, setCanvasColor] = useState("#00ea64");
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
      if (data.questions.length > 0) {
        setTotalQuestions(data.questions.length);
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

    // Initial Chalkboard Greeting
    ctx.fillStyle = "#94a3b8";
    ctx.font = "italic 22px 'Space Grotesk', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("welcome to", rect.width / 2, rect.height / 2 - 40);

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 36px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillText("System Design Mock Interview", rect.width / 2, rect.height / 2 + 10);

    ctx.fillStyle = "#64748b";
    ctx.font = "15px 'Geist', system-ui, sans-serif";
    ctx.fillText("We'll delve deep into how to design a scalable system by discussing", rect.width / 2, rect.height / 2 + 60);
    ctx.fillText("Functional / Non-functional requirements, High-level Architecture & Data Flow", rect.width / 2, rect.height / 2 + 84);
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
    ctx.lineWidth = 2;
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
      setMicNotice("Speech recognition is not supported in this browser. You can type or use fallback answers!");
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
      wsRef.current.send(JSON.stringify({ type: "replay_question" }));
    }
  };

  const handleSubmitAnswer = () => {
    if (!transcript.trim()) return;
    stopMicrophone();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "answer_submitted",
          transcript: transcript.trim(),
        })
      );
    }
  };

  const handleNextQuestion = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "next_question" }));
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
    <div className="flex flex-col h-screen w-screen bg-[#0b0c10] text-[#e2e8f0] font-sans select-none overflow-hidden">
      {/* ── TOP HEADER BAR (VIVORA Telemetry HUD) ──────────────── */}
      <header className="h-14 bg-[#0d0e14] border-b border-[#202230] px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3">
          {/* Logo Mark */}
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-[#00ea64] flex items-center justify-center font-mono font-bold text-[#0b0c10] text-xs shadow-[0_0_10px_rgba(0,234,100,0.4)]">
              V
            </div>
            <span className="font-mono font-bold text-white tracking-wider text-sm">
              VIVORA<span className="text-[#00ea64]">.AI</span>
            </span>
          </div>

          <span className="text-[#475569] font-light">|</span>

          {/* Session Title */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-[#cbd5e1]">
              {session?.mode ? `${session.mode.toUpperCase()} Viva & Technical Interview` : "System Design Mock Interview & Technical Viva"}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#1e202f] text-[11px] font-mono text-[#00ea64] border border-[#00ea64]/30">
              Q{questionIndex + 1}/{totalQuestions}
            </span>
          </div>
        </div>

        {/* Right Header Area: Timer + End Interview Button */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 font-mono text-sm text-[#94a3b8] bg-[#151620] px-3 py-1.5 rounded border border-[#232638]">
            <TimerIcon className="w-4 h-4 text-[#00ea64] animate-pulse" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <button
            onClick={() => setShowEndModal(true)}
            className="px-3.5 py-1.5 rounded text-xs font-semibold font-mono uppercase bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#f87171] border border-[#ef4444]/40 hover:border-[#ef4444] transition-all"
          >
            End Interview
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT: 2-COLUMN SPLIT (LEFT: AI EXAMINER, RIGHT: WHITEBOARD & VIDEO PIP) ── */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* ── LEFT PANE: AI EXAMINER & LIVE TRANSCRIPT ─────────────────────────── */}
        <aside className="w-80 md:w-96 lg:w-[420px] bg-[#0f1118] border-r border-[#202230] flex flex-col justify-between p-4 z-10 shrink-0">
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            
            {/* AI Examiner Dialogue Bubble */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs font-mono text-[#64748b]">
                <div className="w-2 h-2 rounded-full bg-[#00ea64] shadow-[0_0_8px_#00ea64]" />
                <span className="uppercase tracking-wider">AI Examiner (Dr. Aris)</span>
                {isAISpeaking && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#6366f1]/20 text-[#a5b4fc] border border-[#6366f1]/30 animate-pulse">
                    Speaking
                  </span>
                )}
              </div>

              <div className="bg-[#161822] border border-[#25283b] rounded-xl p-4 shadow-lg relative group">
                <p className="text-sm md:text-base text-[#f1f5f9] leading-relaxed font-sans">
                  {currentQuestion?.question_text ||
                    "Hey, nice to meet you! Good on you for taking this mock interview today. I am your AI interviewer. Before we dive into the technical problem, could you give me a quick intro about yourself and your background?"}
                </p>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#23273a]">
                  <button
                    onClick={handleReplayQuestion}
                    className="flex items-center space-x-1.5 text-xs text-[#94a3b8] hover:text-white transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#00ea64]" />
                    <span>Replay Audio</span>
                  </button>

                  <button
                    onClick={() => setShowDoubtModal(true)}
                    className="flex items-center space-x-1.5 text-xs text-[#a5b4fc] hover:text-white transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-[#6366f1]" />
                    <span>Ask Doubt</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Listening Pulse Status */}
            <div className="flex items-center space-x-2 py-1">
              <div className={`w-2.5 h-2.5 rounded-full ${isMicActive ? "bg-[#00ea64] animate-ping" : "bg-[#475569]"}`} />
              <span className={`text-xs font-mono tracking-wide ${isMicActive ? "text-[#00ea64]" : "text-[#64748b]"}`}>
                {isMicActive ? "🟢 I'm listening..." : "Microphone Muted (Tap mic to speak)"}
              </span>
            </div>

            {/* Realtime Candidate Speech Stream Card */}
            <div className="bg-[#12141d] border border-[#202334] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
                <span className="uppercase tracking-wider">Candidate Transcript</span>
                <span className="text-[#00ea64]">STT: Whisper / Web Speech</span>
              </div>

              {manualInput ? (
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Type your response here..."
                  className="w-full h-24 bg-[#181a24] border border-[#2d3148] rounded-lg p-2.5 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#00ea64] resize-none font-sans"
                />
              ) : (
                <div className="min-h-[80px] max-h-36 overflow-y-auto text-sm text-[#cbd5e1] font-sans leading-relaxed">
                  {transcript ? (
                    <span>{transcript}</span>
                  ) : (
                    <span className="text-[#475569] italic">
                      Your spoken response will appear here in real-time as you speak...
                    </span>
                  )}
                </div>
              )}

              {micNotice && (
                <div className="text-xs text-[#fbbf24] bg-[#fbbf24]/10 p-2 rounded border border-[#fbbf24]/20 flex items-start space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{micNotice}</span>
                </div>
              )}

              {/* Action Buttons for Answer Submission */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1e2130]">
                <button
                  onClick={() => setManualInput(!manualInput)}
                  className="text-[11px] text-[#64748b] hover:text-[#94a3b8] transition-colors"
                >
                  {manualInput ? "Switch to Voice" : "Switch to Text"}
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={isEvaluating || !transcript.trim()}
                    className="px-3.5 py-1.5 rounded-lg bg-[#00ea64] hover:bg-[#10b981] disabled:opacity-40 disabled:hover:bg-[#00ea64] text-[#0b0c10] font-mono font-bold text-xs flex items-center space-x-1.5 shadow-[0_0_12px_rgba(0,234,100,0.3)] transition-all"
                  >
                    {isEvaluating ? (
                      <>
                        <div className="w-3 h-3 border-2 border-[#0b0c10] border-t-transparent rounded-full animate-spin" />
                        <span>Scoring...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Answer</span>
                        <Send className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Rubric Evaluation Feed (If available) */}
            {latestEval && (
              <div className="bg-[#151722] border border-[#23273a] rounded-xl p-3.5 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#94a3b8] flex items-center space-x-1.5">
                    <Award className="w-3.5 h-3.5 text-[#00ea64]" />
                    <span>Real-time Rubric Evaluation</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-[#00ea64] bg-[#00ea64]/10 px-2 py-0.5 rounded">
                    Score: {latestEval.score_total || latestEval.score}/100
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#10121a] p-2 rounded-lg border border-[#1e2130]">
                    <div className="text-[10px] font-mono text-[#64748b]">Correctness</div>
                    <div className="text-xs font-bold font-mono text-[#00ea64]">
                      {latestEval.correctness_score ?? 85}%
                    </div>
                  </div>
                  <div className="bg-[#10121a] p-2 rounded-lg border border-[#1e2130]">
                    <div className="text-[10px] font-mono text-[#64748b]">Depth</div>
                    <div className="text-xs font-bold font-mono text-[#06b6d4]">
                      {latestEval.depth_score ?? 80}%
                    </div>
                  </div>
                  <div className="bg-[#10121a] p-2 rounded-lg border border-[#1e2130]">
                    <div className="text-[10px] font-mono text-[#64748b]">Clarity</div>
                    <div className="text-xs font-bold font-mono text-[#a855f7]">
                      {latestEval.clarity_score ?? 90}%
                    </div>
                  </div>
                </div>

                {latestEval.feedback && (
                  <p className="text-xs text-[#cbd5e1] bg-[#0d0f16] p-2 rounded border border-[#1a1d29] leading-relaxed">
                    {latestEval.feedback}
                  </p>
                )}

                <button
                  onClick={handleNextQuestion}
                  className="w-full py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white font-mono text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                >
                  <span>Proceed to Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Doubt Explanation Card */}
            {doubtExplanation && (
              <div className="bg-[#1a1b28] border border-[#6366f1]/40 rounded-xl p-3 space-y-1.5 animate-fadeIn">
                <div className="flex items-center space-x-1.5 text-xs font-mono text-[#a5b4fc]">
                  <HelpCircle className="w-3.5 h-3.5 text-[#6366f1]" />
                  <span>Doubt Clarification</span>
                </div>
                <p className="text-xs text-[#cbd5e1] leading-relaxed">{doubtExplanation}</p>
              </div>
            )}
          </div>

          {/* ── BOTTOM LEFT CONTROL DOCK (Mic, Camera, Screen Share) ─────────── */}
          <div className="pt-3 border-t border-[#202230] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Mic Toggle Button */}
              <button
                onClick={handleToggleMic}
                className={`p-2.5 rounded-xl border transition-all ${
                  isMicActive
                    ? "bg-[#00ea64]/20 border-[#00ea64] text-[#00ea64] shadow-[0_0_10px_rgba(0,234,100,0.3)]"
                    : "bg-[#161822] border-[#2a2d3f] text-[#64748b] hover:text-white"
                }`}
                title={isMicActive ? "Mute Microphone" : "Unmute Microphone"}
              >
                {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>

              {/* Camera Toggle Button */}
              <button
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`p-2.5 rounded-xl border transition-all ${
                  isCameraActive
                    ? "bg-[#00ea64]/20 border-[#00ea64] text-[#00ea64] shadow-[0_0_10px_rgba(0,234,100,0.3)]"
                    : "bg-[#161822] border-[#2a2d3f] text-[#64748b] hover:text-white"
                }`}
                title={isCameraActive ? "Turn Off Camera" : "Turn On Camera"}
              >
                {isCameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>

              {/* Screen Share / Layout */}
              <button
                className="p-2.5 rounded-xl bg-[#161822] border border-[#2a2d3f] text-[#64748b] hover:text-white transition-colors"
                title="Screen Share"
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>

            {/* Audio waveform micro-bars */}
            <div className="flex items-center space-x-1 px-2 py-1 bg-[#12141e] rounded-lg border border-[#232638]">
              <div
                className={`w-1 h-3 rounded-full bg-[#00ea64] transition-all ${
                  isMicActive ? "animate-pulse" : "opacity-30"
                }`}
              />
              <div
                className={`w-1 h-5 rounded-full bg-[#00ea64] transition-all ${
                  isMicActive ? "animate-pulse" : "opacity-30"
                }`}
              />
              <div
                className={`w-1 h-2 rounded-full bg-[#00ea64] transition-all ${
                  isMicActive ? "animate-pulse" : "opacity-30"
                }`}
              />
            </div>
          </div>
        </aside>

        {/* ── RIGHT MAIN STAGE: INTERACTIVE WHITEBOARD & FLOATING CANDIDATE PIP ── */}
        <main className="flex-1 bg-[#0b0c10] flex flex-col relative overflow-hidden">
          
          {/* Top Floating Whiteboard Tool Belt */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center bg-[#151620]/90 backdrop-blur-md border border-[#25283a] px-3 py-1.5 rounded-full shadow-2xl space-x-1">
            <button
              onClick={() => setActiveTool("draw")}
              className={`p-1.5 rounded-full transition-colors ${
                activeTool === "draw" ? "bg-[#00ea64] text-[#0b0c10]" : "text-[#94a3b8] hover:text-white"
              }`}
              title="Pencil / Draw"
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTool("rect")}
              className={`p-1.5 rounded-full transition-colors ${
                activeTool === "rect" ? "bg-[#00ea64] text-[#0b0c10]" : "text-[#94a3b8] hover:text-white"
              }`}
              title="Rectangle"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTool("diamond")}
              className={`p-1.5 rounded-full transition-colors ${
                activeTool === "diamond" ? "bg-[#00ea64] text-[#0b0c10]" : "text-[#94a3b8] hover:text-white"
              }`}
              title="Diamond"
            >
              <Diamond className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTool("circle")}
              className={`p-1.5 rounded-full transition-colors ${
                activeTool === "circle" ? "bg-[#00ea64] text-[#0b0c10]" : "text-[#94a3b8] hover:text-white"
              }`}
              title="Circle"
            >
              <CircleIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTool("arrow")}
              className={`p-1.5 rounded-full transition-colors ${
                activeTool === "arrow" ? "bg-[#00ea64] text-[#0b0c10]" : "text-[#94a3b8] hover:text-white"
              }`}
              title="Arrow"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTool("text")}
              className={`p-1.5 rounded-full transition-colors ${
                activeTool === "text" ? "bg-[#00ea64] text-[#0b0c10]" : "text-[#94a3b8] hover:text-white"
              }`}
              title="Text"
            >
              <Type className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-[#2f3348] mx-1" />

            {/* Color Swatches */}
            <button
              onClick={() => setCanvasColor("#00ea64")}
              className="w-4 h-4 rounded-full bg-[#00ea64] ring-2 ring-transparent hover:ring-white transition-all"
            />
            <button
              onClick={() => setCanvasColor("#06b6d4")}
              className="w-4 h-4 rounded-full bg-[#06b6d4] ring-2 ring-transparent hover:ring-white transition-all"
            />
            <button
              onClick={() => setCanvasColor("#ffffff")}
              className="w-4 h-4 rounded-full bg-white ring-2 ring-transparent hover:ring-[#00ea64] transition-all"
            />
          </div>

          {/* Interactive Whiteboard Canvas */}
          <div className="flex-1 w-full h-full relative cursor-crosshair bg-[radial-gradient(#1e2130_1px,transparent_1px)] [background-size:20px_20px]">
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              className="w-full h-full block"
            />
          </div>

          {/* Bottom Left Canvas Controls (Zoom, Undo, Redo, Clear) */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center space-x-1.5 bg-[#151620]/90 backdrop-blur-md border border-[#232638] px-3 py-1.5 rounded-full shadow-lg text-xs font-mono">
            <button
              onClick={() => setCanvasZoom((z) => Math.max(z - 10, 50))}
              className="p-1 text-[#94a3b8] hover:text-white transition-colors"
              title="Zoom Out"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[#cbd5e1] px-1">{canvasZoom}%</span>
            <button
              onClick={() => setCanvasZoom((z) => Math.min(z + 10, 200))}
              className="p-1 text-[#94a3b8] hover:text-white transition-colors"
              title="Zoom In"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-3.5 bg-[#25283a] mx-1" />

            <button
              onClick={clearCanvas}
              className="p-1 text-[#94a3b8] hover:text-[#f87171] transition-colors"
              title="Clear Canvas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── FLOATING CANDIDATE PICTURE-IN-PICTURE (PIP) CAMERA FEED ───────── */}
          {/* Positioned bottom right over the canvas matching the user's reference image */}
          <div className="absolute bottom-5 right-5 z-20 w-56 sm:w-64 md:w-72 h-36 sm:h-44 md:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#26293c] bg-[#12131a] transition-all hover:border-[#00ea64]">
            {isCameraActive ? (
              hasCameraPermission ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror-mode"
                />
              ) : (
                /* Fallback candidate image matching reference portrait of the focused candidate girl */
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop"
                  alt="Candidate Camera Preview"
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="w-full h-full bg-[#12141c] flex flex-col items-center justify-center space-y-2 text-[#64748b]">
                <Camera className="w-8 h-8 opacity-40" />
                <span className="text-[11px] font-mono">Camera Disabled</span>
              </div>
            )}

            {/* Overlaid Badges on Camera Feed */}
            <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5 bg-[#0b0c10]/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 text-[10px] font-mono">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ea64] animate-pulse" />
              <span className="text-white font-medium">LIVE HD</span>
            </div>

            <div className="absolute bottom-2.5 left-2.5 bg-[#0b0c10]/80 backdrop-blur-sm px-2 py-0.5 rounded text-[11px] font-sans font-medium text-white/90 border border-white/10">
              You (Candidate)
            </div>

            {/* Mic indicator bars on bottom right of camera */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center space-x-1 bg-[#0b0c10]/80 px-1.5 py-1 rounded">
              <div className={`w-0.5 h-2 rounded-full bg-[#00ea64] ${isMicActive ? "animate-pulse" : "opacity-30"}`} />
              <div className={`w-0.5 h-3.5 rounded-full bg-[#00ea64] ${isMicActive ? "animate-pulse" : "opacity-30"}`} />
              <div className={`w-0.5 h-1.5 rounded-full bg-[#00ea64] ${isMicActive ? "animate-pulse" : "opacity-30"}`} />
            </div>
          </div>
        </main>
      </div>

      {/* ── ASK DOUBT MODAL ─────────────────────────────────────────────────── */}
      {showDoubtModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151722] border border-[#2d3248] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-[#6366f1]" />
                <h3 className="font-semibold text-white text-base">Ask a Doubt / Clarification</h3>
              </div>
              <button onClick={() => setShowDoubtModal(false)} className="text-[#64748b] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#94a3b8]">
              Ask the AI examiner to clarify the question or explain a specific concept without losing your session score.
            </p>

            <textarea
              value={doubtInput}
              onChange={(e) => setDoubtInput(e.target.value)}
              placeholder="e.g. Could you explain what you mean by quorum requirement in this scenario?"
              className="w-full h-24 bg-[#0e1017] border border-[#25283b] rounded-xl p-3 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#6366f1] resize-none font-sans"
            />

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setShowDoubtModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-[#94a3b8] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAskDoubt}
                className="px-4 py-1.5 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white font-mono font-semibold text-xs transition-all shadow-[0_0_10px_rgba(99,102,241,0.3)]"
              >
                Submit Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── END INTERVIEW CONFIRMATION MODAL ─────────────────────────────────── */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151722] border border-[#ef4444]/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-fadeIn text-center">
            <AlertTriangle className="w-10 h-10 text-[#ef4444] mx-auto" />
            <h3 className="font-semibold text-white text-lg">End Interview Session?</h3>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Are you sure you want to conclude the mock interview? Your responses will be evaluated and your detailed scorecard will be generated.
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => setShowEndModal(false)}
                className="px-4 py-2 rounded-lg bg-[#1e202f] text-xs font-mono text-[#cbd5e1] hover:bg-[#282b3d]"
              >
                Resume
              </button>
              <button
                onClick={handleEndInterview}
                className="px-4 py-2 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-xs font-mono font-bold text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
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
