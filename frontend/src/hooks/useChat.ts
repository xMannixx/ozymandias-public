import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  deleteConversation,
  getConversationMessages,
  listConversations,
  renameConversation,
} from "@/api/conversations";
import { getSettings } from "@/api/settings";
import { postTurn } from "@/api/turns";
import type { ClaimProcessResult, ConversationResponse, LLMProviderName } from "@/api/types";

const CHAT_PROVIDER_KEY = "ozy-chat-provider";
const CHAT_MODEL_KEY = "ozy-chat-model";
// Records which provider a stored model belongs to, so a stale
// provider/model combination is never restored after a provider switch.
const CHAT_MODEL_PROVIDER_KEY = "ozy-chat-model-provider";

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
  conversations: ConversationResponse[];
  activeConversationId: string | null;
  isHistoryLoading: boolean;
  selectedProvider: LLMProviderName | null;
  selectedModel: string;
  s3FallbackPrompt: { text: string; message: string } | null;
  s3LiveWebPrompt: { text: string; message: string } | null;
  setSelectedProvider: (provider: LLMProviderName | null) => void;
  setSelectedModel: (model: string) => void;
  sendMessage: (text: string) => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  startNewConversation: () => void;
  removeConversation: (conversationId: string) => Promise<void>;
  renameConversationTitle: (conversationId: string, title: string) => Promise<void>;
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
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
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

  const refreshConversations = useCallback(async (): Promise<void> => {
    try {
      const items = await listConversations();
      setConversations(items);
    } catch {
      // Conversation list is non-critical; chat still works without it.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const settings = await getSettings();
        if (!mounted) {
          return;
        }
        const savedProvider = localStorage.getItem(CHAT_PROVIDER_KEY);
        const effectiveProvider = (savedProvider
          ?? settings.preferred_provider
          ?? settings.preferred_local_provider
          ?? null) as LLMProviderName | null;
        setSelectedProvider(effectiveProvider);

        const savedModel = localStorage.getItem(CHAT_MODEL_KEY);
        const savedModelProvider = localStorage.getItem(CHAT_MODEL_PROVIDER_KEY);
        if (savedModel && savedModelProvider === (effectiveProvider ?? "")) {
          setSelectedModel(savedModel);
        } else if (!savedProvider) {
          // Settings keep provider and model as a consistent pair.
          setSelectedModel(settings.preferred_model ?? "");
        } else {
          setSelectedModel("");
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
    void refreshConversations();
    return () => {
      mounted = false;
    };
  }, [refreshConversations]);

  function handleSetProvider(provider: LLMProviderName | null): void {
    setSelectedProvider(provider);
    if (provider) {
      localStorage.setItem(CHAT_PROVIDER_KEY, provider);
    } else {
      localStorage.removeItem(CHAT_PROVIDER_KEY);
    }
    // A model belongs to one provider; switching providers resets the model
    // so stale combinations (e.g. Ollama + mistral-large-latest) cannot occur.
    setSelectedModel("");
    localStorage.removeItem(CHAT_MODEL_KEY);
    localStorage.removeItem(CHAT_MODEL_PROVIDER_KEY);
  }

  function handleSetModel(model: string): void {
    setSelectedModel(model);
    if (model.trim()) {
      localStorage.setItem(CHAT_MODEL_KEY, model);
      localStorage.setItem(CHAT_MODEL_PROVIDER_KEY, selectedProvider ?? "");
    } else {
      localStorage.removeItem(CHAT_MODEL_KEY);
      localStorage.removeItem(CHAT_MODEL_PROVIDER_KEY);
    }
  }

  async function selectConversation(conversationId: string): Promise<void> {
    setActiveConversationId(conversationId);
    setS3FallbackPrompt(null);
    setS3LiveWebPrompt(null);
    setIsHistoryLoading(true);
    try {
      const history = await getConversationMessages(conversationId);
      setMessages(
        history.map((item) => ({
          id: item.message_id,
          role: item.role,
          text: item.content,
          provider: item.provider ?? undefined,
          model: item.model ?? undefined,
        })),
      );
    } catch {
      setMessages([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }

  function startNewConversation(): void {
    setActiveConversationId(null);
    setMessages([]);
    setS3FallbackPrompt(null);
    setS3LiveWebPrompt(null);
  }

  async function removeConversation(conversationId: string): Promise<void> {
    try {
      await deleteConversation(conversationId);
    } catch {
      return;
    }
    if (conversationId === activeConversationId) {
      startNewConversation();
    }
    await refreshConversations();
  }

  async function renameConversationTitle(conversationId: string, title: string): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    try {
      await renameConversation(conversationId, trimmed);
    } catch {
      return;
    }
    await refreshConversations();
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
    const result = await postTurn(text, {
      provider: selectedProvider ?? undefined,
      model: requestedModel,
      allowS3CloudFallback,
      useLiveWeb: liveWebEnabled && liveWebMode !== "off",
      allowS3LiveWeb,
      conversationId: activeConversationId ?? undefined,
    });
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
    if (result.conversation_id) {
      setActiveConversationId(result.conversation_id);
      void refreshConversations();
    }
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
    conversations,
    activeConversationId,
    isHistoryLoading,
    selectedProvider,
    selectedModel,
    s3FallbackPrompt,
    s3LiveWebPrompt,
    setSelectedProvider: handleSetProvider,
    setSelectedModel: handleSetModel,
    sendMessage,
    selectConversation,
    startNewConversation,
    removeConversation,
    renameConversationTitle,
    confirmS3Fallback,
    cancelS3Fallback,
    confirmS3LiveWeb,
    cancelS3LiveWeb,
  };
}
