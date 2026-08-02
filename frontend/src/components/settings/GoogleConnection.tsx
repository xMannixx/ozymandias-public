import { useState } from "react";
import { disconnectGoogle, getGoogleAuthUrl } from "@/api/auth";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import SettingsCard from "@/components/settings/SettingsCard";
import { useGoogleStatus } from "@/hooks/useGoogleStatus";

export const googleRedirect = {
  to: (url: string): void => {
    window.location.assign(url);
  },
};

/** Turns raw OAuth scope URLs into something a person can read. */
function describeScope(scope: string): string {
  if (scope.includes("gmail.readonly")) {
    return "Read your email";
  }
  if (scope.includes("gmail.send")) {
    return "Send email on your behalf";
  }
  if (scope.includes("gmail.modify")) {
    return "Read and organise your email";
  }
  if (scope.includes("gmail")) {
    return "Access Gmail";
  }
  if (scope.includes("calendar.readonly")) {
    return "Read your calendar";
  }
  if (scope.includes("calendar")) {
    return "Read and change your calendar";
  }
  if (scope.includes("userinfo.email")) {
    return "See your email address";
  }
  if (scope.includes("userinfo.profile")) {
    return "See your basic profile";
  }
  return scope;
}

function GoogleConnection(): JSX.Element {
  const { connected, email, scopes, loading, error, refetch } = useGoogleStatus();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function onConnect(): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      const response = await getGoogleAuthUrl();
      googleRedirect.to(response.url);
    } catch {
      setActionError("Failed to start the Google connection.");
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect(): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await disconnectGoogle();
      await refetch();
    } catch {
      setActionError("Failed to disconnect the Google account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard
      title="Google account"
      description="Connect Google so the Mail and Calendar views can show your actual inbox and appointments. Without it, those two pages stay empty."
      badge={
        loading ? (
          <Spinner />
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              connected
                ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-200"
                : "border-white/10 bg-white/[0.03] text-zinc-300"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-500"}`}
            />
            Status: {connected ? "Connected" : "Not connected"}
          </span>
        )
      }
    >
      {connected ? (
        <>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-sm text-zinc-200">Email: {email ?? "unknown"}</p>
            <p className="mt-2 text-xs font-medium text-zinc-300">Ozymandias is allowed to:</p>
            {scopes.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {scopes.map((scope) => (
                  <li key={scope} className="flex gap-2 text-xs text-zinc-400">
                    <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                    <span>{describeScope(scope)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                No permissions granted yet, so Mail and Calendar will stay empty.
              </p>
            )}
          </div>
          <div>
            <Button type="button" variant="danger" onClick={() => void onDisconnect()} disabled={busy}>
              Disconnect Google
            </Button>
            <p className="mt-2 text-xs text-zinc-500">
              Disconnecting revokes access immediately. Nothing already saved in your memory is deleted.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-xs font-medium text-zinc-300">What happens when you connect:</p>
            <ol className="mt-1.5 space-y-1.5 text-xs text-zinc-400">
              <li>1. You are taken to Google's own sign-in page.</li>
              <li>2. Google shows you exactly which permissions Ozymandias is asking for.</li>
              <li>3. After you approve, you come back here and Mail and Calendar start working.</li>
            </ol>
            <p className="mt-2 text-xs text-zinc-500">
              Your Google password is never seen by Ozymandias. You can disconnect at any time.
            </p>
          </div>
          <Button type="button" onClick={() => void onConnect()} disabled={busy}>
            Connect Google
          </Button>
        </>
      )}

      {error ? (
        <p className="text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p className="text-xs text-rose-300" role="alert">
          {actionError}
        </p>
      ) : null}
    </SettingsCard>
  );
}

export default GoogleConnection;
