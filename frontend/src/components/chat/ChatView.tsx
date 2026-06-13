import { useEffect, useRef } from "react";
import ChatInput from "@/components/chat/ChatInput";
import Modal from "@/components/common/Modal";
import MessageList from "@/components/chat/MessageList";
import { useChat } from "@/hooks/useChat";
import { useSettings } from "@/hooks/useSettings";
import { useVoice } from "@/hooks/useVoice";
import type { LLMProviderName } from "@/api/types";

const PROVIDER_OPTIONS: Array<{ value: LLMProviderName; label: string }> = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI" },
  { value: "ollama", label: "Ollama" },
  { value: "gemini", label: "Gemini" },
];

function ChatView(): JSX.Element {
  const {
    messages,
    isLoading,
    selectedProvider,
    selectedModel,
    s3FallbackPrompt,
    s3LiveWebPrompt,
    setSelectedProvider,
    setSelectedModel,
    sendMessage,
    confirmS3Fallback,
    cancelS3Fallback,
    confirmS3LiveWeb,
    cancelS3LiveWeb,
  } = useChat();
  const { settings } = useSettings();
  const voice = useVoice({
    onTranscript: async (text) => {
      await sendMessage(text);
    },
    ttsVoice: settings?.tts_voice ?? "ash",
    ttsModel: settings?.tts_model ?? "tts-1",
  });
  const { isVoiceEnabled, voiceMode, playResponse, startRecording, stopRecording, toggleVoice, setVoiceMode, voiceState, error } =
    voice;
  const lastPlayedAssistantIdRef = useRef<string | null>(null);
  const autoplayEnabled = settings?.tts_autoplay ?? true;

  useEffect(() => {
    if (!autoplayEnabled) {
      return;
    }
    const assistantMessages = messages.filter((message) => message.role === "assistant");
    const latestAssistant = assistantMessages.at(-1);
    if (!latestAssistant || latestAssistant.id === lastPlayedAssistantIdRef.current) {
      return;
    }
    lastPlayedAssistantIdRef.current = latestAssistant.id;
    void (async () => {
      const played = await playResponse(latestAssistant.text);
      if (!played) {
        lastPlayedAssistantIdRef.current = null;
      }
    })();
  }, [autoplayEnabled, messages, playResponse]);

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

  return (
    <section>
      <div className="glass-card mb-3 grid gap-2 p-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Provider
          <select
            aria-label="chat-provider-select"
            className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
            value={selectedProvider ?? "auto"}
            onChange={(event) =>
              setSelectedProvider(event.target.value === "auto" ? null : (event.target.value as LLMProviderName))
            }
          >
            <option value="auto">Auto (Settings/Router)</option>
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Modell (optional)
          <input
            aria-label="chat-model-input"
            className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            placeholder="z.B. deepseek-chat"
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2 text-xs text-gray-400">
          <label className="inline-flex items-center gap-2">
            <input
              aria-label="chat-voice-enabled"
              type="checkbox"
              checked={isVoiceEnabled}
              onChange={() => {
                void toggleVoice();
              }}
            />
            Voice aktiv
          </label>
          <label className="flex flex-col gap-1">
            Voice-Modus
            <select
              aria-label="chat-voice-mode"
              className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100 disabled:opacity-60"
              value={voiceMode}
              onChange={(event) => setVoiceMode(event.target.value as "push_to_talk" | "hands_free")}
              disabled={!isVoiceEnabled}
            >
              <option value="push_to_talk">Push-to-Talk</option>
              <option value="hands_free">Freisprechen</option>
            </select>
          </label>
        </div>
      </div>
      <MessageList messages={messages} />
      {isLoading ? <p className="mt-2 text-sm text-gray-400">Ozy tippt...</p> : null}
      <Modal open={Boolean(s3LiveWebPrompt)} onClose={cancelS3LiveWeb} title="S3 Live-Web bestaetigen">
        <p className="mb-3 text-sm text-gray-200">
          {s3LiveWebPrompt?.message
            ?? "S3-Inhalt erkannt. Soll ich fuer diese Nachricht einmalig Live-Web-Zugriff nutzen?"}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={cancelS3LiveWeb}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
            onClick={() => {
              void confirmS3LiveWeb();
            }}
          >
            Einmalig erlauben
          </button>
        </div>
      </Modal>
      <Modal open={Boolean(s3FallbackPrompt)} onClose={cancelS3Fallback} title="S3 Cloud-Fallback">
        <p className="mb-3 text-sm text-gray-200">
          {s3FallbackPrompt?.message
            ?? "Lokaler Provider ist nicht verfuegbar. Soll die S3-Nachricht einmalig ueber Cloud verarbeitet werden?"}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={cancelS3Fallback}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
            onClick={() => {
              void confirmS3Fallback();
            }}
          >
            Cloud-Fallback erlauben
          </button>
        </div>
      </Modal>
      <ChatInput
        onSend={sendMessage}
        disabled={isLoading}
        voiceState={voiceState}
        voiceMode={voiceMode}
        isVoiceEnabled={isVoiceEnabled}
        voiceError={error}
        onStartRecording={() => {
          void startRecording();
        }}
        onStopRecording={() => {
          void stopRecording();
        }}
        onToggleVoice={() => {
          void toggleVoice();
        }}
      />
    </section>
  );
}

export default ChatView;
