"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, getAuthToken } from "@/lib/api";
import { Sparkles, ArrowRight, Lock, Mail, AlertCircle, ArrowLeft, Eye, EyeOff, ShieldCheck, CheckCircle2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAuthToken()) {
      router.push(redirectPath);
    }
  }, [router, redirectPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      router.push(redirectPath);
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col justify-between py-8 px-4 relative overflow-hidden selection:bg-[#7D9F68]/20">
      
      {/* ── ATMOSPHERIC MOUNTAIN BACKGROUND ── */}
      <div 
        className="nature-memory-layer nature-mask-full animate-nature-drift inset-0 h-full w-full pointer-events-none select-none"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=2400&q=85')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          opacity: 0.72,
        }}
      />

      {/* Atmospheric Soft Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/40 via-[#FAF9F5]/20 to-[#FAF9F5]/70 pointer-events-none z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] md:w-[900px] h-[550px] bg-gradient-to-r from-[#FAF9F5]/90 via-[#FAF9F5]/70 to-[#FAF9F5]/90 blur-3xl pointer-events-none rounded-full z-0" />

      {/* ── TOP NAVIGATION BAR ── */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white backdrop-blur-md border border-[#DDD9CF] text-xs text-[#5c5f66] hover:text-[#1a1b1e] font-medium transition-all shadow-2xs hover:shadow-xs group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Home</span>
        </Link>
        
        <Link href="/" className="flex items-center space-x-2 group">
          <span className="w-6 h-6 rounded-full bg-[#20211E] text-white flex items-center justify-center text-[10px] shadow-xs group-hover:scale-105 transition-transform">✦</span>
          <span className="font-serif italic text-xl font-medium tracking-tight text-[#20211E]">
            vivora<span className="text-[#7D9F68] font-sans text-xs ml-0.5 not-italic">.ai</span>
          </span>
        </Link>
      </div>

      {/* ── MAIN ELEVATED GLASS CARD ── */}
      <div className="w-full max-w-md mx-auto my-auto relative z-10 py-6">
        <div className="glass-card-elevated rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_-15px_rgba(32,33,30,0.12),0_1px_3px_rgba(0,0,0,0.02)] relative overflow-hidden transition-all">
          
          {/* Subtle top accent shimmer */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#7D9F68]/40 to-transparent" />

          <div className="relative z-10 space-y-6">
            
            {/* Header / Titles */}
            <div className="text-center space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FAF9F5] border border-[#DDD9CF] text-[#4a5043] text-[11px] font-mono uppercase tracking-wider shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7D9F68] animate-pulse" />
                <span>AI Viva & Interview Simulator</span>
              </div>
              
              <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#20211E] pt-1">
                Welcome <span className="italic text-[#7D9F68]">Back</span>
              </h1>
              
              <p className="text-xs text-[#6F7069] max-w-xs mx-auto leading-relaxed">
                Sign in to enter live oral defense rooms, audio examinations, and personalized weakness analytics.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-700 animate-fadeIn">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#20211E]">Email Address</label>
                </div>
                <div className="relative group">
                  <Mail className="w-4 h-4 text-[#5A5D64] group-focus-within:text-[#20211E] absolute left-3.5 top-3.5 pointer-events-none transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full bg-[#FAF9F5]/90 border border-[#DDD9CF] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#20211E] placeholder-[#9ca3af] focus:outline-none focus:border-[#20211E] focus:bg-white focus:ring-2 focus:ring-[#20211E]/5 transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#20211E]">Password</label>
                </div>
                <div className="relative group">
                  <Lock className="w-4 h-4 text-[#5A5D64] group-focus-within:text-[#20211E] absolute left-3.5 top-3.5 pointer-events-none transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#FAF9F5]/90 border border-[#DDD9CF] rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[#20211E] placeholder-[#9ca3af] focus:outline-none focus:border-[#20211E] focus:bg-white focus:ring-2 focus:ring-[#20211E]/5 transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-[#5A5D64] hover:text-[#20211E] transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button with Hover & Glow Effect */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#20211E] hover:bg-[#343631] text-white font-medium text-xs sm:text-sm shadow-[0_10px_25px_-5px_rgba(32,33,30,0.25)] hover:shadow-[0_15px_30px_-5px_rgba(32,33,30,0.35)] flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-3 group"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to VIVORA</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Switch to Signup */}
            <div className="text-center pt-2 border-t border-[#EBE7DD]">
              <p className="text-xs text-[#6F7069]">
                Don't have an account?{" "}
                <Link href="/signup" className="text-[#20211E] hover:text-[#7D9F68] font-semibold underline underline-offset-4 transition-colors">
                  Create account free
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Ambient telemetry indicators below card */}
        <div className="flex items-center justify-center gap-4 text-[11px] font-mono text-[#787c74] pt-4">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#7D9F68]" />
            <span>256-bit Encrypted</span>
          </span>
          <span>•</span>
          <span>Zero Audio Retained</span>
        </div>
      </div>

      {/* ── FOOTER MINIMAL ── */}
      <div className="w-full max-w-md mx-auto text-center text-[11px] font-mono text-[#5A5D64] relative z-10">
        © 2026 VIVORA AI • Intellectual Oral Preparation
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center text-[#5c5f66] text-sm font-sans">Loading VIVORA...</div>}>
      <LoginForm />
    </Suspense>
  );
}
