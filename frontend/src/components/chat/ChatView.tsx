import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ChatEmptyState from "@/components/chat/ChatEmptyState";
import ChatInput from "@/components/chat/ChatInput";
import ConversationList from "@/components/chat/ConversationList";
import MessageList from "@/components/chat/MessageList";
import ModelSelect from "@/components/chat/ModelSelect";
import ProjectScopeSelect from "@/components/chat/ProjectScopeSelect";
import S3ConfirmModals from "@/components/chat/S3ConfirmModals";
import { useActiveProjects } from "@/hooks/useActiveProjects";
import { useChatSession } from "@/hooks/useChatSession";
import type { LLMProviderName } from "@/api/types";

const PROVIDER_OPTIONS: Array<{ value: LLMProviderName; label: string }> = [
  { value: "ollama", label: "Ollama (local)" },
  { value: "lmstudio", label: "LM Studio (local)" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "mistral", label: "Mistral" },
];

const CHAT_PROJECT_KEY = "ozy-chat-project";

function ChatView(): JSX.Element {
  const [projectId, setProjectId] = useState<string | null>(() =>
    localStorage.getItem(CHAT_PROJECT_KEY),
  );
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
    voice,
  } = useChatSession({ projectId: projectId ?? undefined });
  const {
    isVoiceEnabled,
    voiceMode,
    startRecording,
    stopRecording,
    toggleVoice,
    setVoiceMode,
    voiceState,
    error,
  } = voice;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const activeProjects = useActiveProjects();
  const workspaceName =
    activeProjects.find((project) => project.project_id === projectId)?.name ?? null;
  const activeConversation = conversations.find(
    (conversation) => conversation.conversation_id === activeConversationId,
  );
  const providerLabel =
    selectedProvider === null
      ? "Auto"
      : PROVIDER_OPTIONS.find((option) => option.value === selectedProvider)?.label
        ?? selectedProvider;
  const modelLabel = selectedModel ?? "default";

  useEffect(() => {
    if (projectId) {
      localStorage.setItem(CHAT_PROJECT_KEY, projectId);
    } else {
      localStorage.removeItem(CHAT_PROJECT_KEY);
    }
  }, [projectId]);

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
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-1 px-2 py-1.5">
            <button
              type="button"
              className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-xs text-zinc-300 hover:bg-white/[0.05] md:hidden"
              aria-label="Open conversation history"
              onClick={() => setConversationsOpen(true)}
            >
              History
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm text-zinc-300 hover:bg-white/[0.02]"
              onClick={() => setSettingsOpen((prev) => !prev)}
              aria-expanded={settingsOpen}
              aria-controls="chat-settings-panel"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-100">
                  {activeConversation?.title ?? "New conversation"}
                </span>
                <span className="text-xs text-zinc-500">
                  · {providerLabel} · {modelLabel}
                  {isVoiceEnabled ? " · voice on" : ""}
                </span>
              </span>
              <span aria-hidden="true" className="text-xs text-zinc-500">
                {settingsOpen ? "Hide" : "Settings"}
              </span>
            </button>
          </div>
          {projectId ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-3 py-2 text-xs">
              <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2 py-0.5 text-indigo-200">
                In workspace{workspaceName ? `: ${workspaceName}` : ""}
              </span>
              <span className="text-zinc-500">
                Ozy reads this project&apos;s instructions and files before answering.
              </span>
              <Link
                to={`/projects/${projectId}`}
                className="text-indigo-300 underline-offset-2 hover:underline"
              >
                Open workspace
              </Link>
              <button
                type="button"
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => setProjectId(null)}
              >
                Leave
              </button>
            </div>
          ) : null}
          {settingsOpen ? (
            <div
              id="chat-settings-panel"
              className="grid gap-3 border-t border-white/[0.06] px-3 py-3 md:grid-cols-3"
            >
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Provider
                <select
                  aria-label="chat-provider-select"
                  value={selectedProvider ?? "auto"}
                  onChange={(event) =>
                    setSelectedProvider(
                      event.target.value === "auto"
                        ? null
                        : (event.target.value as LLMProviderName),
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

              <ModelSelect
                provider={selectedProvider}
                model={selectedModel}
                onChange={setSelectedModel}
              />
              <ProjectScopeSelect
                projects={activeProjects}
                projectId={projectId}
                onChange={setProjectId}
              />
              <div className="flex flex-col gap-2 text-xs text-zinc-400">
                <label className="inline-flex items-center gap-2">
                  <input
                    aria-label="chat-voice-enabled"
                    type="checkbox"
                    checked={isVoiceEnabled}
                    className="h-3.5 w-3.5 accent-indigo-500"
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
                    value={voiceMode}
                    onChange={(event) =>
                      setVoiceMode(event.target.value as "push_to_talk" | "hands_free")
                    }
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
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Loading conversation…
            </div>
          ) : messages.length === 0 ? (
            <ChatEmptyState
              onPromptClick={(prompt) => {
                void sendMessage(prompt);
              }}
            />
          ) : (
            <MessageList messages={messages} />
          )}
        </div>
        {isLoading ? (
          <p className="mt-2 text-sm text-gray-400" role="status" aria-live="polite">
            Ozy is typing...
          </p>
        ) : null}
        <S3ConfirmModals
          liveWebMessage={s3LiveWebPrompt?.message ?? null}
          fallbackMessage={s3FallbackPrompt?.message ?? null}
          onConfirmLiveWeb={() => {
            void confirmS3LiveWeb();
          }}
          onCancelLiveWeb={cancelS3LiveWeb}
          onConfirmFallback={() => {
            void confirmS3Fallback();
          }}
          onCancelFallback={cancelS3Fallback}
        />
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
