"use client";

import React, { useEffect, useState } from "react";
import { Timer as TimerIcon, AlertTriangle } from "lucide-react";

interface TimerProps {
  maxMinutes?: number;
  onTimeUp?: () => void;
}

export default function Timer({ maxMinutes = 15, onTimeUp }: TimerProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const totalSeconds = maxMinutes * 60;

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => {
        if (prev + 1 >= totalSeconds) {
          clearInterval(interval);
          if (onTimeUp) onTimeUp();
          return totalSeconds;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [totalSeconds, onTimeUp]);

  const remainingSeconds = Math.max(0, totalSeconds - secondsElapsed);
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const isLowTime = remainingSeconds < 180; // less than 3 mins

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-colors ${
        isLowTime
          ? "bg-rose-500/10 border-rose-500/30 text-rose-300 animate-pulse"
          : "bg-surfaceLight/60 border-white/10 text-gray-300"
      }`}
    >
      {isLowTime ? (
        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
      ) : (
        <TimerIcon className="w-3.5 h-3.5 text-primary-400" />
      )}
      <span>
        {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
      </span>
      <span className="text-[10px] text-gray-500 font-sans uppercase">Remaining</span>
    </div>
  );
}
