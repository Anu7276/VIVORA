"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, SessionData } from "@/lib/api";
import { BrowserVoiceClient } from "@/lib/voice";
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
} from "lucide-react";

export default function SessionRoomPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(3);
  
  // Voice & STT state
  const [isMicActive, setIsMicActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0.2);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [latestEval, setLatestEval] = useState<any>(null);
  const [doubtExplanation, setDoubtExplanation] = useState<string | null>(null);
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
    const wsUrl = `ws://127.0.0.1:8000/ws/session/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected to Viva session room");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WS Message:", data);

        if (data.type === "question_ready") {
          setCurrentQuestion(data.question);
          setQuestionIndex(data.question_index);
          setTotalQuestions(data.total_questions || totalQuestions);
          setTranscript("");
          setLatestEval(null);
          setIsEvaluating(false);
          setDoubtExplanation(null);

          // AI TTS speaks the question
          if (data.speech?.speakable_text) {
            setIsAISpeaking(true);
            BrowserVoiceClient.speak(data.speech.speakable_text, {
              rate: data.speech.tts_payload?.rate || 0.95,
              pitch: data.speech.tts_payload?.pitch || 1.0,
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
        } else if (data.type === "followup_question") {
          setCurrentQuestion({
            ...data.question,
            order_no: `${questionIndex + 1} (Follow-up)`,
          });
          setTranscript("");
          if (data.speech?.speakable_text) {
            setIsAISpeaking(true);
            BrowserVoiceClient.speak(data.speech.speakable_text, {
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
    // If AI is speaking, interrupt it (Barge-in)
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
        setMicNotice("Microphone notice: " + (typeof err === 'string' ? err : 'Please allow mic access or use text input'));
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
        transcript: spokenText || "I answered the question with the core definition.",
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

  const handleAskDoubt = () => {
    const doubt = prompt("What is your doubt or concept to clarify?");
    if (doubt && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "ask_doubt", doubt: doubt })
      );
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel px-6 py-3.5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Mode: {session?.mode?.toUpperCase() || "SCHOOL VIVA"}
            </span>
            <div className="text-sm font-bold text-white">
              Question {questionIndex + 1} of {totalQuestions}
            </div>
          </div>
        </div>

        {/* Question Progress Stepper */}
        <div className="hidden sm:flex items-center gap-1.5">
          {Array.from({ length: totalQuestions }).map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx === questionIndex
                  ? "w-8 bg-primary-500"
                  : idx < questionIndex
                  ? "w-4 bg-emerald-500"
                  : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-300 bg-surfaceLight/60 px-3 py-1.5 rounded-lg border border-white/5">
            <TimerIcon className="w-4 h-4 text-primary-400" />
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
                <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">AI Examiner</h3>
                  <p className="text-xs text-gray-400">
                    {isAISpeaking ? "Speaking question aloud..." : "Listening to your answer"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                  {currentQuestion?.topic || "Science"}
                </span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30 capitalize">
                  {currentQuestion?.difficulty || "Medium"}
                </span>
              </div>
            </div>

            {/* Spoken Question Text */}
            <div className="min-h-[100px] flex items-center justify-center text-center px-4">
              <p className="text-xl sm:text-2xl font-semibold text-white leading-relaxed">
                {currentQuestion ? (
                  `"${currentQuestion.question_text}"`
                ) : (
                  <span className="text-gray-500 animate-pulse">Initializing viva questions...</span>
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
              <span className="text-[11px] text-gray-500">
                {isMicActive ? "Microphone Active" : "Microphone Paused"}
              </span>
            </div>

            {/* Spoken Transcript / Text Area */}
            <div className="bg-surfaceLight/30 border border-white/5 rounded-2xl p-4 min-h-[120px] flex flex-col justify-between">
              {manualInput ? (
                <textarea
                  rows={3}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Type your answer here or speak using the mic..."
                  className="w-full bg-surfaceLight/60 border border-white/10 rounded-xl p-3 text-sm text-gray-100 focus:outline-none focus:border-primary-500 font-normal leading-relaxed"
                />
              ) : (
                <p className="text-sm sm:text-base text-gray-200 leading-relaxed italic">
                  {transcript ? (
                    `"${transcript}"`
                  ) : (
                    <span className="text-gray-500 not-italic">
                      {isMicActive ? "Listening... speak your answer clearly aloud..." : "Click Start Mic or Type Answer to respond."}
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

                {session?.mode === "school" && (
                  <button
                    onClick={handleAskDoubt}
                    className="px-3.5 py-2.5 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 text-primary-300 text-xs flex items-center gap-1.5 border border-primary-500/20 transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Ask Doubt</span>
                  </button>
                )}
              </div>

              <button
                onClick={handleSubmitSpokenAnswer}
                disabled={isEvaluating}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                <span>{isEvaluating ? "Evaluating Concept..." : "Submit Answer & Next"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Real-time Evaluation & Agent Feedback */}
        <div className="space-y-6">
          {/* Doubt Resolution Card (if asked) */}
          {doubtExplanation && (
            <div className="glass-panel p-5 rounded-3xl border border-accent-cyan/30 space-y-2 bg-accent-cyan/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent-cyan">
                <Sparkles className="w-4 h-4" />
                <span>Doubt Agent Response</span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed">{doubtExplanation}</p>
            </div>
          )}

          {/* Evaluator Agent Scorecard */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-400" />
                <h3 className="text-sm font-bold text-white">Live Evaluator Agent</h3>
              </div>
              <span className="text-[10px] uppercase font-bold text-gray-400">RAG Rubric</span>
            </div>

            {isEvaluating ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-gray-400">Comparing with RAG reference answers...</p>
              </div>
            ) : latestEval ? (
              <div className="space-y-4 animate-fadeIn">
                {/* Score badge */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-surfaceLight/60 border border-white/5">
                  <span className="text-xs text-gray-300">Answer Score</span>
                  <span className="text-lg font-extrabold text-emerald-400">
                    {latestEval.overall_score} <span className="text-xs text-gray-500">/ 10</span>
                  </span>
                </div>

                {/* Rubric Breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>Correctness:</span>
                    <span className="font-semibold text-white">{latestEval.correctness_score}/10</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Depth & Mechanism:</span>
                    <span className="font-semibold text-white">{latestEval.depth_score}/10</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Clarity of Speech:</span>
                    <span className="font-semibold text-white">{latestEval.clarity_score}/10</span>
                  </div>
                </div>

                {/* Feedback */}
                <div className="p-3 rounded-xl bg-white/5 text-xs text-gray-300 space-y-1">
                  <div className="font-semibold text-primary-300">Feedback:</div>
                  <p className="leading-relaxed">{latestEval.feedback}</p>
                </div>

                {/* Missing Concept */}
                {latestEval.missing_concepts && (
                  <div className="p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-xs text-amber-300 space-y-1">
                    <div className="font-semibold">Concept to strengthen:</div>
                    <p className="leading-relaxed">{latestEval.missing_concepts}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-gray-600" />
                <p>Answer questions aloud. Evaluations and scores will appear here in real time.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
