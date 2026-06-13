import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiError } from "@/api/client";
import { useChat } from "@/hooks/useChat";
import { mockSettings } from "@/test/fixtures";

const getSettingsMock = vi.fn();
const postTurnMock = vi.fn();

vi.mock("@/api/settings", () => ({
  getSettings: (...args: unknown[]) => getSettingsMock(...args),
}));

vi.mock("@/api/turns", () => ({
  postTurn: (...args: unknown[]) => postTurnMock(...args),
}));

describe("useChat", () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
    postTurnMock.mockReset();
    localStorage.clear();
    getSettingsMock.mockResolvedValue(mockSettings);
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

  it("zeigt S3 fallback prompt und sendet retry mit allow flag", async () => {
    postTurnMock
      .mockRejectedValueOnce(
        new ApiError("local unavailable", 503, {
          detail: {
            code: "local_provider_unavailable",
            message: "Ollama nicht erreichbar",
            provider: "ollama",
            sensitivity: "S3",
            fallback_allowed: true,
          },
        }),
      )
      .mockResolvedValueOnce({
        turn_id: "turn-2",
        response_text: "cloud reply",
        provider: "deepseek",
        model: "deepseek-chat",
      });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("test");
    });

    expect(result.current.s3FallbackPrompt?.text).toBe("test");
    expect(postTurnMock).toHaveBeenNthCalledWith(
      1,
      "test",
      "web",
      undefined,
      undefined,
      undefined,
      false,
      false,
      false,
    );

    await act(async () => {
      await result.current.confirmS3Fallback();
    });

    expect(result.current.s3FallbackPrompt).toBeNull();
    expect(postTurnMock).toHaveBeenNthCalledWith(
      2,
      "test",
      "web",
      undefined,
      undefined,
      undefined,
      true,
      false,
      false,
    );
  });

  it("zeigt S3 live web prompt und sendet retry mit allow_s3_live_web", async () => {
    getSettingsMock.mockResolvedValueOnce({
      ...mockSettings,
      live_web_enabled: true,
      live_web_mode: "provider_native_first",
      preferred_model: "deepseek-chat",
    });
    postTurnMock
      .mockRejectedValueOnce(
        new ApiError("live web confirm", 409, {
          detail: {
            code: "live_web_confirmation_required",
            message: "S3 bestaetigen",
            sensitivity: "S3",
          },
        }),
      )
      .mockResolvedValueOnce({
        turn_id: "turn-2",
        response_text: "live web reply",
        provider: "deepseek",
        model: "deepseek-chat",
      });

    const { result } = renderHook(() => useChat());
    await waitFor(() => {
      expect(result.current.selectedModel).toBe("deepseek-chat");
    });

    await act(async () => {
      await result.current.sendMessage("aktueller kurs");
    });

    expect(result.current.s3LiveWebPrompt?.text).toBe("aktueller kurs");
    expect(postTurnMock).toHaveBeenNthCalledWith(
      1,
      "aktueller kurs",
      "web",
      undefined,
      undefined,
      "deepseek-chat",
      false,
      true,
      false,
    );

    await act(async () => {
      await result.current.confirmS3LiveWeb();
    });

    expect(postTurnMock).toHaveBeenNthCalledWith(
      2,
      "aktueller kurs",
      "web",
      undefined,
      undefined,
      "deepseek-chat",
      false,
      true,
      true,
    );
  });
});
