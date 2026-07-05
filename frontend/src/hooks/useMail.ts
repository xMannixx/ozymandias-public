import { useCallback, useEffect, useState } from "react";
import { getGoogleStatus } from "@/api/auth";
import { ApiError } from "@/api/client";
import { getMail, listMail, sendMail } from "@/api/mail";
import type { MailDetail, MailSummary } from "@/api/types";

type MailToast = {
  message: string;
  type: "success" | "error" | "info";
};

type UseMailResult = {
  messages: MailSummary[];
  selectedMessage: MailDetail | null;
  googleConnected: boolean;
  loading: boolean;
  error: string | null;
  query: string;
  toast: MailToast | null;
  search: (query: string) => Promise<void>;
  selectMessage: (id: string) => Promise<void>;
  sendMail: (to: string, subject: string, body: string) => Promise<void>;
  refetch: () => Promise<void>;
  clearToast: () => void;
};

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load mail";
}

export function useMail(): UseMailResult {
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MailDetail | null>(null);
  const [googleConnected, setGoogleConnected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<MailToast | null>(null);

  const ensureGoogleConnected = useCallback(async () => {
    const status = await getGoogleStatus();
    setGoogleConnected(status.connected);
    if (!status.connected) {
      setMessages([]);
      setSelectedMessage(null);
      setError(null);
      return false;
    }
    return true;
  }, []);

  const loadMessages = useCallback(
    async (nextQuery: string) => {
      const connected = await ensureGoogleConnected();
      if (!connected) {
        return;
      }
      const response = await listMail({ max_results: 20, query: nextQuery || undefined });
      setMessages(response);
    },
    [ensureGoogleConnected],
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadMessages(query);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [loadMessages, query]);

  const search = useCallback(
    async (nextQuery: string) => {
      setQuery(nextQuery);
      setLoading(true);
      setError(null);
      try {
        await loadMessages(nextQuery);
      } catch (err) {
        setError(normalizeError(err));
      } finally {
        setLoading(false);
      }
    },
    [loadMessages],
  );

  const selectMessage = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const connected = await ensureGoogleConnected();
        if (!connected) {
          return;
        }
        const response = await getMail(id);
        setSelectedMessage(response);
      } catch (err) {
        setError(normalizeError(err));
      } finally {
        setLoading(false);
      }
    },
    [ensureGoogleConnected],
  );

  const sendMessage = useCallback(
    async (to: string, subject: string, body: string) => {
      setLoading(true);
      setError(null);
      try {
        const connected = await ensureGoogleConnected();
        if (!connected) {
          return;
        }
        await sendMail({ to, subject, body });
        setToast({ type: "success", message: "Email sent." });
        await loadMessages(query);
      } catch (err) {
        const message = normalizeError(err);
        setError(message);
        setToast({ type: "error", message });
      } finally {
        setLoading(false);
      }
    },
    [ensureGoogleConnected, loadMessages, query],
  );

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    messages,
    selectedMessage,
    googleConnected,
    loading,
    error,
    query,
    toast,
    search,
    selectMessage,
    sendMail: sendMessage,
    refetch,
    clearToast,
  };
}
