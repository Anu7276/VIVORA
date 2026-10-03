"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { confirmParentConsent } from "@/lib/api";
import { ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, KeyRound } from "lucide-react";

function ConsentConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";

  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (tokenToUse: string) => {
    if (!tokenToUse.trim()) {
      setError("Please provide a valid consent token.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await confirmParentConsent(tokenToUse.trim());
      setSuccess(res.message || "Parental consent successfully verified. The student's account is now active!");
    } catch (err: any) {
      setError(err.message || "Failed to confirm parental consent. The token may be expired or invalid.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialToken) {
      handleConfirm(initialToken);
    }
  }, [initialToken]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl relative overflow-hidden border border-white/10 shadow-2xl">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Parental Consent Confirmation</h1>
            <p className="text-xs text-gray-400">
              Verify consent to activate your child's VIVORA practice account
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <span className="font-semibold text-sm">Account Successfully Activated!</span>
                <span className="text-[11px] text-emerald-400/80">{success}</span>
              </div>
              <p className="text-xs text-gray-300">
                The student may now log in to begin their school viva practice sessions.
              </p>
              <Link
                href="/login"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all"
              >
                <span>Proceed to Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirm(token);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Consent Verification Token</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter or paste consent token"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify & Confirm Consent</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link href="/" className="text-xs text-gray-400 hover:text-white underline underline-offset-4">
              Return to VIVORA Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ParentConsentConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white text-sm">Loading...</div>}>
      <ConsentConfirmForm />
    </Suspense>
  );
}
