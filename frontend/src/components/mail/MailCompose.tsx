import { useState, type FormEvent } from "react";
import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";

type MailComposeProps = {
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  onSend: (to: string, subject: string, body: string) => Promise<void>;
  onCancel?: () => void;
  sending?: boolean;
};

function MailCompose({
  initialTo = "",
  initialSubject = "",
  initialBody = "",
  onSend,
  onCancel,
  sending = false,
}: MailComposeProps): JSX.Element {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  const canSend = Boolean(to.trim() && subject.trim() && body.trim() && !sending);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    await onSend(to.trim(), subject.trim(), body.trim());
    setBody("");
  }

  return (
    <GlassCard className="space-y-3">
      <h3 className="text-base font-semibold text-gray-100">Neue Mail</h3>
      <form className="space-y-2" onSubmit={(event) => void handleSubmit(event)}>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          An
          <input
            aria-label="mail-compose-to"
            className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Betreff
          <input
            aria-label="mail-compose-subject"
            className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Nachricht
          <textarea
            aria-label="mail-compose-body"
            className="min-h-36 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={!canSend}>
            Senden
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Abbrechen
            </Button>
          ) : null}
        </div>
      </form>
    </GlassCard>
  );
}

export default MailCompose;
