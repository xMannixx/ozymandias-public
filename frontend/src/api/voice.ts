import { request } from "@/api/client";
import { getToken } from "@/store/auth";
import type { VoiceTranscriptionResponse, VoiceVoicesResponse } from "@/api/types";

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioBlob, "voice.webm");

  const response = await request<VoiceTranscriptionResponse>("/voice/stt", {
    method: "POST",
    body: formData,
  });
  return response.text;
}

type TTSPayload = {
  text: string;
  voice?: string;
  model?: "tts-1" | "tts-1-hd";
};

export async function synthesizeSpeech(text: string, voice?: string, model?: "tts-1" | "tts-1-hd"): Promise<Blob> {
  const token = getToken();
  const response = await fetch("/voice/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, voice, model } satisfies TTSPayload),
  });
  if (!response.ok) {
    throw new Error("TTS request failed");
  }
  return response.blob();
}

export async function getVoices(): Promise<string[]> {
  const response = await request<VoiceVoicesResponse>("/voice/voices");
  return response.voices;
}
