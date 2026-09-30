"use client";

import React from "react";
import { Volume2, Sparkles, VolumeX } from "lucide-react";
import AudioWave from "./AudioWave";

interface AIVoicePlayerProps {
  isSpeaking: boolean;
  questionText: string;
  topic?: string;
  difficulty?: string;
  onStopSpeaking?: () => void;
}

export default function AIVoicePlayer({
  isSpeaking,
  questionText,
  topic = "General",
  difficulty = "medium",
  onStopSpeaking,
}: AIVoicePlayerProps) {
  return (
    <div className="glass-panel-glow p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
            {isSpeaking ? (
              <Volume2 className="w-5 h-5 text-primary-300 animate-pulse" />
            ) : (
              <Sparkles className="w-5 h-5 text-primary-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Examiner</h3>
            <p className="text-xs text-gray-400">
              {isSpeaking ? "Speaking question aloud..." : "Awaiting your spoken answer"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
            {topic}
          </span>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30 capitalize">
            {difficulty}
          </span>
          {isSpeaking && onStopSpeaking && (
            <button
              onClick={onStopSpeaking}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Stop audio (Barge in)"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-[90px] flex items-center justify-center text-center px-4">
        <p className="text-xl sm:text-2xl font-semibold text-white leading-relaxed">
          {questionText ? `"${questionText}"` : <span className="text-gray-500 animate-pulse">Preparing question...</span>}
        </p>
      </div>

      <div className="border-t border-white/5 pt-4">
        <AudioWave isSpeaking={isSpeaking} isAI={true} level={0.85} />
      </div>
    </div>
  );
}
