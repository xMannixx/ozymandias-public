import { useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/hooks/useChat";

type MessageBubbleProps = {
  message: ChatMessage;
};

const markdownComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-300 underline hover:text-blue-200"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-gray-500 pl-3 text-gray-300 last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) {
      return <code className={`${className} block`}>{children}</code>;
    }
    return <code className="rounded bg-gray-800 px-1 py-0.5 text-[13px]">{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="mb-2 max-w-full overflow-x-auto rounded bg-gray-950/80 p-3 text-[13px] last:mb-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="min-w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-gray-600 px-2 py-1 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-gray-800 px-2 py-1">{children}</td>,
  hr: () => <hr className="my-2 border-gray-700" />,
};

function CopyButton({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context); nothing to do.
    }
  }

  return (
    <button
      type="button"
      aria-label="Copy message"
      className="rounded px-1.5 py-0.5 text-[11px] text-gray-400 hover:bg-gray-800 hover:text-gray-200"
      onClick={() => {
        void copy();
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function MessageBubble({ message }: MessageBubbleProps): JSX.Element {
  const isUser = message.role === "user";
  const results = message.results ?? [];
  const proposalCount = results.filter((item) => item.status === "proposal_created").length;
  const createdCount = results.filter((item) => item.status === "created").length;

  return (
    <div className={`group mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
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
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : (
          <div className="break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.text}
            </ReactMarkdown>
            {message.isStreaming ? (
              <span aria-label="streaming" className="ml-1 inline-block animate-pulse">
                ▍
              </span>
            ) : null}
          </div>
        )}
        {!isUser && !message.isStreaming ? (
          <div className="mt-1 flex items-center justify-between gap-2">
            {message.provider ? (
              <p className="text-[11px] text-gray-400">
                via {message.provider}
                {message.model ? ` / ${message.model}` : ""}
              </p>
            ) : (
              <span />
            )}
            {message.text.trim() ? <CopyButton text={message.text} /> : null}
          </div>
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
