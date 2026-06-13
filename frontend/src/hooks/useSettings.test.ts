import { act, renderHook, waitFor } from "@testing-library/react";
import { useSettings } from "@/hooks/useSettings";
import { mockSettings } from "@/test/fixtures";

const getSettingsMock = vi.fn();
const updateSettingsMock = vi.fn();

vi.mock("@/api/settings", () => ({
  getSettings: (...args: unknown[]) => getSettingsMock(...args),
  updateSettings: (...args: unknown[]) => updateSettingsMock(...args),
}));

describe("useSettings", () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
    updateSettingsMock.mockReset();
    getSettingsMock.mockResolvedValue(mockSettings);
    updateSettingsMock.mockResolvedValue(mockSettings);
  });

  it("loads settings on mount", async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings?.mode).toBe("guardian");
    });
    expect(getSettingsMock).toHaveBeenCalledTimes(1);
  });

  it("updateDecay sends patch payload and updates settings", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    const updated = { ...mockSettings, decay_interval_hours: 48, decay_confidence_threshold: 0.75 };
    updateSettingsMock.mockResolvedValueOnce(updated);

    await act(async () => {
      await result.current.updateDecay(48, 0.75);
    });

    expect(updateSettingsMock).toHaveBeenCalledWith({
      decay_interval_hours: 48,
      decay_confidence_threshold: 0.75,
    });
    expect(result.current.settings?.decay_interval_hours).toBe(48);
  });

  it("updateCircuitBreaker sends nullable override payload", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    const updated = {
      ...mockSettings,
      cb_max_actions_override: 12,
      cb_window_seconds_override: 30,
      cb_cooldown_seconds_override: null,
    };
    updateSettingsMock.mockResolvedValueOnce(updated);

    await act(async () => {
      await result.current.updateCircuitBreaker(12, 30, null);
    });

    expect(updateSettingsMock).toHaveBeenCalledWith({
      cb_max_actions_override: 12,
      cb_window_seconds_override: 30,
      cb_cooldown_seconds_override: null,
    });
    expect(result.current.settings?.cb_max_actions_override).toBe(12);
  });

  it("stores error when initial load fails", async () => {
    getSettingsMock.mockRejectedValueOnce(new Error("kaputt"));
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.error).toBe("kaputt");
    });
  });

  it("updateProviderPreference sends provider/model payload", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    const updated = {
      ...mockSettings,
      preferred_provider: "openai" as const,
      preferred_model: "gpt-4o",
      preferred_local_provider: "ollama" as const,
      preferred_local_model: "llama3.1:8b",
    };
    updateSettingsMock.mockResolvedValueOnce(updated);

    await act(async () => {
      await result.current.updateProviderPreference(
        "openai",
        "gpt-4o",
        "ollama",
        "llama3.1:8b",
        true,
        "provider_native_first",
        false,
      );
    });

    expect(updateSettingsMock).toHaveBeenCalledWith({
      preferred_provider: "openai",
      preferred_model: "gpt-4o",
      preferred_local_provider: "ollama",
      preferred_local_model: "llama3.1:8b",
      live_web_enabled: true,
      live_web_mode: "provider_native_first",
      live_web_s3_confirmed_default: false,
    });
    expect(result.current.settings?.preferred_provider).toBe("openai");
    expect(result.current.settings?.preferred_model).toBe("gpt-4o");
    expect(result.current.settings?.preferred_local_provider).toBe("ollama");
    expect(result.current.settings?.preferred_local_model).toBe("llama3.1:8b");
  });

  it("updateVoiceSettings sends voice payload", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    const updated = {
      ...mockSettings,
      voice_enabled: true,
      voice_mode: "hands_free" as const,
      tts_voice: "nova",
      tts_model: "tts-1-hd" as const,
      tts_autoplay: false,
    };
    updateSettingsMock.mockResolvedValueOnce(updated);

    await act(async () => {
      await result.current.updateVoiceSettings(true, "hands_free", "nova", "tts-1-hd", false);
    });

    expect(updateSettingsMock).toHaveBeenCalledWith({
      voice_enabled: true,
      voice_mode: "hands_free",
      tts_voice: "nova",
      tts_model: "tts-1-hd",
      tts_autoplay: false,
    });
    expect(result.current.settings?.voice_enabled).toBe(true);
    expect(result.current.settings?.voice_mode).toBe("hands_free");
  });
});
