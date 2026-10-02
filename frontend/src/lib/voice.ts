// In-memory Voice STT, TTS, and Audio Meter utilities (no audio stored)

export interface VoiceListenerCallbacks {
  onPartialTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onError?: (err: any) => void;
  onAudioLevel?: (level: number) => void;
}

export class BrowserVoiceClient {
  private recognition: any = null;
  private isListening = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  private currentLang: string;

  constructor(lang: string = "en-IN") {
    this.currentLang = lang;
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = lang;
      }
    }
  }

  public isSupported(): boolean {
    return !!this.recognition;
  }

  public async startListening(callbacks: VoiceListenerCallbacks) {
    if (!this.recognition) {
      if (callbacks.onError) callbacks.onError("Speech recognition not supported in this browser");
      return;
    }

    try {
      this.isListening = true;
      let finalTranscript = "";

      this.recognition.onresult = (event: any) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += (finalTranscript ? " " : "") + trans;
            callbacks.onFinalTranscript(finalTranscript);
          } else {
            interimTranscript += trans;
            callbacks.onPartialTranscript(finalTranscript ? `${finalTranscript} ${interimTranscript}` : interimTranscript);
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== "no-speech" && callbacks.onError) {
          callbacks.onError(event.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch (e) {
            // Already started or restarting
          }
        }
      };

      try {
        this.recognition.start();
      } catch (e) {
        console.warn("Recognition already active", e);
      }

      // Start Audio Volume Meter for waveform visualization
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = this.audioContext.createMediaStreamSource(this.micStream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 64;
          source.connect(this.analyser);

          const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
          const updateLevel = () => {
            if (!this.isListening || !this.analyser) return;
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(1.0, avg / 80);
            if (callbacks.onAudioLevel) callbacks.onAudioLevel(normalized);
            this.animFrameId = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        } catch (err) {
          console.warn("Microphone visualizer init warning:", err);
        }
      }
    } catch (err) {
      if (callbacks.onError) callbacks.onError(err);
    }
  }

  public stopListening(): void {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  public static speak(text: string, options?: { rate?: number; pitch?: number; lang?: string; onEnd?: () => void }) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel(); // Cancel any ongoing speech (barge-in support)

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate || 0.95;
    utterance.pitch = options?.pitch || 1.0;
    utterance.lang = options?.lang || "en-IN";

    if (options?.onEnd) {
      utterance.onend = options.onEnd;
    }

    // Select natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => v.lang.includes("en-IN") || v.lang.includes("en-US") || v.name.includes("Natural")
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  public static stopSpeaking(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}
