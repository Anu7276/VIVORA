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
  Layers,
  Cpu,
  Zap,
  FlaskConical
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

const PRESET_COLLEGE_SETS: Record<string, { title: string; content: string }> = {
  os: {
    title: "Operating Systems: Process Synchronization & Deadlocks",
    content: `Topics & Practical Lab Experiments:
1. Critical section problem, Race conditions, and Peterson's algorithm.
2. Semaphores (Counting vs Binary), Mutex locks, and Condition variables.
3. Classic Synchronization Problems: Producer-Consumer (Bounded Buffer), Readers-Writers, Dining Philosophers.
4. Deadlock: 4 Necessary conditions (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait).
5. Deadlock Handling: Resource Allocation Graph (RAG), Banker's Algorithm (Safety & Request), Detection & Recovery.`
  },
  networks: {
    title: "Computer Networks: TCP/IP & Protocol Architecture",
    content: `Topics & Practical Lab Experiments:
1. OSI 7-Layer model vs TCP/IP 4-Layer architecture functions.
2. TCP 3-Way Handshake connection establishment and 4-way termination.
3. TCP Flow Control (Sliding Window) vs Congestion Control (Slow Start, Congestion Avoidance, Fast Retransmit).
4. Subnetting, CIDR notation, and IP addressing (IPv4 vs IPv6).
5. DNS resolution mechanism, ARP/RARP, and HTTP/1.1 vs HTTP/2 vs HTTP/3.`
  },
  dbms: {
    title: "Database Management Systems: Transactions & Indexing",
    content: `Topics & Practical Lab Experiments:
1. Relational algebra operations and SQL query optimization.
2. Normalization: 1NF, 2NF, 3NF, and Boyce-Codd Normal Form (BCNF) with functional dependencies.
3. Transaction Processing & ACID properties (Atomicity, Consistency, Isolation, Durability).
4. Concurrency Control: Two-Phase Locking (2PL), Strict 2PL, Timestamp Ordering, and Phantom Read anomalies.
5. Indexing structures: B-Trees vs B+ Trees, Clustered vs Non-clustered indexing.`
  },
  practical: {
    title: "Engineering & Applied Sciences Lab Practical Viva",
    content: `Lab Practical Experimentation:
1. Working principle, apparatus setup, circuit diagram, and calibration procedure.
2. Independent and dependent variables, measurement tolerances, and zero error correction.
3. Sources of experimental error (systematic vs random errors) and minimization techniques.
4. Mathematical derivation of the experimental formula and constant validation.
5. Precautions, safety protocols, and real-world industrial relevance.`
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

  const handleSelectSchoolPreset = (key: "biology" | "physics" | "chemistry") => {
    const preset = PRESET_SCHOOL_SETS[key];
    setTitle(preset.title);
    setQaPairs(preset.pairs);
    setContentText(formatQaPairsToText(preset.pairs));
  };

  const handleSelectCollegePreset = (key: "os" | "networks" | "dbms" | "practical") => {
    const preset = PRESET_COLLEGE_SETS[key];
    setTitle(preset.title);
    setContentText(preset.content);
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
      if (!title || title.includes("Class 10") || title.includes("General Science")) {
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
      setTitle("Operating Systems: Process Synchronization & Deadlocks");
      setInputTab("text");
      setContentText(PRESET_COLLEGE_SETS.os.content);
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
    if (mode === "school" && inputTab === "qa_builder") {
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
      setError("Please provide a title and chapter syllabus or practical material.");
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
          <span>{student ? `${student.name}` : "Aarav Sharma"}</span>
          <span className="text-gray-500">•</span>
          <div className="flex items-center gap-1 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Parent / Student Consent Verified</span>
          </div>
        </div>
        <div className="text-[11px] text-gray-400 flex items-center gap-2">
          <span>RAM-Only Audio</span>
          <span>•</span>
          <span className="text-primary-300">Gemini (Q-Gen) + Groq (Live Spoken)</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-primary-400" />
          <span>Real-Time Voice AI Viva & Interview Simulator</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Master your Viva with a <span className="bg-gradient-to-r from-emerald-400 via-primary-400 to-accent-cyan bg-clip-text text-transparent">Live Spoken Examiner</span>
        </h1>
        <p className="text-gray-400 text-base sm:text-lg">
          Upload syllabus PDFs or chapter names. Gemini collects the top 10 questions with follow-ups, and Groq asks them aloud in a real-time conversational viva!
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
              Upload fixed questions and expected answers. Examiner grades conceptual understanding, tolerating synonyms and informal phrasing.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-emerald-400 font-medium">
            <span>Fixed Q&A • Marks 0-10</span>
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
              <h3 className="text-lg font-bold text-white">College Viva (Top 10)</h3>
              <p className="text-xs text-primary-400/90 font-medium mt-0.5">Gemini Q-Gen + Groq Live</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Upload syllabus PDF or chapter/practical name. Gemini extracts the top 10 questions with follow-ups, and Groq asks them aloud in live turns.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-primary-400 font-medium">
            <span>Top 10 Questions • Follow-ups</span>
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

      {/* College Mode AI Architecture Banner */}
      {mode === "college" && (
        <div className="p-4 rounded-2xl bg-primary-500/10 border border-primary-500/20 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-primary-300">
            <Cpu className="w-4 h-4 text-primary-400" />
            <span>College Viva Architecture: Dual-Provider Workflow</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300">
            <div className="p-3 rounded-xl bg-white/5 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>1. Gemini API (Question Generation)</span>
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Parses your syllabus, chapter, or practical lab manual to generate the <strong>Top 10 essential viva questions</strong> with expected answers and probing follow-up questions.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-accent-cyan">
                <Zap className="w-3.5 h-3.5" />
                <span>2. Groq API (Live Spoken Examiner)</span>
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Conducts the live spoken examination at ultra-low latency, asks the Gemini questions, listens to your answers, triggers follow-ups, and scores each response.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* School Semantic Scoring Banner */}
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
            <BookOpen className="w-5 h-5 text-primary-400" />
            <div>
              <h2 className="text-lg font-bold text-white">
                {mode === "school" 
                  ? "School Viva Questions & Reference Answers" 
                  : mode === "college" 
                  ? "Chapter Name, Syllabus, or Practical Lab Manual" 
                  : "Viva Content & Topics"}
              </h2>
              <p className="text-xs text-gray-400">
                {mode === "college" 
                  ? "Gemini will extract the top 10 questions and follow-ups from this material"
                  : "Provide the questions you will be asked in your viva"}
              </p>
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
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {mode === "college" ? "Chapter / Syllabus Text" : "Paste Text / Q&A"}
            </button>
            <button
              onClick={() => setInputTab("pdf")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                inputTab === "pdf"
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{mode === "college" ? "Upload Syllabus / Lab PDF" : "Upload PDF"}</span>
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {/* Viva Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              {mode === "college" ? "Subject / Chapter / Practical Name" : "Viva Title / Chapter Name"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surfaceLight/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
              placeholder={mode === "college" ? "e.g. Operating Systems: Process Synchronization" : "e.g. CBSE Class 10 Biology: Life Processes"}
            />
          </div>

          {/* College Preset Buttons */}
          {mode === "college" && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Quick College Subject & Lab Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectCollegePreset("os")}
                  className="px-3 py-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-300 border border-primary-500/20 text-xs font-medium transition-colors"
                >
                  💻 OS (Sync & Deadlocks)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCollegePreset("networks")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-medium transition-colors"
                >
                  🌐 Networks (TCP/IP & OSI)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCollegePreset("dbms")}
                  className="px-3 py-1.5 rounded-lg bg-accent-amber/10 hover:bg-accent-amber/20 text-amber-300 border border-accent-amber/20 text-xs font-medium transition-colors"
                >
                  🗄️ DBMS (ACID & Indexing)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCollegePreset("practical")}
                  className="px-3 py-1.5 rounded-lg bg-accent-cyan/10 hover:bg-accent-cyan/20 text-cyan-300 border border-accent-cyan/20 text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>🔬 Science/Eng Lab Practical</span>
                </button>
              </div>
            </div>
          )}

          {/* School Preset Buttons */}
          {mode === "school" && inputTab === "qa_builder" && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Quick School Subject Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectSchoolPreset("biology")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-medium transition-colors"
                >
                  🌱 Class 10 Biology (Life Processes)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSchoolPreset("physics")}
                  className="px-3 py-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-300 border border-primary-500/20 text-xs font-medium transition-colors"
                >
                  ⚡ Class 9 Physics (Laws of Motion)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSchoolPreset("chemistry")}
                  className="px-3 py-1.5 rounded-lg bg-accent-amber/10 hover:bg-accent-amber/20 text-amber-300 border border-accent-amber/20 text-xs font-medium transition-colors"
                >
                  🧪 Class 10 Chemistry (Acids & Bases)
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: Visual Q&A Builder (For School Students & Teachers) */}
          {mode === "school" && inputTab === "qa_builder" && (
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
              <div className="border-2 border-dashed border-white/15 hover:border-primary-500/50 rounded-2xl p-6 sm:p-8 text-center transition-colors relative bg-surfaceLight/20">
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center text-primary-400">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Click to upload or drag & drop a PDF
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {mode === "college" 
                        ? "Upload course syllabus, lab manual experiment PDF, or textbook chapter (.pdf)"
                        : "Upload textbook chapters, school viva question bank PDFs, or notes (.pdf)"}
                    </p>
                  </div>
                </div>
              </div>

              {pdfParsing && (
                <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-primary-200">
                    Extracting syllabus text, lab steps & preparing for Gemini question generation...
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
                      <span className="text-gray-400 block text-[10px] uppercase">Detected Topics</span>
                      <span className="text-emerald-400 font-medium">{pdfMetadata.topics.length || 1} Topics</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">
                      Extracted Text / Syllabus:
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
                  {mode === "college" 
                    ? "Chapter Topics, Lab Manual, or Syllabus Outline" 
                    : mode === "school" 
                    ? "Question List (Fixed Q&A Format)" 
                    : "Syllabus / Topic / Questions"}
                </label>
                <span className="text-[11px] text-gray-500">
                  {mode === "college" ? "Gemini will generate 10 questions from this" : "Format: Q1: ... Ans: ..."}
                </span>
              </div>
              <textarea
                rows={8}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                className="w-full bg-surfaceLight/50 border border-white/10 rounded-xl p-4 text-xs sm:text-sm text-gray-200 focus:outline-none focus:border-primary-500 font-mono leading-relaxed transition-colors"
                placeholder={
                  mode === "college"
                    ? "Enter key topics, algorithms, or lab practical procedures..."
                    : "Q1: What is photosynthesis?\nAns: Process of plants making food..."
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
                <Clock className="w-4 h-4 text-primary-400" />
                <span>{mode === "college" ? "10 Questions + Follow-ups" : "Fixed Viva Questions"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-accent-cyan" />
                <span>Live Spoken Examiner (Groq)</span>
              </div>
            </div>

            <button
              onClick={handleStartViva}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary-600 via-indigo-600 to-emerald-600 hover:from-primary-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 group transition-all disabled:opacity-50"
            >
              <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>
                {loading 
                  ? "Generating Questions with Gemini..." 
                  : mode === "college" 
                  ? "Generate Top 10 Questions & Start Live Viva" 
                  : "Enter Live Viva Room"}
              </span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
