import { Link } from "react-router-dom";
import type { ChatMessage } from "@/hooks/useChat";

type MessageBubbleProps = {
  message: ChatMessage;
};

function MessageBubble({ message }: MessageBubbleProps): JSX.Element {
  const isUser = message.role === "user";
  const results = message.results ?? [];
  const proposalCount = results.filter((item) => item.status === "proposal_created").length;
  const createdCount = results.filter((item) => item.status === "created").length;

  return (
    <div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
          isUser ? "bg-blue-700 text-blue-100" : "glass-card text-gray-100"
        }`}
      >
        {!isUser && message.reasoning_content?.trim() ? (
          <details className="mb-2 rounded bg-gray-800/50 p-2 text-xs text-gray-300">
            <summary className="cursor-pointer select-none text-gray-400">Reasoning</summary>
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
        {!isUser && (proposalCount > 0 || createdCount > 0) ? (
          <div className="mt-2 space-y-1 rounded border border-blue-500/30 bg-blue-950/30 px-2 py-1 text-xs text-blue-100">
            {proposalCount > 0 ? (
              <p>
                {proposalCount} memory {proposalCount === 1 ? "proposal" : "proposals"} created -{" "}
                <Link to="/proposals" className="font-semibold underline hover:text-blue-200">
                  Review now
                </Link>
              </p>
            ) : null}
            {createdCount > 0 ? (
              <p>
                {createdCount} {createdCount === 1 ? "memory" : "memories"} saved automatically. See{" "}
                <Link to="/memory" className="font-semibold underline hover:text-blue-200">
                  Memory
                </Link>
                .
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default MessageBubble;
