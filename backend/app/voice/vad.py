import time
from typing import Optional

class VoiceActivityDetector:
    """
    In-memory Voice Activity Detector (VAD).
    Tracks speech start, pause duration, silence threshold, and barge-in triggers.
    Audio samples or speech frames are inspected strictly in memory.
    """
    def __init__(self, silence_threshold_sec: float = 2.0, mode: str = "school"):
        # School mode allows longer silence pauses for kids thinking
        if mode == "school":
            self.silence_threshold_sec = 2.5
        elif mode == "college":
            self.silence_threshold_sec = 1.8
        else: # interview
            self.silence_threshold_sec = 1.4

        self.last_speech_time: Optional[float] = None
        self.is_speaking: bool = False
        self.speech_start_time: Optional[float] = None

    def on_speech_frame(self, has_voice: bool) -> dict:
        """
        Processes a speech frame or transcript chunk event.
        Returns status dictionary: {is_speaking, answer_finished, duration_sec, barge_in}
        """
        now = time.time()
        barge_in = False
        answer_finished = False

        if has_voice:
            if not self.is_speaking:
                self.is_speaking = True
                self.speech_start_time = now
                barge_in = True  # User started speaking (can interrupt AI TTS if playing)
            self.last_speech_time = now
        else:
            if self.is_speaking and self.last_speech_time:
                silence_duration = now - self.last_speech_time
                if silence_duration >= self.silence_threshold_sec:
                    self.is_speaking = False
                    answer_finished = True

        duration = 0.0
        if self.speech_start_time:
            duration = (self.last_speech_time or now) - self.speech_start_time

        return {
            "is_speaking": self.is_speaking,
            "answer_finished": answer_finished,
            "duration_sec": round(duration, 1),
            "barge_in": barge_in
        }

    def reset(self):
        self.last_speech_time = None
        self.is_speaking = False
        self.speech_start_time = None
