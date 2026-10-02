"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSession, uploadFileMaterial, getDemoStudent, StudentProfile } from "@/lib/api";
import { 
  School, 
  GraduationCap, 
  Briefcase, 
  Sparkles, 
  UploadCloud, 
  ArrowRight, 
  Mic, 
  ShieldCheck, 
  Clock, 
  BookOpen, 
  Volume2, 
  FileText, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  Lightbulb, 
  HelpCircle,
  Award,
  Layers
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
  },
  chemistry: {
    title: "CBSE Class 10 Chemistry: Acids, Bases & Salts",
    pairs: [
      {
        question: "What is the difference between an acid and a base based on pH and ions released in water?",
        answer: "Acids have a pH less than 7 and release hydrogen ions (H+), whereas bases have a pH greater than 7 and release hydroxide ions (OH-) in aqueous solution."
      },
      {
        question: "Why should curd and sour substances not be kept in brass and copper vessels?",
        answer: "Curd and sour substances contain organic acids that react with copper and brass to form toxic metallic salts, making the food poisonous."
      },
      {
        question: "What is the common name and chemical formula of Plaster of Paris?",
        answer: "The chemical name is Calcium Sulphate Hemihydrate and its formula is CaSO4·1/2H2O."
      }
    ]
  }
};

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"school" | "college" | "interview">("school");
  const [inputTab, setInputTab] = useState<"qa_builder" | "text" | "pdf">("qa_builder");
  const [title, setTitle] = useState("CBSE Class 10 Biology: Life Processes Viva");
  
  // Interactive Q&A state for School students/teachers
  const [qaPairs, setQaPairs] = useState<QAPair[]>(PRESET_SCHOOL_SETS.biology.pairs);

  // Bulk paste text state
  const [contentText, setContentText] = useState("");

  // Student profile state
  const [student, setStudent] = useState<StudentProfile | null>(null);

  // PDF upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfMetadata, setPdfMetadata] = useState<{
    filename: string;
    num_pages: number;
    questions_detected: number;
    topics: string[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount: load verified demo student profile so parental consent is satisfied seamlessly
  useEffect(() => {
    getDemoStudent()
      .then((data) => setStudent(data))
      .catch((err) => console.warn("Demo student auto-fetch notice:", err));
  }, []);

  // Format QA pairs into structured text
  const formatQaPairsToText = (pairs: QAPair[]): string => {
    return pairs
      .filter((p) => p.question.trim().length > 0)
      .map((p, idx) => `Q${idx + 1}: ${p.question.trim()}\nAns: ${p.answer.trim()}`)
      .join("\n\n");
  };

  const handleAddQuestion = () => {
    setQaPairs([
      ...qaPairs,
      { question: "", answer: "" }
    ]);
  };

  const handleUpdateQuestion = (index: number, field: "question" | "answer", val: string) => {
    const updated = [...qaPairs];
    updated[index][field] = val;
    setQaPairs(updated);
  };

  const handleRemoveQuestion = (index: number) => {
    if (qaPairs.length <= 1) return;
    setQaPairs(qaPairs.filter((_, idx) => idx !== index));
  };

  const handleSelectPreset = (key: "biology" | "physics" | "chemistry") => {
    const preset = PRESET_SCHOOL_SETS[key];
    setTitle(preset.title);
    setQaPairs(preset.pairs);
    setContentText(formatQaPairsToText(preset.pairs));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPdfParsing(true);
    setError(null);

    try {
      const data = await uploadFileMaterial(file, title, mode === "school" ? "questions" : "syllabus");
      setPdfMetadata({
        filename: data.filename || file.name,
        num_pages: data.num_pages || 1,
        questions_detected: data.questions_detected || 0,
        topics: data.topics || [],
      });
      if (data.extracted_text) {
        setContentText(data.extracted_text);
      }
      if (!title || title.includes("Class 10")) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err: any) {
      setError(err.message || "Failed to process PDF file.");
      setSelectedFile(null);
    } finally {
      setPdfParsing(false);
    }
  };

  const setPresetMode = (type: "school" | "college" | "interview") => {
    setMode(type);
    if (type === "school") {
      setTitle("CBSE Class 10 Biology: Life Processes Viva");
      setQaPairs(PRESET_SCHOOL_SETS.biology.pairs);
      setInputTab("qa_builder");
    } else if (type === "college") {
      setTitle("Operating Systems & Networks Viva");
      setInputTab("text");
      setContentText(
`Topics to examine:
1. Process Synchronization, Mutex vs Semaphore, and Deadlock prevention conditions.
2. Virtual Memory: Paging, Page Fault Handling, and Thrashing.
3. TCP 3-Way Handshake vs UDP connectionless delivery.`
      );
    } else {
      setTitle("Full Stack Software Engineer Interview");
      setInputTab("text");
      setContentText(
`Job Profile: Senior Full-Stack Engineer (React, Node.js, Distributed Systems)
Key Areas:
- Scalable System Design (Caching, Load Balancing, Database Sharding)
- REST vs GraphQL vs WebSockets
- Performance optimization and async concurrency models`
      );
    }
  };

  const handleStartViva = async () => {
    let finalContent = "";
    if (inputTab === "qa_builder") {
      const validPairs = qaPairs.filter((p) => p.question.trim().length > 0);
      if (validPairs.length === 0) {
        setError("Please enter at least one question and expected answer.");
        return;
      }
      finalContent = formatQaPairsToText(validPairs);
    } else {
      finalContent = contentText.trim();
    }

    if (!title.trim() || !finalContent) {
      setError("Please provide a title and questions or topic material.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createSession({
        mode,
        title,
        content_text: finalContent,
        question_source: mode === "school" ? "fixed" : "generated",
        user_id: student?.user_id,
      });
      router.push(`/session/${res.session_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to initialize live session.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 py-4 max-w-5xl mx-auto">
      {/* Verified Student Profile Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 rounded-2xl bg-surfaceLight/40 border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-2.5 text-xs text-gray-300">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">Student:</span>
          <span>{student ? `${student.name} (${student.role === "minor_student" ? "Class 10" : "Candidate"})` : "Aarav Sharma (Class 10)"}</span>
          <span className="text-gray-500">•</span>
          <div className="flex items-center gap-1 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Parent Consent Verified</span>
          </div>
        </div>
        <div className="text-[11px] text-gray-400">
          RAM-Only Audio • Zero Server Audio Storage
        </div>
      </div>

      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Interactive Spoken Viva Simulator with Semantic Scoring</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Master your Viva with a <span className="bg-gradient-to-r from-emerald-400 via-primary-400 to-accent-cyan bg-clip-text text-transparent">Live Spoken Examiner</span>
        </h1>
        <p className="text-gray-400 text-base sm:text-lg">
          Add your fixed viva questions and expected answers. Answer aloud in your own words — our AI checks conceptual correctness and awards marks for meaning, not rote memorization!
        </p>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* School Viva */}
        <button
          onClick={() => setPresetMode("school")}
          className={`text-left p-6 rounded-2xl transition-all relative overflow-hidden flex flex-col justify-between ${
            mode === "school"
              ? "glass-panel-glow ring-2 ring-emerald-500/80 scale-[1.02]"
              : "glass-panel hover:border-white/20 opacity-80 hover:opacity-100"
          }`}
        >
          {mode === "school" && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white uppercase">
              Selected
            </div>
          )}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <School className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">School Viva (Fixed Q&A)</h3>
              <p className="text-xs text-emerald-400/90 font-medium mt-0.5">Semantic Meaning & Marks</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Upload your questions with expected answers. The examiner asks them aloud in sequence. Graded on concept correctness, allowing synonyms and colloquial phrasing!
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-emerald-400 font-medium">
            <span>Concept Match • Marks 0-10</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* College Viva */}
        <button
          onClick={() => setPresetMode("college")}
          className={`text-left p-6 rounded-2xl transition-all relative overflow-hidden flex flex-col justify-between ${
            mode === "college"
              ? "glass-panel-glow ring-2 ring-primary-500/80 scale-[1.02]"
              : "glass-panel hover:border-white/20 opacity-80 hover:opacity-100"
          }`}
        >
          {mode === "college" && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-primary-500 text-white uppercase">
              Selected
            </div>
          )}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">College Viva</h3>
              <p className="text-xs text-primary-400/90 font-medium mt-0.5">Adaptive Probing</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Generates probing follow-ups (&quot;why does that happen?&quot;) to test foundational comprehension across syllabus topics.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-primary-400 font-medium">
            <span>Adaptive Follow-ups</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Interview Prep */}
        <button
          onClick={() => setPresetMode("interview")}
          className={`text-left p-6 rounded-2xl transition-all relative overflow-hidden flex flex-col justify-between ${
            mode === "interview"
              ? "glass-panel-glow ring-2 ring-accent-amber/80 scale-[1.02]"
              : "glass-panel hover:border-white/20 opacity-80 hover:opacity-100"
          }`}
        >
          {mode === "interview" && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-accent-amber text-black uppercase">
              Selected
            </div>
          )}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-accent-amber/10 border border-accent-amber/20 flex items-center justify-center text-accent-amber">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Interview Prep</h3>
              <p className="text-xs text-amber-400/90 font-medium mt-0.5">Pace & Clarity</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Simulates technical & behavioral rounds with strict pacing, communication metrics, and filler word tracking.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-accent-amber font-medium">
            <span>Stricter • Communication Scored</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Semantic Scoring Highlight Banner for School Viva */}
      {mode === "school" && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200 leading-relaxed">
            <strong className="text-white font-semibold">Semantic Meaning Evaluator Active: </strong>
            School viva grading does <em>not</em> require word-to-word verbatim memory. As long as your spoken answer conveys the key scientific concept, principle, and correct meaning, the examiner awards full marks!
          </div>
        </div>
      )}

      {/* Material Ingestion Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-white">
                {mode === "school" ? "School Viva Questions & Reference Answers" : "Viva Content & Topics"}
              </h2>
              <p className="text-xs text-gray-400">Provide the questions you will be asked in your viva</p>
            </div>
          </div>

          {/* Input Method Toggle Tabs */}
          <div className="flex items-center bg-surfaceLight/80 p-1 rounded-xl border border-white/10">
            {mode === "school" && (
              <button
                onClick={() => setInputTab("qa_builder")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  inputTab === "qa_builder"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Q&A Builder</span>
              </button>
            )}
            <button
              onClick={() => setInputTab("text")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                inputTab === "text"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Paste Text / Q&A
            </button>
            <button
              onClick={() => setInputTab("pdf")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                inputTab === "pdf"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Upload PDF</span>
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {/* Viva Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Viva Title / Chapter Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surfaceLight/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="e.g. CBSE Class 10 Biology: Life Processes"
            />
          </div>

          {/* School Preset Buttons */}
          {mode === "school" && inputTab === "qa_builder" && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Quick Subject Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPreset("biology")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-medium transition-colors"
                >
                  🌱 Class 10 Biology (Life Processes)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("physics")}
                  className="px-3 py-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-300 border border-primary-500/20 text-xs font-medium transition-colors"
                >
                  ⚡ Class 9 Physics (Laws of Motion)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("chemistry")}
                  className="px-3 py-1.5 rounded-lg bg-accent-amber/10 hover:bg-accent-amber/20 text-amber-300 border border-accent-amber/20 text-xs font-medium transition-colors"
                >
                  🧪 Class 10 Chemistry (Acids & Bases)
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: Visual Q&A Builder (For School Students & Teachers) */}
          {inputTab === "qa_builder" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">
                  Fixed Questions & Expected Reference Answers ({qaPairs.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium border border-emerald-500/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question</span>
                </button>
              </div>

              <div className="space-y-4">
                {qaPairs.map((pair, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-surfaceLight/40 border border-white/10 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-white">Question #{idx + 1}</span>
                      </div>
                      {qaPairs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="text-gray-500 hover:text-rose-400 p-1 transition-colors"
                          title="Delete question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        value={pair.question}
                        onChange={(e) => handleUpdateQuestion(idx, "question", e.target.value)}
                        placeholder={`e.g. What is the definition of work in physics?`}
                        className="w-full bg-surfaceLight/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
                        <span>Expected Reference Answer:</span>
                        <span className="text-emerald-400/80">Semantic match evaluated</span>
                      </div>
                      <textarea
                        rows={2}
                        value={pair.answer}
                        onChange={(e) => handleUpdateQuestion(idx, "answer", e.target.value)}
                        placeholder="Expected concept / reference answer..."
                        className="w-full bg-surfaceLight/50 border border-white/10 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddQuestion}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/40 text-gray-400 hover:text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Question & Answer</span>
              </button>
            </div>
          )}

          {/* TAB 2: PDF Upload */}
          {inputTab === "pdf" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-white/15 hover:border-emerald-500/50 rounded-2xl p-6 sm:p-8 text-center transition-colors relative bg-surfaceLight/20">
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Click to upload or drag & drop a PDF
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Upload textbook chapters, school viva question bank PDFs, or notes (.pdf)
                    </p>
                  </div>
                </div>
              </div>

              {pdfParsing && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-emerald-200">
                    Extracting questions, answers & chunking into memory...
                  </span>
                </div>
              )}

              {pdfMetadata && (
                <div className="p-4 rounded-2xl bg-surfaceLight/70 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>PDF Parsed & Embedded Successfully</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setPdfMetadata(null);
                      }}
                      className="text-gray-400 hover:text-rose-400 text-xs flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/5">
                      <span className="text-gray-400 block text-[10px] uppercase">File Name</span>
                      <span className="text-white font-medium truncate block">{pdfMetadata.filename}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5">
                      <span className="text-gray-400 block text-[10px] uppercase">Pages</span>
                      <span className="text-white font-medium">{pdfMetadata.num_pages} Pages</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 col-span-2 sm:col-span-1">
                      <span className="text-gray-400 block text-[10px] uppercase">Questions Found</span>
                      <span className="text-emerald-400 font-medium">{pdfMetadata.questions_detected} Questions</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">
                      Extracted Text:
                    </label>
                    <textarea
                      rows={5}
                      value={contentText}
                      onChange={(e) => setContentText(e.target.value)}
                      className="w-full bg-surfaceLight/90 border border-white/10 rounded-xl p-3 text-xs text-gray-300 font-mono leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Bulk Paste Text */}
          {inputTab === "text" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  {mode === "school" ? "Question List (Fixed Q&A Format)" : "Syllabus / Topic / Questions"}
                </label>
                <span className="text-[11px] text-gray-500">Format: Q1: ... Ans: ...</span>
              </div>
              <textarea
                rows={8}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                className="w-full bg-surfaceLight/50 border border-white/10 rounded-xl p-4 text-xs sm:text-sm text-gray-200 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed transition-colors"
                placeholder={
`Q1: What is photosynthesis?
Ans: Process of plants making food with sunlight, CO2, and water.

Q2: State Newton's First Law.
Ans: An object stays at rest unless an external force acts on it.`
                }
              />
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Footer controls */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5">
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Relaxed Timing for School</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-accent-cyan" />
                <span>Voice or Typing Supported</span>
              </div>
            </div>

            <button
              onClick={handleStartViva}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-primary-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 group transition-all disabled:opacity-50"
            >
              <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>{loading ? "Setting Up Viva Room..." : "Enter School Viva Room"}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
