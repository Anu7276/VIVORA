import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIVORA | AI Viva & Voice Interview Simulator",
  description: "Live voice-based AI interviewer. Upload your syllabus or questions, answer by voice, and get real-time evaluation and revision plans.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-gray-100 min-h-screen flex flex-col selection:bg-primary-500/30">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
        <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-500">
          <p>© 2026 VIVORA AI. Live Voice Viva Engine. Audio processed in memory only — no audio is stored.</p>
        </footer>
      </body>
    </html>
  );
}
