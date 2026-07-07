import { act, renderHook, waitFor } from "@testing-library/react";
import { useChat } from "@/hooks/useChat";
import { mockSettings } from "@/test/fixtures";

const getSettingsMock = vi.fn();
const streamTurnMock = vi.fn();
const listConversationsMock = vi.fn();
const getConversationMessagesMock = vi.fn();
const renameConversationMock = vi.fn();
const deleteConversationMock = vi.fn();

vi.mock("@/api/settings", () => ({
  getSettings: (...args: unknown[]) => getSettingsMock(...args),
}));

vi.mock("@/api/turns", () => ({
  streamTurn: (...args: unknown[]) => streamTurnMock(...args),
}));

type FakeStreamEvent =
  | { event: "delta"; data: { text: string } }
  | { event: "result"; data: Record<string, unknown> }
  | { event: "error"; data: Record<string, unknown> };

function eventsStream(events: FakeStreamEvent[]): AsyncGenerator<FakeStreamEvent> {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

function resultStream(result: Record<string, unknown>): AsyncGenerator<FakeStreamEvent> {
  return eventsStream([{ event: "result", data: result }]);
}

vi.mock("@/api/conversations", () => ({
  listConversations: (...args: unknown[]) => listConversationsMock(...args),
  getConversationMessages: (...args: unknown[]) => getConversationMessagesMock(...args),
  renameConversation: (...args: unknown[]) => renameConversationMock(...args),
  deleteConversation: (...args: unknown[]) => deleteConversationMock(...args),
}));

describe("useChat", () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
    streamTurnMock.mockReset();
    listConversationsMock.mockReset();
    getConversationMessagesMock.mockReset();
    renameConversationMock.mockReset();
    deleteConversationMock.mockReset();
    localStorage.clear();
    getSettingsMock.mockResolvedValue(mockSettings);
    listConversationsMock.mockResolvedValue([]);
  });

  it("speichert Provider in localStorage, wenn manuell gesetzt", async () => {
    getSettingsMock.mockResolvedValueOnce({
      ...mockSettings,
      preferred_provider: "openai",
      preferred_local_provider: "ollama",
    });

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.selectedProvider).toBe("openai");
    });

    act(() => {
      result.current.setSelectedProvider("ollama");
    });

    expect(localStorage.getItem("ozy-chat-provider")).toBe("ollama");
  });

  it("entfernt Provider aus localStorage und faellt beim naechsten Load auf Settings zurueck", async () => {
    localStorage.setItem("ozy-chat-provider", "ollama");
    getSettingsMock.mockResolvedValue({
      ...mockSettings,
      preferred_provider: "gemini",
      preferred_local_provider: "ollama",
    });

    const first = renderHook(() => useChat());
    await waitFor(() => {
      expect(first.result.current.selectedProvider).toBe("ollama");
    });

    act(() => {
      first.result.current.setSelectedProvider(null);
    });
    expect(localStorage.getItem("ozy-chat-provider")).toBeNull();
    first.unmount();

    const second = renderHook(() => useChat());
    await waitFor(() => {
      expect(second.result.current.selectedProvider).toBe("gemini");
    });
  });

  it("setzt das Modell zurueck, wenn der Provider gewechselt wird", async () => {
    getSettingsMock.mockResolvedValueOnce({
      ...mockSettings,
      preferred_provider: "mistral",
      preferred_model: "mistral-large-latest",
    });
    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.selectedModel).toBe("mistral-large-latest");
    });

    act(() => {
      result.current.setSelectedProvider("ollama");
    });

    expect(result.current.selectedModel).toBe("");
    expect(localStorage.getItem("ozy-chat-model")).toBeNull();
  });

  it("ignoriert gespeichertes Modell eines anderen Providers beim Laden", async () => {
    localStorage.setItem("ozy-chat-provider", "ollama");
    localStorage.setItem("ozy-chat-model", "mistral-large-latest");
    localStorage.setItem("ozy-chat-model-provider", "mistral");

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.selectedProvider).toBe("ollama");
    });
    expect(result.current.selectedModel).toBe("");
  });

  it("stellt gespeichertes Modell wieder her, wenn es zum Provider passt", async () => {
    localStorage.setItem("ozy-chat-provider", "ollama");
    localStorage.setItem("ozy-chat-model", "llama3.2");
    localStorage.setItem("ozy-chat-model-provider", "ollama");

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.selectedModel).toBe("llama3.2");
    });
  });

  it("nutzt preferred_local_provider wenn kein preferred_provider gesetzt ist", async () => {
    getSettingsMock.mockResolvedValueOnce({
      ...mockSettings,
      preferred_provider: null,
      preferred_local_provider: "ollama",
    });
    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.selectedProvider).toBe("ollama");
    });
  });

  it("laedt die Conversation-Liste beim Start", async () => {
    listConversationsMock.mockResolvedValueOnce([
      {
        conversation_id: "c1",
        title: "First chat",
        created_at: "2026-07-01T10:00:00Z",
        updated_at: "2026-07-01T10:05:00Z",
      },
    ]);

    const { result } = renderHook(() => useChat());
    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });
    expect(result.current.conversations[0].title).toBe("First chat");
  });

  it("uebernimmt conversation_id aus dem TurnResult und sendet sie beim Folge-Turn mit", async () => {
    streamTurnMock.mockImplementation(() =>
      resultStream({
        turn_id: "turn-1",
        response_text: "hi",
        provider: "ollama",
        model: "llama3",
        conversation_id: "c9",
      }),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("hello");
    });
    expect(result.current.activeConversationId).toBe("c9");

    await act(async () => {
      await result.current.sendMessage("follow-up");
    });
    const secondCall = streamTurnMock.mock.calls[1];
    expect(secondCall[0]).toBe("follow-up");
    expect(secondCall[1]).toMatchObject({ conversationId: "c9" });
  });

  it("baut die Assistant-Antwort aus Delta-Events auf", async () => {
    streamTurnMock.mockImplementation(() =>
      eventsStream([
        { event: "delta", data: { text: "Hel" } },
        { event: "delta", data: { text: "lo" } },
        {
          event: "result",
          data: {
            turn_id: "turn-1",
            response_text: "Hello",
            provider: "ollama",
            model: "llama3",
          },
        },
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    const assistant = result.current.messages.at(-1);
    expect(assistant?.role).toBe("assistant");
    expect(assistant?.text).toBe("Hello");
    expect(assistant?.provider).toBe("ollama");
    expect(assistant?.isStreaming).toBe(false);
  });

  it("behaelt den Teiltext, wenn der Stream gestoppt wird", async () => {
    streamTurnMock.mockImplementation(
      (_text: string, _options: unknown, signal: AbortSignal) =>
        (async function* () {
          yield { event: "delta", data: { text: "partial answer" } };
          await new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        })(),
    );

    const { result } = renderHook(() => useChat());

    let sendPromise: Promise<void> = Promise.resolve();
    act(() => {
      sendPromise = result.current.sendMessage("hi");
    });
    await waitFor(() => {
      expect(result.current.messages.at(-1)?.text).toBe("partial answer");
    });

    act(() => {
      result.current.stopStreaming();
    });
    await act(async () => {
      await sendPromise;
    });

    const assistant = result.current.messages.at(-1);
    expect(assistant?.text).toBe("partial answer");
    expect(assistant?.isStreaming).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("laedt Nachrichten beim Auswaehlen einer Conversation", async () => {
    getConversationMessagesMock.mockResolvedValueOnce([
      {
        message_id: "m1",
        conversation_id: "c1",
        role: "user",
        content: "old question",
        provider: null,
        model: null,
        turn_id: "t1",
        created_at: "2026-07-01T10:00:00Z",
      },
      {
        message_id: "m2",
        conversation_id: "c1",
        role: "assistant",
        content: "old answer",
        provider: "ollama",
        model: "llama3",
        turn_id: "t1",
        created_at: "2026-07-01T10:00:05Z",
      },
    ]);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.selectConversation("c1");
    });

    expect(result.current.activeConversationId).toBe("c1");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].text).toBe("old question");
    expect(result.current.messages[1].provider).toBe("ollama");
  });

  it("startet eine neue Conversation mit leerem Verlauf", async () => {
    getConversationMessagesMock.mockResolvedValueOnce([
      {
        message_id: "m1",
        conversation_id: "c1",
        role: "user",
        content: "old question",
        provider: null,
        model: null,
        turn_id: "t1",
        created_at: "2026-07-01T10:00:00Z",
      },
    ]);
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.selectConversation("c1");
    });
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.startNewConversation();
    });
    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.messages).toHaveLength(0);
  });

  it("loescht eine Conversation und setzt den aktiven Chat zurueck", async () => {
    deleteConversationMock.mockResolvedValueOnce(undefined);
    getConversationMessagesMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.selectConversation("c1");
    });
    await act(async () => {
      await result.current.removeConversation("c1");
    });

    expect(deleteConversationMock).toHaveBeenCalledWith("c1");
    expect(result.current.activeConversationId).toBeNull();
  });

  it("benennt eine Conversation um und laedt die Liste neu", async () => {
    renameConversationMock.mockResolvedValueOnce({
      conversation_id: "c1",
      title: "Renamed",
      created_at: "2026-07-01T10:00:00Z",
      updated_at: "2026-07-01T10:06:00Z",
    });
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.renameConversationTitle("c1", "Renamed");
    });

    expect(renameConversationMock).toHaveBeenCalledWith("c1", "Renamed");
    expect(listConversationsMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("zeigt S3 fallback prompt und sendet retry mit allow flag", async () => {
    streamTurnMock
      .mockImplementationOnce(() =>
        eventsStream([
          {
            event: "error",
            data: {
              code: "local_provider_unavailable",
              message: "Ollama nicht erreichbar",
              provider: "ollama",
              sensitivity: "S3",
              fallback_allowed: true,
            },
          },
        ]),
      )
      .mockImplementationOnce(() =>
        resultStream({
          turn_id: "turn-2",
          response_text: "cloud reply",
          provider: "deepseek",
          model: "deepseek-chat",
        }),
      );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("test");
    });

    expect(result.current.s3FallbackPrompt?.text).toBe("test");
    expect(streamTurnMock.mock.calls[0][0]).toBe("test");
    expect(streamTurnMock.mock.calls[0][1]).toMatchObject({
      allowS3CloudFallback: false,
      allowS3LiveWeb: false,
    });

    await act(async () => {
      await result.current.confirmS3Fallback();
    });

    expect(result.current.s3FallbackPrompt).toBeNull();
    expect(streamTurnMock.mock.calls[1][0]).toBe("test");
    expect(streamTurnMock.mock.calls[1][1]).toMatchObject({
      allowS3CloudFallback: true,
      allowS3LiveWeb: false,
    });
    expect(result.current.messages.at(-1)?.text).toBe("cloud reply");
  });

  it("zeigt S3 live web prompt und sendet retry mit allow_s3_live_web", async () => {
    getSettingsMock.mockResolvedValueOnce({
      ...mockSettings,
      live_web_enabled: true,
      live_web_mode: "provider_native_first",
      preferred_model: "deepseek-chat",
    });
    streamTurnMock
      .mockImplementationOnce(() =>
        eventsStream([
          {
            event: "error",
            data: {
              code: "live_web_confirmation_required",
              message: "S3 bestaetigen",
              sensitivity: "S3",
            },
          },
        ]),
      )
      .mockImplementationOnce(() =>
        resultStream({
          turn_id: "turn-2",
          response_text: "live web reply",
          provider: "deepseek",
          model: "deepseek-chat",
        }),
      );

    const { result } = renderHook(() => useChat());
    await waitFor(() => {
      expect(result.current.selectedModel).toBe("deepseek-chat");
    });

    await act(async () => {
      await result.current.sendMessage("aktueller kurs");
    });

    expect(result.current.s3LiveWebPrompt?.text).toBe("aktueller kurs");
    expect(streamTurnMock.mock.calls[0][1]).toMatchObject({
      model: "deepseek-chat",
      useLiveWeb: true,
      allowS3LiveWeb: false,
    });

    await act(async () => {
      await result.current.confirmS3LiveWeb();
    });

    expect(streamTurnMock.mock.calls[1][1]).toMatchObject({
      model: "deepseek-chat",
      useLiveWeb: true,
      allowS3LiveWeb: true,
    });
  });
});
