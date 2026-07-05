import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getGoogleAuthUrl, loginWithToken } from "@/api/auth";
import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";
import { useAuth } from "@/store/auth";

export const externalRedirect = {
  to: (url: string): void => {
    window.location.assign(url);
  },
};
const AUTH_BYPASS = String(import.meta.env.VITE_AUTH_BYPASS ?? "false").toLowerCase() === "true";

function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [devToken, setDevToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (AUTH_BYPASS) {
    return <Navigate to="/" replace />;
  }

  async function onGoogleLogin(): Promise<void> {
    setError(null);
    try {
      const response = await getGoogleAuthUrl();
      externalRedirect.to(response.url);
    } catch {
      setError("Failed to start Google login.");
    }
  }

  async function onTokenSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = devToken.trim();
    if (!trimmed) {
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const response = await loginWithToken(trimmed);
      login(response.access_token || trimmed);
      navigate("/", { replace: true });
    } catch {
      setError("Token login failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <GlassCard className="w-full max-w-md">
        <h1 className="mb-3 text-xl font-semibold text-blue-300">Ozymandias Login</h1>
        <p className="mb-4 text-sm text-gray-300">Sign in with Google or a dev token.</p>

        <Button type="button" className="mb-4 w-full" onClick={() => void onGoogleLogin()}>
          Sign in with Google
        </Button>

        <form onSubmit={onTokenSubmit} className="flex flex-col gap-2">
          <input
            aria-label="dev-token-input"
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            placeholder="JWT Token"
            value={devToken}
            onChange={(event) => setDevToken(event.target.value)}
          />
          <Button type="submit" disabled={isBusy || !devToken.trim()}>
            Token Login
          </Button>
        </form>

        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      </GlassCard>
    </main>
  );
}

export default LoginPage;
