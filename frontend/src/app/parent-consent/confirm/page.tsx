"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { confirmParentConsent } from "@/lib/api";
import { ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, KeyRound, ArrowLeft } from "lucide-react";

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
              <div className="w-14 h-14 rounded-2xl bg-[#FEF9EE] border border-[#F1DFB7] flex items-center justify-center mx-auto text-[#855B14]">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h1 className="font-serif text-2xl font-medium tracking-tight text-[#1a1b1e]">
                Parental Consent Verification
              </h1>
              <p className="text-xs text-[#5c5f66] max-w-xs mx-auto">
                Authorize and activate your child's VIVORA school viva practice account.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {success ? (
              <div className="text-center space-y-4 py-2">
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  <span className="font-semibold text-sm text-[#1a1b1e]">Account Successfully Activated</span>
                  <span className="text-xs text-[#5c5f66]">{success}</span>
                </div>
                <p className="text-xs text-[#5c5f66]">
                  The student can now log in and take AI-assessed viva examinations.
                </p>
                <Link
                  href="/login"
                  className="w-full py-3 px-4 rounded-xl bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white font-medium text-sm shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <span>Proceed to Student Login</span>
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
                  <label className="text-xs font-semibold text-[#1a1b1e]">Consent Verification Token</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#9ca3af] absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Enter or paste verification token"
                      className="w-full bg-[#FAF9F5] border border-[#E5E0D4] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1a1b1e] placeholder-[#9ca3af] focus:outline-none focus:border-[#2d4a3e] focus:ring-1 focus:ring-[#2d4a3e] transition-all font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-3 px-4 rounded-xl bg-[#1a1b1e] hover:bg-[#2d4a3e] text-white font-medium text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
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
              <Link href="/" className="text-xs text-[#5c5f66] hover:text-[#1a1b1e] font-medium underline underline-offset-4">
                Return to VIVORA Home
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer minimal */}
      <div className="w-full max-w-md mx-auto text-center text-[11px] text-[#9ca3af] pt-4">
        COPPA & Student Privacy Compliant • VIVORA
      </div>
    </div>
  );
}

export default function ParentConsentConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center text-[#5c5f66] text-sm font-sans">Loading verification...</div>}>
      <ConsentConfirmForm />
    </Suspense>
  );
}
