"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception to monitoring
    console.error("[VIVORA ErrorBoundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#20211E] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-4 shadow-2xs">
        <AlertCircle className="w-6 h-6" />
      </div>

      <span className="font-mono text-xs uppercase tracking-widest text-[#7D9F68] mb-2">
        System Interruption • Academic Continuity Safe
      </span>

      <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#20211E] mb-3">
        Something unexpected interrupted your session.
      </h1>

      <p className="text-sm text-[#555850] max-w-md mb-8 leading-relaxed">
        Your examination data and progress are safe. You can retry the current operation or return to the main dashboard.
      </p>

      {error?.message && (
        <div className="max-w-md w-full mb-6 p-3 bg-white border border-[#E8E4DA] rounded-xl text-left font-mono text-[11px] text-[#555850] overflow-x-auto shadow-2xs">
          <span className="font-semibold text-red-600">Error trace: </span>
          {error.message}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-full bg-[#2D4A3E] hover:bg-[#385e4f] text-white text-xs font-mono font-semibold transition-all flex items-center space-x-2 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Session</span>
        </button>

        <Link
          href="/"
          className="px-5 py-2.5 rounded-full bg-white hover:bg-[#F2EFE9] border border-[#DDD9CF] text-[#20211E] text-xs font-mono font-semibold transition-all flex items-center space-x-2"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
