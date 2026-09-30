"use client";

import React from "react";
import { Mic } from "lucide-react";

interface LiveTranscriptProps {
  transcript: string;
  isListening: boolean;
  isManualMode: boolean;
  onManualTextChange?: (text: string) => void;
}

export default function LiveTranscript({
  transcript,
  isListening,
  isManualMode,
  onManualTextChange,
}: LiveTranscriptProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <Mic className={`w-3.5 h-3.5 ${isListening ? "text-emerald-400 animate-pulse" : "text-gray-500"}`} />
          <span>Live Answer Transcript</span>
        </div>
        <span className="text-[11px] text-gray-500">
          {isManualMode ? "Text Input Mode" : isListening ? "Live Mic Streaming" : "Mic Paused"}
        </span>
      </div>

      <div className="bg-surfaceLight/40 border border-white/10 rounded-2xl p-4 min-h-[120px] flex flex-col justify-between">
        {isManualMode ? (
          <textarea
            rows={3}
            value={transcript}
            onChange={(e) => onManualTextChange && onManualTextChange(e.target.value)}
            placeholder="Type your spoken answer here..."
            className="w-full bg-transparent border-none focus:outline-none text-sm text-gray-100 placeholder-gray-500 font-normal leading-relaxed resize-none"
          />
        ) : (
          <p className="text-sm sm:text-base text-gray-200 leading-relaxed italic">
            {transcript ? (
              `"${transcript}"`
            ) : (
              <span className="text-gray-500 not-italic">
                {isListening
                  ? "Listening to your voice... speak your answer clearly aloud..."
                  : "Click 'Start Microphone' or toggle 'Type Answer' to respond."}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
