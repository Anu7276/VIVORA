import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VIVORA | AI Viva & Technical Interview Simulator",
  description: "Live voice-driven AI interviewer and oral examination simulator with instant rubric scoring, interactive whiteboard canvas, and real-time speech analytics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#fcfbf9] text-[#1e293b] font-sans min-h-screen antialiased selection:bg-[#10b981]/20 selection:text-[#047857] overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
