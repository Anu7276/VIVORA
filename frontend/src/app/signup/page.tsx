"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signup } from "@/lib/api";
import { Sparkles, ArrowRight, Lock, Mail, User, Calendar, ShieldCheck, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [dob, setDob] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConsent, setPendingConsent] = useState<{ parentEmail: string; message: string } | null>(null);

  // Compute minor status based on date of birth
  const isMinor = useMemo(() => {
    if (!dob) return false;
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age < 18;
  }, [dob]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    if (isMinor && !parentEmail.trim()) {
      setError("Parent or guardian email is required for students under 18.");
      return;
    }

    if (isMinor && parentEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
      setError("Parent email cannot be the same as child's email.");
      return;
    }

    setLoading(true);

    try {
      const res = await signup({
        name,
        email,
        password,
        date_of_birth: dob,
        parent_email: isMinor ? parentEmail : undefined,
      });

      if (res.account_status === "pending_parent_consent") {
        setPendingConsent({
          parentEmail: parentEmail || "your parent/guardian",
          message: res.message || "A consent confirmation link has been sent to your parent/guardian.",
        });
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] md:w-[900px] h-[600px] bg-gradient-to-r from-[#FAF9F5]/90 via-[#FAF9F5]/70 to-[#FAF9F5]/90 blur-3xl pointer-events-none rounded-full z-0" />

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
            {pendingConsent ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-2xl bg-[#FEF9EE] border border-[#F1DFB7] flex items-center justify-center mx-auto text-[#855B14] shadow-xs">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-serif text-2xl font-normal text-[#20211E]">Parental Consent Required</h2>
                  <p className="text-xs text-[#6F7069] leading-relaxed">
                    Because you are under 18, an activation link has been dispatched to{" "}
                    <span className="text-[#855B14] font-semibold">{pendingConsent.parentEmail}</span>.
                  </p>
                </div>

                <div className="p-4 bg-[#FAF9F5] border border-[#DDD9CF] rounded-2xl text-left text-xs text-[#5c5f66] space-y-2">
                  <p className="flex items-start gap-2">
                    <span className="text-[#7D9F68] font-bold">•</span>
                    <span>Your parent must click the link within 48 hours to activate your student profile.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-[#7D9F68] font-bold">•</span>
                    <span>Once approved, you can immediately begin AI viva evaluations.</span>
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                  <Link
                    href="/login"
                    className="w-full py-3 px-4 rounded-xl bg-[#20211E] hover:bg-[#343631] text-white font-medium text-xs shadow-md transition-all text-center"
                  >
                    Go to Login
                  </Link>
                  <Link
                    href="/parent-consent/confirm"
                    className="text-xs text-[#20211E] hover:text-[#7D9F68] font-medium underline underline-offset-4 text-center transition-colors"
                  >
                    Have a consent token? Confirm manually
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FAF9F5] border border-[#DDD9CF] text-[#4a5043] text-[11px] font-mono uppercase tracking-wider shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7D9F68] animate-pulse" />
                    <span>Create Student Account</span>
                  </div>
                  
                  <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#20211E] pt-1">
                    Get Started with <span className="italic text-[#7D9F68]">VIVORA</span>
                  </h1>
                  
                  <p className="text-xs text-[#6F7069] max-w-xs mx-auto leading-relaxed">
                    Join to practice realistic viva exams, oral thesis defenses, and AI technical interviews.
                  </p>
                </div>

                {error && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-700 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5">
                  
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#20211E]">Full Name</label>
                    <div className="relative group">
                      <User className="w-4 h-4 text-[#5A5D64] group-focus-within:text-[#20211E] absolute left-3.5 top-3.5 pointer-events-none transition-colors" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Sharma"
                        className="w-full bg-[#FAF9F5]/90 border border-[#DDD9CF] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#20211E] placeholder-[#9ca3af] focus:outline-none focus:border-[#20211E] focus:bg-white focus:ring-2 focus:ring-[#20211E]/5 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#20211E]">Email Address</label>
                    <div className="relative group">
                      <Mail className="w-4 h-4 text-[#5A5D64] group-focus-within:text-[#20211E] absolute left-3.5 top-3.5 pointer-events-none transition-colors" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@example.com"
                        className="w-full bg-[#FAF9F5]/90 border border-[#DDD9CF] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#20211E] placeholder-[#9ca3af] focus:outline-none focus:border-[#20211E] focus:bg-white focus:ring-2 focus:ring-[#20211E]/5 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#20211E]">Password</label>
                    <div className="relative group">
                      <Lock className="w-4 h-4 text-[#5A5D64] group-focus-within:text-[#20211E] absolute left-3.5 top-3.5 pointer-events-none transition-colors" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 chars, 1 digit or symbol"
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

                  {/* Confirm Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#20211E]">Confirm Password</label>
                    <div className="relative group">
                      <Lock className="w-4 h-4 text-[#5A5D64] group-focus-within:text-[#20211E] absolute left-3.5 top-3.5 pointer-events-none transition-colors" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className="w-full bg-[#FAF9F5]/90 border border-[#DDD9CF] rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[#20211E] placeholder-[#9ca3af] focus:outline-none focus:border-[#20211E] focus:bg-white focus:ring-2 focus:ring-[#20211E]/5 transition-all shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-3 text-[#5A5D64] hover:text-[#20211E] transition-colors"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#20211E]">Date of Birth</label>
                    <div className="relative group">
                      <Calendar className="w-4 h-4 text-[#5A5D64] group-focus-within:text-[#20211E] absolute left-3.5 top-3.5 pointer-events-none transition-colors" />
                      <input
                        type="date"
                        required
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full bg-[#FAF9F5]/90 border border-[#DDD9CF] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#20211E] placeholder-[#9ca3af] focus:outline-none focus:border-[#20211E] focus:bg-white focus:ring-2 focus:ring-[#20211E]/5 transition-all [color-scheme:light] shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Under 18 Minor Notice */}
                  {isMinor && (
                    <div className="space-y-2 p-3.5 rounded-2xl bg-[#FEF9EE] border border-[#F1DFB7] animate-fadeIn">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#855B14]">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Parent / Guardian Email Required (Under 18)</span>
                      </div>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#855B14]/60 absolute left-3.5 top-3.5 pointer-events-none" />
                        <input
                          type="email"
                          required
                          value={parentEmail}
                          onChange={(e) => setParentEmail(e.target.value)}
                          placeholder="parent@example.com"
                          className="w-full bg-white border border-[#F1DFB7] rounded-xl pl-10 pr-4 py-2 text-xs text-[#20211E] placeholder-[#855B14]/40 focus:outline-none focus:border-[#855B14] focus:ring-1 focus:ring-[#855B14] transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-[#855B14]/80 leading-relaxed">
                        A confirmation link will be dispatched to your guardian to activate your viva practice sessions.
                      </p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-[#20211E] hover:bg-[#343631] text-white font-medium text-xs sm:text-sm shadow-[0_10px_25px_-5px_rgba(32,33,30,0.25)] hover:shadow-[0_15px_30px_-5px_rgba(32,33,30,0.35)] flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-3 group"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Create Free Account</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                {/* Switch to Login */}
                <div className="text-center pt-2 border-t border-[#EBE7DD]">
                  <p className="text-xs text-[#6F7069]">
                    Already have an account?{" "}
                    <Link href="/login" className="text-[#20211E] hover:text-[#7D9F68] font-semibold underline underline-offset-4 transition-colors">
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Ambient security badge below card */}
        <div className="flex items-center justify-center gap-4 text-[11px] font-mono text-[#787c74] pt-4">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#7D9F68]" />
            <span>Parental Guidelines & COPPA Compliant</span>
          </span>
        </div>
      </div>

      {/* ── FOOTER MINIMAL ── */}
      <div className="w-full max-w-md mx-auto text-center text-[11px] font-mono text-[#5A5D64] relative z-10">
        Protected by standard encryption • VIVORA Engine
      </div>
    </div>
  );
}
