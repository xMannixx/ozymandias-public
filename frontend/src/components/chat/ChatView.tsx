import { useEffect, useRef, useState } from "react";
import ChatInput from "@/components/chat/ChatInput";
import ConversationList from "@/components/chat/ConversationList";
import Modal from "@/components/common/Modal";
import MessageList from "@/components/chat/MessageList";
import ModelSelect from "@/components/chat/ModelSelect";
import { useChat } from "@/hooks/useChat";
import { useSettings } from "@/hooks/useSettings";
import { useVoice } from "@/hooks/useVoice";
import type { LLMProviderName } from "@/api/types";

const PROVIDER_OPTIONS: Array<{ value: LLMProviderName; label: string }> = [
  { value: "ollama", label: "Ollama (local)" },
  { value: "lmstudio", label: "LM Studio (local)" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "mistral", label: "Mistral" },
];

function ChatView(): JSX.Element {
  const {
    messages,
    isLoading,
    conversations,
    activeConversationId,
    isHistoryLoading,
    selectedProvider,
    selectedModel,
    s3FallbackPrompt,
    s3LiveWebPrompt,
    setSelectedProvider,
    setSelectedModel,
    sendMessage,
    stopStreaming,
    selectConversation,
    startNewConversation,
    removeConversation,
    renameConversationTitle,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const activeConversation = conversations.find(
    (conversation) => conversation.conversation_id === activeConversationId,
  );
  const providerLabel =
    selectedProvider === null
      ? "Auto"
      : PROVIDER_OPTIONS.find((option) => option.value === selectedProvider)?.label ?? selectedProvider;
  const modelLabel = selectedModel ?? "default";

  useEffect(() => {
    if (!autoplayEnabled) {
      return;
    }
    const assistantMessages = messages.filter((message) => message.role === "assistant");
    const latestAssistant = assistantMessages.at(-1);
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
    <section className="flex h-[calc(100vh-6rem)] items-stretch gap-3">
      <aside className="hidden w-60 shrink-0 md:block" aria-label="Conversation history">
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={(conversationId) => {
            void selectConversation(conversationId);
          }}
          onNew={startNewConversation}
          onRename={(conversationId, title) => {
            void renameConversationTitle(conversationId, title);
          }}
          onDelete={(conversationId) => {
            void removeConversation(conversationId);
          }}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
      <div className="glass-card mb-3 p-2">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded px-1 py-1 text-left text-sm text-gray-200 hover:bg-gray-800/60"
          onClick={() => setSettingsOpen((prev) => !prev)}
          aria-expanded={settingsOpen}
          aria-controls="chat-settings-panel"
        >
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border border-cyan-500/30 bg-slate-900/60 px-2 py-1 text-xs text-gray-200 hover:border-cyan-400/60 md:hidden"
              aria-label="Open conversation history"
              onClick={(event) => {
                event.stopPropagation();
                setConversationsOpen(true);
              }}
            >
              History
            </button>
            <span className="font-medium text-blue-200">
              {activeConversation?.title ?? "New conversation"}
            </span>
            <span className="text-xs text-gray-400">
              · {providerLabel} · {modelLabel}
              {isVoiceEnabled ? " · voice on" : ""}
            </span>
          </span>
          <span aria-hidden="true" className="text-xs text-gray-400">
            {settingsOpen ? "Hide settings" : "Show settings"}
          </span>
        </button>
        {settingsOpen ? (
          <div id="chat-settings-panel" className="mt-2 grid gap-2 border-t border-slate-800/60 pt-2 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              Provider
              <select
                aria-label="chat-provider-select"
                className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
                value={selectedProvider ?? "auto"}
                onChange={(event) =>
                  setSelectedProvider(
                    event.target.value === "auto" ? null : (event.target.value as LLMProviderName),
                  )
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

            <ModelSelect provider={selectedProvider} model={selectedModel} onChange={setSelectedModel} />
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
                Voice enabled
              </label>
              <label className="flex flex-col gap-1">
                Voice mode
                <select
                  aria-label="chat-voice-mode"
                  className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100 disabled:opacity-60"
                  value={voiceMode}
                  onChange={(event) => setVoiceMode(event.target.value as "push_to_talk" | "hands_free")}
                  disabled={!isVoiceEnabled}
                >
                  <option value="push_to_talk">Push-to-Talk</option>
                  <option value="hands_free">Hands-free</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isHistoryLoading ? (
          <div className="glass-card flex h-full items-center justify-center p-4 text-sm text-gray-400">
            Loading conversation...
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
      </div>
      {isLoading ? (
        <p className="mt-2 text-sm text-gray-400" role="status" aria-live="polite">
          Ozy is typing...
        </p>
      ) : null}
      <Modal open={Boolean(s3LiveWebPrompt)} onClose={cancelS3LiveWeb} title="Confirm S3 live web access">
        <p className="mb-3 text-sm text-gray-200">
          {s3LiveWebPrompt?.message
            ?? "S3 content detected. Should I use live web access once for this message?"}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={cancelS3LiveWeb}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
            onClick={() => {
              void confirmS3LiveWeb();
            }}
          >
            Allow once
          </button>
        </div>
      </Modal>
      <Modal open={Boolean(s3FallbackPrompt)} onClose={cancelS3Fallback} title="S3 cloud fallback">
        <p className="mb-3 text-sm text-gray-200">
          {s3FallbackPrompt?.message
            ?? "Local provider is unavailable. Should this S3 message be processed via cloud, just this once?"}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={cancelS3Fallback}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
            onClick={() => {
              void confirmS3Fallback();
            }}
          >
            Allow cloud fallback
          </button>
        </div>
      </Modal>
      <ChatInput
        onSend={sendMessage}
        disabled={isLoading}
        isStreaming={isLoading}
        onStop={stopStreaming}
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
      </div>

      {conversationsOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Conversation history"
          className="fixed inset-0 z-[80] flex md:hidden"
        >
          <button
            type="button"
            aria-label="Close conversation history"
            className="flex-1 bg-black/60"
            onClick={() => setConversationsOpen(false)}
          />
          <div className="w-72 max-w-[80vw] bg-slate-950 p-3 shadow-2xl">
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelect={(conversationId) => {
                void selectConversation(conversationId);
                setConversationsOpen(false);
              }}
              onNew={() => {
                startNewConversation();
                setConversationsOpen(false);
              }}
              onRename={(conversationId, title) => {
                void renameConversationTitle(conversationId, title);
              }}
              onDelete={(conversationId) => {
                void removeConversation(conversationId);
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ChatView;
