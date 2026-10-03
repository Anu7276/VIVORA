import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VIVORA — Intelligent AI Study, Viva & Interview Platform",
  description: "Study smarter. Speak better. Perform with confidence. Your AI workspace for studying, viva preparation, technical interviews, and real-world oral communication.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#FAF9F5] text-[#1a1b1e] font-sans min-h-screen antialiased selection:bg-[#0f766e]/15 selection:text-[#0f766e] overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
