"use client";

import React from "react";
import { Mic, MicOff } from "lucide-react";
import AudioWave from "./AudioWave";

interface MicStreamProps {
  isListening: boolean;
  audioLevel: number;
  onToggle: () => void;
  disabled?: boolean;
}

export default function MicStream({
  isListening,
  audioLevel,
  onToggle,
  disabled = false,
}: MicStreamProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full flex items-center justify-center">
        <AudioWave isSpeaking={isListening} isAI={false} level={audioLevel} />
      </div>

      <button
        onClick={onToggle}
        disabled={disabled}
        className={`px-5 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 transition-all shadow-md ${
          isListening
            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 shadow-rose-500/10"
            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 shadow-emerald-500/10"
        } disabled:opacity-50`}
      >
        {isListening ? (
          <>
            <MicOff className="w-4 h-4 text-rose-400" />
            <span>Mute Microphone</span>
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Start Microphone</span>
          </>
        )}
      </button>
    </div>
  );
}
