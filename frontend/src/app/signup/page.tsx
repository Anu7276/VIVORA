"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signup } from "@/lib/api";
import { Sparkles, ArrowRight, Lock, Mail, User, Calendar, ShieldCheck, AlertCircle, ArrowLeft } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col justify-between py-10 px-4">
      {/* Top Brand Bar */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-[#5c5f66] hover:text-[#1a1b1e] font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
        <Link href="/" className="font-serif text-lg font-bold tracking-tight text-[#1a1b1e]">
          VIVORA<span className="text-[#2d4a3e] font-sans text-xs ml-1">.ai</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-auto">
        <div className="bg-white border border-[#E5E0D4] rounded-3xl p-8 sm:p-10 shadow-xl shadow-black/[0.03] relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            {pendingConsent ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-2xl bg-[#FEF9EE] border border-[#F1DFB7] flex items-center justify-center mx-auto text-[#855B14]">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-serif text-2xl font-medium text-[#1a1b1e]">Parental Consent Required</h2>
                  <p className="text-xs text-[#5c5f66] leading-relaxed">
                    Because you are under 18, an activation email has been dispatched to{" "}
                    <span className="text-[#855B14] font-semibold">{pendingConsent.parentEmail}</span>.
                  </p>
                </div>

                <div className="p-4 bg-[#FAF9F5] border border-[#E5E0D4] rounded-2xl text-left text-xs text-[#5c5f66] space-y-1.5">
                  <p className="flex items-start gap-2">
                    <span className="text-[#2d4a3e] font-bold">•</span>
                    <span>Your parent must click the link within 48 hours to activate your student profile.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-[#2d4a3e] font-bold">•</span>
                    <span>Once approved, you can immediately begin AI viva evaluations.</span>
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                  <Link
                    href="/login"
                    className="w-full py-3 px-4 rounded-xl bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white font-medium text-xs shadow-sm transition-all text-center"
                  >
                    Go to Login
                  </Link>
                  <Link
                    href="/parent-consent/confirm"
                    className="text-xs text-[#2d4a3e] hover:text-[#1a1b1e] font-medium underline underline-offset-4 text-center"
                  >
                    Have a consent token? Confirm manually
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#E5E0D4] text-[#2d4a3e] text-xs font-medium">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Create Free Account</span>
                  </div>
                  <h1 className="font-serif text-3xl font-medium tracking-tight text-[#1a1b1e]">
                    Get Started with <span className="italic font-normal">VIVORA</span>
                  </h1>
                  <p className="text-xs text-[#5c5f66] max-w-xs mx-auto">
                    Join to practice realistic viva exams and AI-evaluated technical interviews.
                  </p>
                </div>

                {error && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1a1b1e]">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#9ca3af] absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Sharma"
                        className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1a1b1e] placeholder-[#9ca3af] focus:outline-none focus:border-[#2d4a3e] focus:ring-1 focus:ring-[#2d4a3e] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1a1b1e]">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#9ca3af] absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@example.com"
                        className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1a1b1e] placeholder-[#9ca3af] focus:outline-none focus:border-[#2d4a3e] focus:ring-1 focus:ring-[#2d4a3e] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1a1b1e]">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#9ca3af] absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 chars, 1 digit or symbol"
                        className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1a1b1e] placeholder-[#9ca3af] focus:outline-none focus:border-[#2d4a3e] focus:ring-1 focus:ring-[#2d4a3e] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1a1b1e]">Date of Birth</label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-[#9ca3af] absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1a1b1e] placeholder-[#9ca3af] focus:outline-none focus:border-[#2d4a3e] focus:ring-1 focus:ring-[#2d4a3e] transition-all [color-scheme:light]"
                      />
                    </div>
                  </div>

                  {isMinor && (
                    <div className="space-y-2 p-3.5 rounded-2xl bg-[#FEF9EE] border border-[#F1DFB7] animate-in fade-in slide-in-from-top-2 duration-300">
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
                          className="w-full bg-white border border-[#F1DFB7] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1a1b1e] placeholder-[#855B14]/40 focus:outline-none focus:border-[#855B14] focus:ring-1 focus:ring-[#855B14] transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-[#855B14]/80">
                        A confirmation link will be dispatched to your guardian to activate your viva practice sessions.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white font-medium text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-3"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center pt-2">
                  <p className="text-xs text-[#5c5f66]">
                    Already have an account?{" "}
                    <Link href="/login" className="text-[#2d4a3e] hover:text-[#1a1b1e] font-semibold underline underline-offset-4">
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer minimal */}
      <div className="w-full max-w-md mx-auto text-center text-[11px] text-[#9ca3af] pt-4">
        Protected by standard encryption • Privacy & Parental Guidelines compliant
      </div>
    </div>
  );
}
