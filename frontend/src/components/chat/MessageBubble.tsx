import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/hooks/useChat";

type MessageBubbleProps = {
  message: ChatMessage;
};

const markdownComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-2 whitespace-pre-wrap leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-indigo-300 underline decoration-indigo-500/40 underline-offset-2 hover:text-indigo-200"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-semibold text-white first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold text-white first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold text-white first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-white/10 pl-3 text-zinc-400 last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) {
      return <code className={`${className} block`}>{children}</code>;
    }
    return (
      <code className="rounded border border-white/[0.06] bg-white/[0.04] px-1 py-0.5 text-[12.5px] text-zinc-200">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 max-w-full overflow-x-auto rounded-md border border-white/[0.06] bg-black/40 p-3 text-[12.5px] last:mb-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="min-w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-white/10 px-2 py-1 font-semibold text-zinc-200">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-white/[0.06] px-2 py-1 text-zinc-300">{children}</td>,
  hr: () => <hr className="my-2 border-white/[0.06]" />,
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
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
      onClick={() => {
        void copy();
      }}
    >
      {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function MessageBubble({ message }: MessageBubbleProps): JSX.Element {
  const isUser = message.role === "user";
  const results = message.results ?? [];
  const proposalCount = results.filter((item) => item.status === "proposal_created").length;
  const createdCount = results.filter((item) => item.status === "created").length;

  if (isUser) {
    return (
      <div className="group mb-4 flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md border border-white/[0.06] bg-white/[0.04] px-3.5 py-2 text-sm text-zinc-100">
          {message.attachments && message.attachments.length > 0 ? (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {message.attachments.map((attachment, index) => (
                <span
                  key={`${attachment.filename}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-black/30 px-2 py-0.5 text-[11px] text-zinc-300"
                >
                  <FileText className="h-3 w-3" aria-hidden="true" />
                  <span className="max-w-[160px] truncate">{attachment.filename}</span>
                </span>
              ))}
            </div>
          ) : null}
          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group mb-6 flex gap-3">
      <div
        aria-hidden="true"
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-[13px] font-semibold text-white"
      >
        O
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {message.reasoning_content?.trim() ? (
          <details className="mb-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-xs text-zinc-400">
            <summary className="cursor-pointer select-none text-zinc-500">Reasoning</summary>
            <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-sans">
              {message.reasoning_content}
            </pre>
          </details>
        ) : null}
        <div className="break-words text-sm leading-relaxed text-zinc-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.text}
          </ReactMarkdown>
          {message.isStreaming ? (
            <span
              aria-label="streaming"
              className="ml-0.5 inline-block h-3 w-1.5 translate-y-[2px] animate-pulse rounded-sm bg-zinc-400"
            />
          ) : null}
        </div>
        {!message.isStreaming ? (
          <div className="mt-2 flex items-center gap-3">
            {message.provider ? (
              <span className="text-[11px] text-zinc-500">
                via {message.provider}
                {message.model ? ` · ${message.model}` : ""}
              </span>
            ) : null}
            {message.text.trim() ? <CopyButton text={message.text} /> : null}
          </div>
        ) : null}
        {(proposalCount > 0 || createdCount > 0) && !message.isStreaming ? (
          <div className="mt-3 space-y-1 rounded-md border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2 text-xs text-indigo-100">
            {proposalCount > 0 ? (
              <p>
                {proposalCount} memory {proposalCount === 1 ? "proposal" : "proposals"} created ·{" "}
                <Link to="/proposals" className="font-medium underline underline-offset-2 hover:text-white">
                  Review now
                </Link>
              </p>
            ) : null}
            {createdCount > 0 ? (
              <p>
                {createdCount} {createdCount === 1 ? "memory" : "memories"} saved automatically. See{" "}
                <Link to="/memory" className="font-medium underline underline-offset-2 hover:text-white">
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
