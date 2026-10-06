"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[VIVORA GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FAF9F5] text-[#20211E] flex flex-col items-center justify-center p-6 text-center font-sans antialiased">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-4 shadow-sm">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <span className="font-mono text-xs uppercase tracking-widest text-[#7D9F68] mb-2">
          Global Critical Recovery • VIVORA
        </span>

        <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#20211E] mb-3">
          A critical system exception occurred.
        </h1>

        <p className="text-sm text-[#555850] max-w-md mb-8 leading-relaxed">
          The application encountered an unexpected runtime fault. You can attempt an immediate recovery below.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 rounded-full bg-[#2D4A3E] hover:bg-[#385e4f] text-white text-xs font-mono font-semibold transition-all flex items-center space-x-2 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Application</span>
          </button>

          <a
            href="/"
            className="px-6 py-2.5 rounded-full bg-white hover:bg-[#F2EFE9] border border-[#DDD9CF] text-[#20211E] text-xs font-mono font-semibold transition-all"
          >
            Home
          </a>
        </div>
      </body>
    </html>
  );
}
