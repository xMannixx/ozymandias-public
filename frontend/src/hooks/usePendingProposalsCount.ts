import { useEffect, useState } from "react";
import { listProposals } from "@/api/proposals";

const POLL_INTERVAL_MS = 30000;

/**
 * Polls the pending-proposal count for the sidebar badge. Failures are
 * swallowed - the badge is a convenience hint, not a critical data view.
 */
export function usePendingProposalsCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function fetchCount(): Promise<void> {
      try {
        const pending = await listProposals({ status: "pending" });
        if (mounted) {
          setCount(pending.length);
        }
      } catch {
        // Ignored - keep showing the last known count.
      }
    }

    void fetchCount();
    const interval = setInterval(() => {
      void fetchCount();
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return count;
}
