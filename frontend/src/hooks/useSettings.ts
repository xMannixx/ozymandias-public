import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getSettings, updateSettings } from "@/api/settings";
import type { LLMProviderName, UserSettingsResponse, VoiceMode } from "@/api/types";

type UseSettingsResult = {
  settings: UserSettingsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateDecay: (intervalHours: number, confidenceThreshold: number) => Promise<void>;
  updateCircuitBreaker: (maxActions: number | null, windowSeconds: number | null, cooldownSeconds: number | null) => Promise<void>;
  updateProviderPreference: (
    provider: LLMProviderName | null,
    model: string | null,
    localProvider: "ollama" | "lmstudio" | null,
    localModel: string | null,
    liveWebEnabled: boolean,
    liveWebMode: "provider_native_first" | "connector_only" | "off",
    liveWebS3ConfirmedDefault: boolean,
  ) => Promise<void>;
  updateVoiceSettings: (
    voiceEnabled: boolean,
    voiceMode: VoiceMode,
    ttsVoice: string,
    ttsModel: "tts-1" | "tts-1-hd",
    ttsAutoplay: boolean,
  ) => Promise<void>;
  updateBriefing: (enabled: boolean, hour: number) => Promise<void>;
  updateApiKeys: (
    openaiKey: string | null,
    deepseekKey: string | null,
    geminiKey: string | null,
    mistralKey: string | null,
    anthropicKey: string | null,
  ) => Promise<void>;
};

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load settings";
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<UserSettingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getSettings();
      setSettings(response);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const patchSettings = useCallback(async (payload: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await updateSettings(payload);
      setSettings(response);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDecay = useCallback(
    async (intervalHours: number, confidenceThreshold: number) => {
      await patchSettings({
        decay_interval_hours: intervalHours,
        decay_confidence_threshold: confidenceThreshold,
      });
    },
    [patchSettings],
  );

  const updateCircuitBreaker = useCallback(
    async (maxActions: number | null, windowSeconds: number | null, cooldownSeconds: number | null) => {
      await patchSettings({
        cb_max_actions_override: maxActions,
        cb_window_seconds_override: windowSeconds,
        cb_cooldown_seconds_override: cooldownSeconds,
      });
    },
    [patchSettings],
  );

  const updateProviderPreference = useCallback(
    async (
      provider: LLMProviderName | null,
      model: string | null,
      localProvider: "ollama" | "lmstudio" | null,
      localModel: string | null,
      liveWebEnabled: boolean,
      liveWebMode: "provider_native_first" | "connector_only" | "off",
      liveWebS3ConfirmedDefault: boolean,
    ) => {
      await patchSettings({
        preferred_provider: provider,
        preferred_model: model,
        preferred_local_provider: localProvider,
        preferred_local_model: localModel,
        live_web_enabled: liveWebEnabled,
        live_web_mode: liveWebMode,
        live_web_s3_confirmed_default: liveWebS3ConfirmedDefault,
      });
    },
    [patchSettings],
  );

  const updateVoiceSettings = useCallback(
    async (
      voiceEnabled: boolean,
      voiceMode: VoiceMode,
      ttsVoice: string,
      ttsModel: "tts-1" | "tts-1-hd",
      ttsAutoplay: boolean,
    ) => {
      await patchSettings({
        voice_enabled: voiceEnabled,
        voice_mode: voiceMode,
        tts_voice: ttsVoice,
        tts_model: ttsModel,
        tts_autoplay: ttsAutoplay,
      });
    },
    [patchSettings],
  );

  const updateBriefing = useCallback(
    async (enabled: boolean, hour: number) => {
      await patchSettings({ briefing_enabled: enabled, briefing_hour: hour });
    },
    [patchSettings],
  );

  const updateApiKeys = useCallback(
    async (
      openaiKey: string | null,
      deepseekKey: string | null,
      geminiKey: string | null,
      mistralKey: string | null,
      anthropicKey: string | null,
    ) => {
      await patchSettings({
        openai_api_key: openaiKey,
        deepseek_api_key: deepseekKey,
        gemini_api_key: geminiKey,
        mistral_api_key: mistralKey,
        anthropic_api_key: anthropicKey,
      });
    },
    [patchSettings],
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    settings,
    loading,
    error,
    refetch,
    updateDecay,
    updateCircuitBreaker,
    updateProviderPreference,
    updateVoiceSettings,
    updateBriefing,
    updateApiKeys,
  };
}
