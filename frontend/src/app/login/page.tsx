"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, getAuthToken } from "@/lib/api";
import { Sparkles, ArrowRight, Lock, Mail, AlertCircle, ArrowLeft } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#E5E0D4] text-[#2d4a3e] text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Viva & Interview Simulator</span>
              </div>
              <h1 className="font-serif text-3xl font-medium tracking-tight text-[#1a1b1e]">
                Welcome <span className="italic font-normal">Back</span>
              </h1>
              <p className="text-xs text-[#5c5f66] max-w-xs mx-auto">
                Sign in to access your viva sessions, reports, and AI analytics.
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
                <label className="text-xs font-semibold text-[#1a1b1e]">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#9ca3af] absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1a1b1e] placeholder-[#9ca3af] focus:outline-none focus:border-[#2d4a3e] focus:ring-1 focus:ring-[#2d4a3e] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#1a1b1e]">Password</label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#9ca3af] absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1a1b1e] placeholder-[#9ca3af] focus:outline-none focus:border-[#2d4a3e] focus:ring-1 focus:ring-[#2d4a3e] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white font-medium text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <p className="text-xs text-[#5c5f66]">
                Don't have an account?{" "}
                <Link href="/signup" className="text-[#2d4a3e] hover:text-[#1a1b1e] font-semibold underline underline-offset-4">
                  Create account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer minimal */}
      <div className="w-full max-w-md mx-auto text-center text-[11px] text-[#9ca3af] pt-4">
        Protected by standard encryption • VIVORA Engine
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
