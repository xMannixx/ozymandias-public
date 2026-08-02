import type { ChatMessage } from "@/hooks/useChat";
import MessageBubble from "@/components/chat/MessageBubble";

type MessageListProps = {
  messages: ChatMessage[];
};

function MessageList({ messages }: MessageListProps): JSX.Element {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-2 py-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}

export default MessageList;
