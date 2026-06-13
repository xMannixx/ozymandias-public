import DOMPurify from "dompurify";
import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";
import type { MailDetail as MailDetailType } from "@/api/types";

type MailDetailProps = {
  message: MailDetailType;
  onReply: () => void;
};

function likelyHtml(input: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function MailDetail({ message, onReply }: MailDetailProps): JSX.Element {
  const sanitizedBody = DOMPurify.sanitize(message.body);
  const renderHtml = likelyHtml(message.body);

  return (
    <GlassCard className="space-y-3">
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-gray-400">Von:</span> {message.sender}
        </p>
        <p>
          <span className="text-gray-400">An:</span> {message.to.join(", ")}
        </p>
        <p>
          <span className="text-gray-400">Betreff:</span> {message.subject ?? "(kein Betreff)"}
        </p>
        <p>
          <span className="text-gray-400">Datum:</span> {formatDate(message.date)}
        </p>
      </div>

      <div className="rounded border border-gray-700 bg-gray-900 p-3 text-sm text-gray-100">
        {renderHtml ? (
          <div
            aria-label="mail-html-body"
            className="prose prose-invert max-w-none whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
          />
        ) : (
          <p className="whitespace-pre-wrap">{message.body}</p>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-gray-400">Attachments</p>
        {message.attachments.length === 0 ? (
          <p className="text-sm text-gray-500">Keine Attachments</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-300">
            {message.attachments.map((attachment) => (
              <li key={`${attachment.name}-${attachment.size}`}>
                {attachment.name} ({attachment.size} bytes)
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button type="button" variant="ghost" onClick={onReply}>
        Antworten
      </Button>
    </GlassCard>
  );
}

export default MailDetail;
