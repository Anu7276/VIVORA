"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, SessionData } from "@/lib/api";
import { BrowserVoiceClient } from "@/lib/voice";
import { getSessionWebSocketUrl } from "@/lib/wsClient";
import AudioWave from "@/components/AudioWave";
import {
  Mic,
  MicOff,
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
  School,
  AlertTriangle,
  X,
  Send
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
  const [timerSeconds, setTimerSeconds] = useState(0);

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

  // Timer interval
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Connect WebSocket and Voice Client
  useEffect(() => {
    if (!sessionId) return;

    voiceClientRef.current = new BrowserVoiceClient();
    const wsUrl = getSessionWebSocketUrl(sessionId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected to Viva session room");
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
                // Auto-start listening after question is asked
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

  const [manualInput, setManualInput] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);

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

  const handleSubmitSpokenAnswer = () => {
    stopMicrophone();
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const spokenText = transcriptRef.current.trim();
    wsRef.current.send(
      JSON.stringify({
        type: "submit_answer",
        transcript: spokenText,
        duration_sec: 10,
        filler_count: 0,
      })
    );
  };

  const handleRepeatQuestion = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "repeat_question" }));
    }
  };

  const handleSkipQuestion = () => {
    stopMicrophone();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "skip_question" }));
    }
  };

  const handleOpenDoubtModal = () => {
    stopMicrophone();
    setShowDoubtModal(true);
  };

  const handleSubmitDoubt = () => {
    const doubt = doubtInput.trim();
    if (doubt && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "ask_doubt", doubt: doubt })
      );
      setDoubtInput("");
      setShowDoubtModal(false);
    }
  };

  const handleEndSession = () => {
    stopMicrophone();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_session" }));
    }
  };

  const formatTimer = (totalSec: number) => {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Cumulative marks calculation
  const totalMarksAwarded = evalHistory.reduce((sum, e) => sum + (e.overall_score || 0), 0);
  const maxPossibleMarks = evalHistory.length * 10;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* Degraded mode warning banner */}
      {degradedWarning && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{degradedWarning}</span>
          </div>
          <button
            onClick={() => setDegradedWarning(null)}
            className="text-gray-400 hover:text-white text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel px-6 py-3.5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <School className="w-3.5 h-3.5" />
                <span>{session?.mode?.toUpperCase() || "SCHOOL VIVA"}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                Semantic Meaning Scored
              </span>
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              Question {questionIndex + 1} of {totalQuestions}
            </div>
          </div>
        </div>

        {/* Question Progress Stepper */}
        <div className="hidden sm:flex items-center gap-1.5">
          {Array.from({ length: totalQuestions }).map((_, idx) => (
            <div
              key={idx}
              className={`h-2.5 rounded-full transition-all ${
                idx === questionIndex
                  ? "w-8 bg-emerald-400 shadow-sm shadow-emerald-400/50"
                  : idx < questionIndex
                  ? "w-4 bg-emerald-600"
                  : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-4">
          {/* Cumulative Viva Marks badge */}
          {evalHistory.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Marks: {totalMarksAwarded.toFixed(1)} / {maxPossibleMarks}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs font-mono text-gray-300 bg-surfaceLight/60 px-3 py-1.5 rounded-lg border border-white/5">
            <TimerIcon className="w-4 h-4 text-emerald-400" />
            <span>{formatTimer(timerSeconds)}</span>
          </div>

          <button
            onClick={handleEndSession}
            className="flex items-center gap-1.5 text-xs text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Finish Viva</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Center: AI Examiner & Spoken Question */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Examiner Card */}
          <div className="glass-panel-glow p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">AI Spoken Examiner</h3>
                  <p className="text-xs text-gray-400">
                    {isAISpeaking ? "Asking question aloud..." : "Listening to your spoken answer..."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentQuestion?.order_no?.toString().includes("Follow-up") && (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-amber/20 text-amber-300 border border-accent-amber/30 animate-pulse">
                    🔍 Deep Follow-up
                  </span>
                )}
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                  {currentQuestion?.topic || "Engineering / Science"}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {typeof currentQuestion?.order_no === 'string' && currentQuestion?.order_no.includes("Follow-up") 
                    ? currentQuestion.order_no 
                    : `Q${questionIndex + 1}`}
                </span>
              </div>
            </div>

            {/* Spoken Question Text */}
            <div className="min-h-[110px] flex items-center justify-center text-center px-4">
              <p className="text-xl sm:text-2xl font-semibold text-white leading-relaxed">
                {currentQuestion ? (
                  `"${currentQuestion.question_text}"`
                ) : (
                  <span className="text-gray-500 animate-pulse">Setting up viva questions...</span>
                )}
              </p>
            </div>

            {/* AI Audio Waveform Visualizer */}
            <div className="border-t border-white/5 pt-4">
              <AudioWave isSpeaking={isAISpeaking} isAI={true} level={0.8} />
            </div>
          </div>

          {/* Student Live Spoken Answer Card */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <Mic className={`w-4 h-4 ${isMicActive ? "text-emerald-400 animate-pulse" : "text-gray-500"}`} />
                <span>Your Spoken Answer (Live Transcript)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-400/90 font-medium">
                  {isMicActive ? "● Recording Speech" : "○ Microphone Inactive"}
                </span>
              </div>
            </div>

            {/* Spoken Transcript / Text Area */}
            <div className="bg-surfaceLight/30 border border-white/5 rounded-2xl p-4 min-h-[130px] flex flex-col justify-between">
              {manualInput ? (
                <textarea
                  rows={4}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Type your viva answer here in your own words. It will be graded on conceptual correctness..."
                  className="w-full bg-surfaceLight/60 border border-white/10 rounded-xl p-3 text-sm text-gray-100 focus:outline-none focus:border-emerald-500 font-normal leading-relaxed"
                />
              ) : (
                <p className="text-sm sm:text-base text-gray-200 leading-relaxed italic">
                  {transcript ? (
                    `"${transcript}"`
                  ) : (
                    <span className="text-gray-500 not-italic">
                      {isMicActive ? "Listening... speak your answer aloud in your own words..." : "Click 'Start Mic' or 'Type Answer' to respond."}
                    </span>
                  )}
                </p>
              )}

              {/* Student Volume Waveform */}
              {isMicActive && !manualInput && (
                <div className="pt-2">
                  <AudioWave isSpeaking={isMicActive} isAI={false} level={audioLevel} />
                </div>
              )}
            </div>

            {micNotice && (
              <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl flex items-center justify-between">
                <span>{micNotice}</span>
                <button
                  onClick={() => setManualInput(true)}
                  className="underline ml-2 text-white font-semibold"
                >
                  Type Answer
                </button>
              </div>
            )}

            {/* Live Controls & Submit Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleMic}
                  className={`px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 transition-all ${
                    isMicActive
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                  }`}
                >
                  {isMicActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isMicActive ? "Mute Mic" : "Start Mic"}</span>
                </button>

                <button
                  onClick={() => setManualInput(!manualInput)}
                  className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center gap-1.5 transition-colors"
                >
                  <span>{manualInput ? "Voice Mode" : "Type Answer"}</span>
                </button>

                <button
                  onClick={handleRepeatQuestion}
                  className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center gap-1.5 transition-colors"
                  title="Repeat question aloud"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Repeat</span>
                </button>

                <button
                  onClick={handleSkipQuestion}
                  className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center gap-1.5 transition-colors"
                  title="Skip to next question"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Skip</span>
                </button>

                <button
                  onClick={handleOpenDoubtModal}
                  className="px-3.5 py-2.5 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 text-primary-300 text-xs flex items-center gap-1.5 border border-primary-500/20 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Ask Doubt</span>
                </button>
              </div>

              <button
                onClick={handleSubmitSpokenAnswer}
                disabled={isEvaluating}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                <span>{isEvaluating ? "Grading Meaning & Concepts..." : "Submit Answer & Next"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Real-time Evaluation & Concept Matching */}
        <div className="space-y-6">
          {/* Doubt Resolution Card (if asked) */}
          {doubtExplanation && (
            <div className="glass-panel p-5 rounded-3xl border border-accent-cyan/30 space-y-2 bg-accent-cyan/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent-cyan">
                <Sparkles className="w-4 h-4" />
                <span>Examiner Clarification</span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed">{doubtExplanation}</p>
            </div>
          )}

          {/* Evaluator Agent Scorecard */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Live Semantic Evaluator</h3>
              </div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Meaning Match
              </span>
            </div>

            {isEvaluating ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-emerald-300 font-medium">Checking concepts against reference answer...</p>
                <p className="text-[11px] text-gray-400">Awarding marks based on meaning, not word-for-word repetition.</p>
              </div>
            ) : latestEval ? (
              <div className="space-y-4 animate-fadeIn">
                {latestEval.scored === false ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Answer Recorded Unscored</span>
                    </div>
                    <p className="text-[11px] text-amber-200/80 leading-relaxed">
                      {latestEval.feedback || "Evaluation model was unavailable or returned invalid output. Your answer was safely captured without fake scores."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Score & Concept Match Badge */}
                    <div className="p-4 rounded-2xl bg-surfaceLight/70 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Marks Awarded</span>
                        <span className="text-2xl font-black text-emerald-400">
                          ⭐ {latestEval.overall_score} <span className="text-xs text-gray-500 font-normal">/ 10</span>
                        </span>
                      </div>

                      {/* Concept match badge */}
                      <div className="pt-1">
                        {latestEval.concept_match === "Full Match" || latestEval.overall_score >= 8.0 ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Full Concept Match (Same Meaning)</span>
                          </div>
                        ) : latestEval.concept_match === "Partial Match" || latestEval.overall_score >= 5.0 ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-amber/20 text-amber-300 border border-accent-amber/30 text-xs font-semibold">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Partial Concept Match</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Needs Revision</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rubric Breakdown */}
                    <div className="space-y-2 text-xs p-3 rounded-xl bg-white/5">
                      <div className="flex justify-between text-gray-400">
                        <span>Conceptual Correctness:</span>
                        <span className="font-semibold text-white">{latestEval.correctness_score}/10</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Explanation Depth:</span>
                        <span className="font-semibold text-white">{latestEval.depth_score}/10</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Clarity & Expression:</span>
                        <span className="font-semibold text-white">{latestEval.clarity_score}/10</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Teacher Feedback */}
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-gray-200 space-y-1">
                  <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Examiner Feedback:</span>
                  </div>
                  <p className="leading-relaxed">{latestEval.feedback}</p>
                </div>

                {/* Concept to Strengthen (if any) */}
                {latestEval.missing_concepts && (
                  <div className="p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-xs text-amber-300 space-y-1">
                    <div className="font-semibold">Key points to remember:</div>
                    <p className="leading-relaxed">{latestEval.missing_concepts}</p>
                  </div>
                )}

                {/* Toggle Expected Reference Answer */}
                {(latestEval.reference_answer || latestEval.model_answer) && (
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowReferenceAnswer(!showReferenceAnswer)}
                      className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white px-3 py-2 rounded-xl bg-white/5 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Compare with Reference Answer</span>
                      </span>
                      {showReferenceAnswer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showReferenceAnswer && (
                      <div className="p-3 rounded-xl bg-surfaceLight/80 border border-white/10 text-xs text-gray-300 space-y-1.5 animate-fadeIn">
                        <div className="font-semibold text-emerald-400 text-[11px] uppercase">Expected Answer:</div>
                        <p className="leading-relaxed text-gray-200 italic">
                          {latestEval.reference_answer || latestEval.model_answer}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-gray-600" />
                <p>Answer questions aloud in your own words.</p>
                <p className="text-[11px] text-gray-500">Marks and semantic equivalence analysis will appear here in real time.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline Doubt Clarification Modal */}
      {showDoubtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel max-w-lg w-full p-6 rounded-3xl space-y-4 border border-primary-500/30 bg-surfaceDark">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 text-primary-400 font-bold text-sm">
                <HelpCircle className="w-4 h-4" />
                <span>Ask Examiner a Doubt or Question</span>
              </div>
              <button
                onClick={() => setShowDoubtModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-300">
              Need clarification on the question or a related concept? Type your doubt below, and the AI examiner will explain it immediately.
            </p>
            <textarea
              value={doubtInput}
              onChange={(e) => setDoubtInput(e.target.value)}
              placeholder="e.g. Can you explain what you mean by process synchronization?"
              rows={3}
              className="w-full rounded-2xl bg-surfaceLight/80 border border-white/10 p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary-400/50 resize-none"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDoubtModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDoubt}
                disabled={!doubtInput.trim()}
                className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask Examiner</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
