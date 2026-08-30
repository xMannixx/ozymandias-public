import { useCallback, useEffect, useState } from "react";
import { listChatStarters } from "@/api/conversations";
import type { ChatStarter } from "@/api/types";

type UseChatStartersResult = {
  starters: ChatStarter[];
  loading: boolean;
  refetch: () => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A misrouted request can answer 200 with HTML, which must not crash the page. */
function isStarter(value: unknown): value is ChatStarter {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.icon === "string" &&
    typeof value.title === "string" &&
    typeof value.prompt === "string"
  );
}

/**
 * Suggestions for the empty chat screen.
 *
 * A failure stays silent: the screen has a static fallback, and an error toast
 * about missing suggestions would be noise on the very first thing a user sees.
 */
export function useChatStarters(): UseChatStartersResult {
  const [starters, setStarters] = useState<ChatStarter[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listChatStarters();
      setStarters(Array.isArray(response) ? response.filter(isStarter) : []);
    } catch {
      setStarters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { starters, loading, refetch };
}
