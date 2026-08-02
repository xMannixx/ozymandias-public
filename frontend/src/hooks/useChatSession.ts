import { useEffect, useRef } from "react";
import { useChat, type UseChatOptions, type UseChatResult } from "@/hooks/useChat";
import { useSettings } from "@/hooks/useSettings";
import { useVoice, type UseVoiceResult } from "@/hooks/useVoice";

export type UseChatSessionResult = UseChatResult & {
  voice: UseVoiceResult;
};

/**
 * Chat state plus the voice glue that every chat surface needs: reading answers
 * aloud and push-to-talk. Passing a project id scopes the session to that
 * workspace.
 */
export function useChatSession(options: UseChatOptions = {}): UseChatSessionResult {
  const chat = useChat(options);
  const { settings } = useSettings();
  const voice = useVoice({
    onTranscript: async (text) => {
      await chat.sendMessage(text);
    },
    ttsVoice: settings?.tts_voice ?? "ash",
    ttsModel: settings?.tts_model ?? "tts-1",
  });
  const { isVoiceEnabled, voiceMode, playResponse, startRecording, stopRecording } = voice;
  const lastPlayedAssistantIdRef = useRef<string | null>(null);
  const autoplayEnabled = settings?.tts_autoplay ?? true;

  useEffect(() => {
    if (!autoplayEnabled) {
      return;
    }
    const latestAssistant = chat.messages.filter((message) => message.role === "assistant").at(-1);
    if (
      !latestAssistant
      || latestAssistant.isStreaming
      || latestAssistant.id === lastPlayedAssistantIdRef.current
    ) {
      return;
    }
    lastPlayedAssistantIdRef.current = latestAssistant.id;
    void (async () => {
      const played = await playResponse(latestAssistant.text);
      if (!played) {
        lastPlayedAssistantIdRef.current = null;
      }
    })();
  }, [autoplayEnabled, chat.messages, playResponse]);

  useEffect(() => {
    if (!isVoiceEnabled || voiceMode !== "push_to_talk") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== "Space") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      event.preventDefault();
      void startRecording();
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code !== "Space") {
        return;
      }
      event.preventDefault();
      void stopRecording();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isVoiceEnabled, startRecording, stopRecording, voiceMode]);

  return { ...chat, voice };
}
