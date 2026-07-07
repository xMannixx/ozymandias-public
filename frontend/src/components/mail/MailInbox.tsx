import { useMemo, useState } from "react";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import Toast from "@/components/common/Toast";
import GoogleNotConnected from "@/components/mail/GoogleNotConnected";
import MailCompose from "@/components/mail/MailCompose";
import MailDetail from "@/components/mail/MailDetail";
import { useMail } from "@/hooks/useMail";

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diffMs = date.getTime() - Date.now();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const formatter = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
  if (Math.abs(diffMs) < hour) {
    return formatter.format(Math.round(diffMs / minute), "minute");
  }
  if (Math.abs(diffMs) < day) {
    return formatter.format(Math.round(diffMs / hour), "hour");
  }
  return formatter.format(Math.round(diffMs / day), "day");
}

function MailInbox(): JSX.Element {
  const { messages, selectedMessage, googleConnected, loading, error, query, toast, search, selectMessage, sendMail, refetch, clearToast } =
    useMail();
  const [searchInput, setSearchInput] = useState(query);
  const [composeOpen, setComposeOpen] = useState(false);

  const replyPreset = useMemo(() => {
    if (!selectedMessage) {
      return { to: "", subject: "" };
    }
    const subject = selectedMessage.subject?.startsWith("Re:")
      ? selectedMessage.subject
      : `Re: ${selectedMessage.subject ?? ""}`.trim();
    return { to: selectedMessage.sender, subject };
  }, [selectedMessage]);

  if (!googleConnected) {
    return <GoogleNotConnected />;
  }

  return (
    <section className="space-y-4">
      <div className="glass-card flex flex-col gap-2 p-3 md:flex-row md:items-center">
        <input
          aria-label="mail-search"
          className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          placeholder="Search emails"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => void search(searchInput)}>
            Search
          </Button>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Neu laden
          </Button>
          <Button type="button" onClick={() => setComposeOpen((prev) => !prev)}>
            {composeOpen ? "Close compose" : "New email"}
          </Button>
        </div>
      </div>

      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} timeoutMs={3200} />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {loading && messages.length === 0 ? (
        <div className="glass-card flex justify-center p-6">
          <Spinner />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
        <div className="glass-card space-y-2 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-400">No emails</p>
          ) : (
            messages.map((mail) => (
              <button
                key={mail.id}
                type="button"
                className={`w-full rounded border px-3 py-2 text-left transition ${
                  selectedMessage?.id === mail.id
                    ? "border-blue-600 bg-blue-950/40"
                    : "border-gray-700 bg-gray-900 hover:border-gray-500"
                }`}
                onClick={() => void selectMessage(mail.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-gray-100">{mail.sender}</p>
                  {!mail.is_read ? (
                    <span className="rounded-full bg-blue-700 px-2 py-0.5 text-xs font-semibold text-blue-100">
                      Neu
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-sm text-gray-300">{mail.subject ?? "(no subject)"}</p>
                <p className="truncate text-xs text-gray-400">{mail.snippet}</p>
                <p className="mt-1 text-xs text-gray-500">{formatRelativeDate(mail.date)}</p>
              </button>
            ))
          )}
        </div>

        <div className="space-y-3">
          {composeOpen ? (
            <MailCompose
              initialTo={replyPreset.to}
              initialSubject={replyPreset.subject}
              onSend={sendMail}
              onCancel={() => setComposeOpen(false)}
              sending={loading}
            />
          ) : null}

          {selectedMessage ? (
            <MailDetail message={selectedMessage} onReply={() => setComposeOpen(true)} />
          ) : (
            <div className="glass-card p-4 text-sm text-gray-400">Select an email to see details.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default MailInbox;
