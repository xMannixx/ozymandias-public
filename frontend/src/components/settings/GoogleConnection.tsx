import { useState } from "react";
import { disconnectGoogle, getGoogleAuthUrl } from "@/api/auth";
import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";
import Spinner from "@/components/common/Spinner";
import { useGoogleStatus } from "@/hooks/useGoogleStatus";

export const googleRedirect = {
  to: (url: string): void => {
    window.location.assign(url);
  },
};

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
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-200">Google Verbindung</p>
        {loading ? <Spinner /> : null}
      </div>

      <p className="text-sm text-gray-300">
        Status:{" "}
        <span className={connected ? "text-green-300" : "text-orange-300"}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </p>

      {connected ? (
        <>
          <p className="text-xs text-gray-400">E-Mail: {email ?? "unbekannt"}</p>
          {scopes.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-gray-400">
              {scopes.map((scope) => (
                <li key={scope}>{scope}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">No scopes granted.</p>
          )}
          <Button type="button" variant="danger" onClick={() => void onDisconnect()} disabled={busy}>
            Verbindung trennen
          </Button>
        </>
      ) : (
        <Button type="button" onClick={() => void onConnect()} disabled={busy}>
          Mit Google verbinden
        </Button>
      )}

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {actionError ? <p className="text-xs text-red-300">{actionError}</p> : null}
    </GlassCard>
  );
}

export default GoogleConnection;
