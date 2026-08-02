import ChatInput from "@/components/chat/ChatInput";
import MessageList from "@/components/chat/MessageList";
import S3ConfirmModals from "@/components/chat/S3ConfirmModals";
import Button from "@/components/common/Button";
import { useChatSession } from "@/hooks/useChatSession";
import { toRelativeTime } from "@/lib/relativeTime";

type WorkspaceChatProps = {
  projectId: string;
  projectName: string;
  hasInstructions: boolean;
  knowledgeCount: number;
  /** Called after a turn so the workspace header can pick up the new chat. */
  onConversationChange?: () => void;
};

/**
 * Chat that lives inside a workspace. Every message carries the project's
 * instructions and knowledge, and the chats stay with the project.
 */
function WorkspaceChat({
  projectId,
  projectName,
  hasInstructions,
  knowledgeCount,
  onConversationChange,
}: WorkspaceChatProps): JSX.Element {
  const {
    messages,
    isLoading,
    conversations,
    activeConversationId,
    isHistoryLoading,
    s3FallbackPrompt,
    s3LiveWebPrompt,
    sendMessage,
    stopStreaming,
    selectConversation,
    startNewConversation,
    removeConversation,
    confirmS3Fallback,
    cancelS3Fallback,
    confirmS3LiveWeb,
    cancelS3LiveWeb,
    voice,
  } = useChatSession({ projectId });

  const contextSummary = [
    hasInstructions ? "custom instructions" : null,
    knowledgeCount > 0
      ? `${knowledgeCount.toString()} knowledge ${knowledgeCount === 1 ? "file" : "files"}`
      : null,
  ].filter((part): part is string => part !== null);

  return (
    <div className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="glass-card flex max-h-[32rem] flex-col p-3" aria-label="Workspace chats">
        <Button
          type="button"
          className="mb-3 w-full"
          onClick={() => {
            startNewConversation();
          }}
        >
          New chat
        </Button>
        {conversations.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No chats in this workspace yet. Ask something and it stays here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 overflow-y-auto">
            {conversations.map((conversation) => (
              <li key={conversation.conversation_id} className="group flex items-center gap-1">
                <button
                  type="button"
                  className={`min-w-0 flex-1 rounded px-2 py-1.5 text-left ${
                    conversation.conversation_id === activeConversationId
                      ? "bg-white/[0.06]"
                      : "hover:bg-white/[0.03]"
                  }`}
                  onClick={() => {
                    void selectConversation(conversation.conversation_id);
                  }}
                >
                  <span className="block truncate text-sm text-zinc-100">{conversation.title}</span>
                  <span className="block text-xs text-zinc-500">
                    {toRelativeTime(conversation.updated_at)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete chat ${conversation.title}`}
                  title="Delete chat"
                  className="hidden shrink-0 rounded p-1 text-xs text-zinc-500 hover:text-red-300 group-hover:block"
                  onClick={() => {
                    void removeConversation(conversation.conversation_id);
                  }}
                >
                  &#10005;
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="flex min-h-[28rem] min-w-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isHistoryLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Loading conversation…
            </div>
          ) : messages.length === 0 ? (
            <div className="glass-card flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-sm text-zinc-200">Ask anything about {projectName}.</p>
              <p className="max-w-md text-xs text-zinc-500">
                {contextSummary.length > 0
                  ? `Ozy answers with this workspace in mind: ${contextSummary.join(" and ")}.`
                  : "Add instructions or upload files, and Ozy will use them in every answer here."}
              </p>
            </div>
          ) : (
            <MessageList messages={messages} />
          )}
        </div>
        {isLoading ? (
          <p className="mt-2 text-sm text-zinc-400" role="status" aria-live="polite">
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
          onSend={async (text, attachments) => {
            await sendMessage(text, attachments);
            onConversationChange?.();
          }}
          disabled={isLoading}
          isStreaming={isLoading}
          onStop={stopStreaming}
          voiceState={voice.voiceState}
          voiceMode={voice.voiceMode}
          isVoiceEnabled={voice.isVoiceEnabled}
          voiceError={voice.error}
          onStartRecording={() => {
            void voice.startRecording();
          }}
          onStopRecording={() => {
            void voice.stopRecording();
          }}
          onToggleVoice={() => {
            void voice.toggleVoice();
          }}
        />
      </div>
    </div>
  );
}

export default WorkspaceChat;
