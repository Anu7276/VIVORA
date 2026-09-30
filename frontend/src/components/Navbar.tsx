import Link from "next/link";
import { Mic, Sparkles, BookOpen, GraduationCap, Briefcase } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-accent-cyan flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-105 transition-transform">
            <Mic className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xl tracking-tight text-white">VIVORA</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30">
                AI Viva
              </span>
            </div>
            <p className="text-xs text-gray-400">Live Voice Examination Simulator</p>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-primary-400" />
            <span>Practice Room</span>
          </Link>
          <div className="hidden sm:flex items-center gap-1.5 ml-4 pl-4 border-l border-white/10 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Live Voice Ready</span>
          </div>
        </nav>
      </div>
    </header>
  );
}
