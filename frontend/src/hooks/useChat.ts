import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getSettings } from "@/api/settings";
import { postTurn } from "@/api/turns";
import type { ClaimProcessResult, LLMProviderName } from "@/api/types";

const CHAT_PROVIDER_KEY = "ozy-chat-provider";
const CHAT_MODEL_KEY = "ozy-chat-model";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  results?: ClaimProcessResult[];
  provider?: string;
  model?: string;
  reasoning_content?: string | null;
};

type UseChatResult = {
  messages: ChatMessage[];
  isLoading: boolean;
  selectedProvider: LLMProviderName | null;
  selectedModel: string;
  s3FallbackPrompt: { text: string; message: string } | null;
  s3LiveWebPrompt: { text: string; message: string } | null;
  setSelectedProvider: (provider: LLMProviderName | null) => void;
  setSelectedModel: (model: string) => void;
  sendMessage: (text: string) => Promise<void>;
  confirmS3Fallback: () => Promise<void>;
  cancelS3Fallback: () => void;
  confirmS3LiveWeb: () => Promise<void>;
  cancelS3LiveWeb: () => void;
};

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderName | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [s3FallbackPrompt, setS3FallbackPrompt] = useState<{ text: string; message: string } | null>(
    null,
  );
  const [s3LiveWebPrompt, setS3LiveWebPrompt] = useState<{ text: string; message: string } | null>(
    null,
  );
  const [liveWebEnabled, setLiveWebEnabled] = useState(false);
  const [liveWebMode, setLiveWebMode] = useState<"provider_native_first" | "connector_only" | "off">(
    "provider_native_first",
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const settings = await getSettings();
        if (!mounted) {
          return;
        }
        const savedProvider = localStorage.getItem(CHAT_PROVIDER_KEY);
        if (savedProvider) {
          setSelectedProvider(savedProvider as LLMProviderName);
        } else {
          const effectiveProvider = settings.preferred_provider ?? settings.preferred_local_provider ?? null;
          setSelectedProvider(effectiveProvider as LLMProviderName | null);
        }

        const savedModel = localStorage.getItem(CHAT_MODEL_KEY);
        if (savedModel) {
          setSelectedModel(savedModel);
        } else {
          setSelectedModel(settings.preferred_model ?? "");
        }
        setLiveWebEnabled(settings.live_web_enabled);
        setLiveWebMode(settings.live_web_mode);
      } catch {
        if (!mounted) {
          return;
        }
        setSelectedProvider(null);
        setSelectedModel("");
        setLiveWebEnabled(false);
        setLiveWebMode("off");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function handleSetProvider(provider: LLMProviderName | null): void {
    setSelectedProvider(provider);
    if (provider) {
      localStorage.setItem(CHAT_PROVIDER_KEY, provider);
    } else {
      localStorage.removeItem(CHAT_PROVIDER_KEY);
    }
  }

  function handleSetModel(model: string): void {
    setSelectedModel(model);
    if (model.trim()) {
      localStorage.setItem(CHAT_MODEL_KEY, model);
    } else {
      localStorage.removeItem(CHAT_MODEL_KEY);
    }
  }

  function appendAssistantMessage(text: string): void {
    setMessages((prev) => [
      ...prev,
      {
        id: randomId(),
        role: "assistant",
        text,
      },
    ]);
  }

  type LocalUnavailablePayload = {
    detail?: {
      code?: string;
      message?: string;
      provider?: string;
      sensitivity?: "S3" | "S4" | string;
      fallback_allowed?: boolean;
    };
  };

  type LiveWebConfirmationPayload = {
    detail?: {
      code?: string;
      message?: string;
      sensitivity?: "S3" | string;
    };
  };

  function parseLocalUnavailableError(error: unknown): LocalUnavailablePayload["detail"] | null {
    if (!(error instanceof ApiError)) {
      return null;
    }
    const payload = error.payload as LocalUnavailablePayload;
    const detail = payload?.detail;
    if (!detail || detail.code !== "local_provider_unavailable") {
      return null;
    }
    return detail;
  }

  function parseLiveWebConfirmationError(error: unknown): LiveWebConfirmationPayload["detail"] | null {
    if (!(error instanceof ApiError)) {
      return null;
    }
    const payload = error.payload as LiveWebConfirmationPayload;
    const detail = payload?.detail;
    if (!detail || detail.code !== "live_web_confirmation_required") {
      return null;
    }
    return detail;
  }

  async function sendTurn(
    text: string,
    allowS3CloudFallback: boolean,
    allowS3LiveWeb: boolean,
  ): Promise<void> {
    const requestedModel = selectedModel.trim() || undefined;
    const result = await postTurn(
      text,
      "web",
      undefined,
      selectedProvider ?? undefined,
      requestedModel,
      allowS3CloudFallback,
      liveWebEnabled && liveWebMode !== "off",
      allowS3LiveWeb,
    );
    const assistantText = result.response_text ?? result.response ?? "No response.";
    const assistantMessage: ChatMessage = {
      id: result.turn_id || randomId(),
      role: "assistant",
      text: assistantText,
      results: result.results ?? [],
      provider: result.provider,
      model: result.model,
      reasoning_content: result.reasoning_content,
    };
    setMessages((prev) => [...prev, assistantMessage]);
  }

  async function sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: randomId(),
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setS3FallbackPrompt(null);
    setS3LiveWebPrompt(null);
    setIsLoading(true);

    try {
      await sendTurn(trimmed, false, false);
    } catch (error) {
      const liveWebConfirmation = parseLiveWebConfirmationError(error);
      if (liveWebConfirmation?.sensitivity === "S3") {
        setS3LiveWebPrompt({
          text: trimmed,
          message:
            liveWebConfirmation.message
            ?? "S3 content detected. Should I use live web access once for this message?",
        });
        return;
      }
      const localUnavailable = parseLocalUnavailableError(error);
      if (
        localUnavailable?.sensitivity === "S3"
        && localUnavailable.fallback_allowed
      ) {
        setS3FallbackPrompt({
          text: trimmed,
          message:
            localUnavailable.message
            ?? "Local provider unavailable. Should I process this S3 message via cloud, just this once?",
        });
        return;
      }
      if (localUnavailable?.sensitivity === "S4") {
        appendAssistantMessage(
          localUnavailable.message
            ?? "S4 content stays local-only. The local provider is unavailable.",
        );
        return;
      }
      if (error instanceof ApiError && typeof error.message === "string" && error.message.trim()) {
        appendAssistantMessage(`Error: ${error.message}`);
        return;
      }
      appendAssistantMessage("Failed to send the message.");
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmS3Fallback(): Promise<void> {
    if (!s3FallbackPrompt) {
      return;
    }
    const retryText = s3FallbackPrompt.text;
    setS3FallbackPrompt(null);
    setIsLoading(true);
    try {
      await sendTurn(retryText, true, false);
    } catch (error) {
      if (error instanceof ApiError && typeof error.message === "string" && error.message.trim()) {
        appendAssistantMessage(`Error: ${error.message}`);
      } else {
        appendAssistantMessage("Failed to send the message.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  function cancelS3Fallback(): void {
    setS3FallbackPrompt(null);
    appendAssistantMessage("Cancelled the cloud fallback for this S3 message.");
  }

  async function confirmS3LiveWeb(): Promise<void> {
    if (!s3LiveWebPrompt) {
      return;
    }
    const retryText = s3LiveWebPrompt.text;
    setS3LiveWebPrompt(null);
    setIsLoading(true);
    try {
      await sendTurn(retryText, false, true);
    } catch (error) {
      if (error instanceof ApiError && typeof error.message === "string" && error.message.trim()) {
        appendAssistantMessage(`Error: ${error.message}`);
      } else {
        appendAssistantMessage("Failed to send the message.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  function cancelS3LiveWeb(): void {
    setS3LiveWebPrompt(null);
    appendAssistantMessage("Cancelled live web access for this S3 message.");
  }

  return {
    messages,
    isLoading,
    selectedProvider,
    selectedModel,
    s3FallbackPrompt,
    s3LiveWebPrompt,
    setSelectedProvider: handleSetProvider,
    setSelectedModel: handleSetModel,
    sendMessage,
    confirmS3Fallback,
    cancelS3Fallback,
    confirmS3LiveWeb,
    cancelS3LiveWeb,
  };
}
