import { useEffect, useRef, useState } from "react";
import { forceLogout, getToken } from "@/store/auth";

function buildUrl(path: string): string {
  const baseUrl = (import.meta.env.VITE_API_URL ?? "").trim();
  if (!baseUrl) {
    return path;
  }
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

type AvatarDisplayProps = {
  contactId: string;
  hasAvatar: boolean;
  label: string;
  className?: string;
};

function AvatarDisplay({ contactId, hasAvatar, label, className = "" }: AvatarDisplayProps): JSX.Element {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasAvatar) {
      setObjectUrl(null);
      setLoadError(false);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      return undefined;
    }

    let cancelled = false;

    const revokeCurrent = (): void => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };

    const load = async (): Promise<void> => {
      setLoadError(false);
      revokeCurrent();
      setObjectUrl(null);

      const token = getToken();
      const headers = new Headers();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      const response = await fetch(buildUrl(`/contacts/${contactId}/avatar`), { headers });
      if (response.status === 401) {
        forceLogout();
        if (window.location.pathname !== "/login") {
          window.location.assign("/login");
        }
        return;
      }
      if (!response.ok) {
        if (!cancelled) {
          setLoadError(true);
        }
        return;
      }
      const blob = await response.blob();
      if (cancelled) {
        return;
      }
      const nextUrl = URL.createObjectURL(blob);
      blobUrlRef.current = nextUrl;
      setObjectUrl(nextUrl);
    };

    void load().catch(() => {
      if (!cancelled) {
        setLoadError(true);
      }
    });

    return () => {
      cancelled = true;
      revokeCurrent();
    };
  }, [contactId, hasAvatar]);

  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  if (!hasAvatar || loadError || !objectUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-blue-900/60 text-sm font-semibold text-blue-100 ${className}`}
        aria-label={label}
        data-testid="avatar-fallback"
      >
        {initials || "?"}
      </div>
    );
  }

  return (
    <img
      src={objectUrl}
      alt=""
      className={`rounded-full object-cover ${className}`}
      data-testid="avatar-image"
    />
  );
}

export default AvatarDisplay;
