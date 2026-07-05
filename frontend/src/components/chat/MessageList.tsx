import type { ChatMessage } from "@/hooks/useChat";
import MessageBubble from "@/components/chat/MessageBubble";

type MessageListProps = {
  messages: ChatMessage[];
};

function MessageList({ messages }: MessageListProps): JSX.Element {
  if (messages.length === 0) {
    return (
      <div className="glass-card flex min-h-[320px] items-center justify-center p-4 text-sm text-gray-400">
        No messages yet. Ask Ozy anything to get started.
      </div>
    );
  }

  return (
    <div className="glass-card min-h-[320px] max-h-[60vh] overflow-y-auto p-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}

export default MessageList;
