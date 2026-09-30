"use client";

import React from "react";

interface AudioWaveProps {
  isSpeaking: boolean;
  isAI: boolean;
  level?: number;
}

export default function AudioWave({ isSpeaking, isAI, level = 0.5 }: AudioWaveProps) {
  const bars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <div className="flex items-center justify-center gap-1.5 h-14 px-4 py-2">
      {bars.map((bar, i) => {
        const heightMultiplier = isSpeaking
          ? Math.max(0.2, (Math.sin(i * 0.6) * 0.5 + 0.5) * (level + 0.4))
          : 0.15;
        
        return (
          <div
            key={bar}
            className={`w-1.5 rounded-full transition-all duration-150 ${
              isAI
                ? "bg-gradient-to-t from-primary-600 to-accent-cyan shadow-sm shadow-primary-500/50"
                : "bg-gradient-to-t from-emerald-500 to-accent-cyan shadow-sm shadow-emerald-500/50"
            }`}
            style={{
              height: `${Math.max(6, heightMultiplier * 48)}px`,
              opacity: isSpeaking ? 0.9 : 0.25,
            }}
          />
        );
      })}
    </div>
  );
}
