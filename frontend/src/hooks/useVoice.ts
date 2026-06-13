import { useCallback, useEffect, useRef, useState } from "react";
import { synthesizeSpeech, transcribeAudio } from "@/api/voice";
import type { VoiceMode } from "@/api/types";

const VOICE_ENABLED_KEY = "ozy-voice-enabled";
const VOICE_MODE_KEY = "ozy-voice-mode";
const AMPLITUDE_THRESHOLD = 30;
const SILENCE_MS = 1500;
const MIN_RECORDING_MS = 500;
const MAX_RECORDING_MS = 120_000;

export type VoiceState = "idle" | "recording" | "processing" | "playing";

type UseVoiceOptions = {
  onTranscript: (text: string) => void | Promise<void>;
  ttsVoice?: string;
  ttsModel?: "tts-1" | "tts-1-hd";
};

type UseVoiceResult = {
  voiceState: VoiceState;
  voiceMode: VoiceMode;
  setVoiceMode: (mode: VoiceMode) => void;
  isVoiceEnabled: boolean;
  toggleVoice: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  playResponse: (text: string) => Promise<boolean>;
  cancelPlayback: () => void;
  error: string | null;
};

function getPreferredMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "audio/webm";
  }
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "audio/webm";
}

function isAutoplayBlockedError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "NotAllowedError";
  }
  if (typeof error === "object" && error !== null && "name" in error) {
    return (error as { name?: unknown }).name === "NotAllowedError";
  }
  return false;
}

function toSpeechText(text: string): string {
  return text
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function useVoice({ onTranscript, ttsVoice = "ash", ttsModel = "tts-1" }: UseVoiceOptions): UseVoiceResult {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const voiceStateRef = useRef<VoiceState>("idle");
  const onTranscriptRef = useRef(onTranscript);
  const [error, setError] = useState<string | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(() => localStorage.getItem(VOICE_ENABLED_KEY) === "1");
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>(() => {
    const stored = localStorage.getItem(VOICE_MODE_KEY);
    return stored === "hands_free" ? "hands_free" : "push_to_talk";
  });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number>(0);
  const processingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const analyserContextRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const silenceSinceRef = useRef<number | null>(null);
  const playbackBlockedRef = useRef(false);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const updateVoiceState = useCallback((state: VoiceState) => {
    voiceStateRef.current = state;
    setVoiceState(state);
  }, []);

  useEffect(() => {
    localStorage.setItem(VOICE_ENABLED_KEY, isVoiceEnabled ? "1" : "0");
  }, [isVoiceEnabled]);

  useEffect(() => {
    localStorage.setItem(VOICE_MODE_KEY, voiceMode);
  }, [voiceMode]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stopVadLoop = useCallback((): void => {
    if (vadIntervalRef.current !== null) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (analyserContextRef.current) {
      void analyserContextRef.current.close();
      analyserContextRef.current = null;
    }
    silenceSinceRef.current = null;
  }, []);

  const releaseStream = useCallback((): void => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const cancelPlayback = useCallback((): void => {
    playbackBlockedRef.current = false;
    const synthesis =
      typeof window !== "undefined" ? (window.speechSynthesis as SpeechSynthesis | undefined) : undefined;
    if (synthesis && typeof synthesis.cancel === "function") {
      synthesis.cancel();
      speechUtteranceRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (voiceStateRef.current === "playing") {
      updateVoiceState("idle");
    }
  }, [updateVoiceState]);

  const startSpeechFallback = useCallback(
    (text: string): boolean => {
      const synthesis =
        typeof window !== "undefined" ? (window.speechSynthesis as SpeechSynthesis | undefined) : undefined;
      if (!synthesis || typeof synthesis.speak !== "function" || typeof SpeechSynthesisUtterance === "undefined") {
        return false;
      }
      try {
        if (typeof synthesis.cancel === "function") {
          synthesis.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "de-DE";
        utterance.onend = () => {
          speechUtteranceRef.current = null;
          updateVoiceState("idle");
        };
        utterance.onerror = () => {
          speechUtteranceRef.current = null;
          setError("TTS-Wiedergabe fehlgeschlagen");
          updateVoiceState("idle");
        };
        speechUtteranceRef.current = utterance;
        synthesis.speak(utterance);
        return true;
      } catch {
        speechUtteranceRef.current = null;
        return false;
      }
    },
    [updateVoiceState],
  );

  const resumeBlockedPlayback = useCallback(async (): Promise<void> => {
    if (!playbackBlockedRef.current || !audioRef.current) {
      return;
    }
    if (voiceStateRef.current === "recording" || processingRef.current) {
      return;
    }
    try {
      updateVoiceState("playing");
      await audioRef.current.play();
      playbackBlockedRef.current = false;
      setError(null);
    } catch {
      updateVoiceState("idle");
    }
  }, [updateVoiceState]);

  useEffect(() => {
    return () => {
      cancelPlayback();
      stopVadLoop();
      releaseStream();
    };
  }, [cancelPlayback, stopVadLoop, releaseStream]);

  useEffect(() => {
    const onUserInteraction = (): void => {
      void resumeBlockedPlayback();
    };
    window.addEventListener("pointerdown", onUserInteraction);
    window.addEventListener("keydown", onUserInteraction);
    return () => {
      window.removeEventListener("pointerdown", onUserInteraction);
      window.removeEventListener("keydown", onUserInteraction);
    };
  }, [resumeBlockedPlayback]);

  const ensureMicStream = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current) {
      return streamRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    return stream;
  }, []);

  const toggleVoice = useCallback(async (): Promise<void> => {
    setError(null);
    if (isVoiceEnabled) {
      stopVadLoop();
      if (voiceStateRef.current === "recording") {
        await (async () => {
          const recorder = recorderRef.current;
          if (!recorder || recorder.state === "inactive") {
            return;
          }
          await new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
            recorder.stop();
          });
        })();
      }
      releaseStream();
      setIsVoiceEnabled(false);
      updateVoiceState("idle");
      return;
    }

    try {
      await ensureMicStream();
      setIsVoiceEnabled(true);
    } catch {
      setError("Mikrofonzugriff verweigert");
      setIsVoiceEnabled(false);
    }
  }, [ensureMicStream, isVoiceEnabled, releaseStream, stopVadLoop, updateVoiceState]);

  const processRecording = useCallback(async () => {
    const blobType = recorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: blobType });
    chunksRef.current = [];
    if (blob.size === 0) {
      updateVoiceState("idle");
      return;
    }
    try {
      const text = await transcribeAudio(blob);
      if (text.trim()) {
        try {
          await onTranscriptRef.current(text);
        } catch {
          setError("Nachricht konnte nicht gesendet werden");
        }
      }
    } catch {
      setError("Transkription fehlgeschlagen");
    } finally {
      updateVoiceState("idle");
      processingRef.current = false;
    }
  }, [updateVoiceState]);

  const startRecording = useCallback(async (): Promise<void> => {
    if (
      !isVoiceEnabled ||
      voiceStateRef.current === "recording" ||
      processingRef.current ||
      voiceStateRef.current === "playing"
    ) {
      return;
    }
    setError(null);
    try {
      const stream = await ensureMicStream();
      const recorder = new MediaRecorder(stream, { mimeType: getPreferredMimeType() });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      silenceSinceRef.current = null;
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.start();
      updateVoiceState("recording");
    } catch {
      setError("Aufnahme konnte nicht gestartet werden");
      updateVoiceState("idle");
    }
  }, [ensureMicStream, isVoiceEnabled, updateVoiceState]);

  const stopRecording = useCallback(async (): Promise<void> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive" || processingRef.current) {
      return;
    }
    processingRef.current = true;
    updateVoiceState("processing");
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    await processRecording();
  }, [processRecording, updateVoiceState]);

  useEffect(() => {
    if (!isVoiceEnabled || voiceMode !== "hands_free") {
      stopVadLoop();
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const stream = await ensureMicStream();
        if (cancelled) {
          return;
        }
        const context = new AudioContext();
        analyserContextRef.current = context;
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        vadIntervalRef.current = window.setInterval(() => {
          analyser.getByteFrequencyData(data);
          const average = data.reduce((sum, value) => sum + value, 0) / data.length;
          const isSpeaking = average > AMPLITUDE_THRESHOLD;
          const now = Date.now();
          const currentState = voiceStateRef.current;

          if (isSpeaking) {
            silenceSinceRef.current = null;
            if (currentState === "idle") {
              void startRecording();
            }
            return;
          }

          if (currentState === "recording") {
            const elapsed = now - recordingStartedAtRef.current;
            if (elapsed >= MAX_RECORDING_MS) {
              void stopRecording();
              return;
            }
            if (silenceSinceRef.current === null) {
              silenceSinceRef.current = now;
              return;
            }
            if (elapsed >= MIN_RECORDING_MS && now - silenceSinceRef.current >= SILENCE_MS) {
              void stopRecording();
            }
          }
        }, 120);
      } catch {
        if (!cancelled) {
          setError("Freisprechen konnte nicht gestartet werden");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopVadLoop();
    };
  }, [ensureMicStream, isVoiceEnabled, startRecording, stopRecording, stopVadLoop, voiceMode]);

  const playResponse = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) {
        return false;
      }
      const speechText = toSpeechText(trimmed) || trimmed;
      cancelPlayback();
      updateVoiceState("playing");
      setError(null);
      // Prefer browser-native speech for immediate and local playback.
      if (startSpeechFallback(speechText)) {
        playbackBlockedRef.current = false;
        return true;
      }
      try {
        const blob = await synthesizeSpeech(speechText, ttsVoice, ttsModel);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          cancelPlayback();
          updateVoiceState("idle");
        };
        try {
          await audio.play();
          playbackBlockedRef.current = false;
          return true;
        } catch (error) {
          if (isAutoplayBlockedError(error)) {
            const fallbackPlayed = startSpeechFallback(speechText);
            if (fallbackPlayed) {
              playbackBlockedRef.current = false;
              setError(null);
              return true;
            }
            playbackBlockedRef.current = true;
            updateVoiceState("idle");
            setError("Wiedergabe wartet auf Interaktion");
            return false;
          }
          throw error;
        }
      } catch {
        const fallbackPlayed = startSpeechFallback(speechText);
        if (fallbackPlayed) {
          playbackBlockedRef.current = false;
          setError(null);
          return true;
        }
        cancelPlayback();
        playbackBlockedRef.current = false;
        setError("TTS-Wiedergabe fehlgeschlagen");
        updateVoiceState("idle");
        return false;
      }
    },
    [cancelPlayback, startSpeechFallback, ttsModel, ttsVoice, updateVoiceState],
  );

  const setVoiceMode = useCallback((mode: VoiceMode): void => {
    setVoiceModeState(mode);
  }, []);

  return {
    voiceState,
    voiceMode,
    setVoiceMode,
    isVoiceEnabled,
    toggleVoice,
    startRecording,
    stopRecording,
    playResponse,
    cancelPlayback,
    error,
  };
}
