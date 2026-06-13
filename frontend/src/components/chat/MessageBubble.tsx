import Badge from "@/components/common/Badge";
import type { ChatMessage } from "@/hooks/useChat";

type MessageBubbleProps = {
  message: ChatMessage;
};

function MessageBubble({ message }: MessageBubbleProps): JSX.Element {
  const isUser = message.role === "user";

  return (
    <div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
          isUser ? "bg-blue-700 text-blue-100" : "glass-card text-gray-100"
        }`}
      >
        {!isUser && message.reasoning_content?.trim() ? (
          <details className="mb-2 rounded bg-gray-800/50 p-2 text-xs text-gray-300">
            <summary className="cursor-pointer select-none text-gray-400">Denkprozess</summary>
            <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-sans">
              {message.reasoning_content}
            </pre>
          </details>
        ) : null}
        <p className="whitespace-pre-wrap">{message.text}</p>
        {!isUser && message.provider ? (
          <p className="mt-1 text-[11px] text-gray-400">
            via {message.provider}
            {message.model ? ` / ${message.model}` : ""}
          </p>
        ) : null}
        {!isUser && message.claims && message.claims.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.claims.map((claim) => (
              <Badge key={claim.claim_id} sensitivity={claim.sensitivity} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default MessageBubble;
