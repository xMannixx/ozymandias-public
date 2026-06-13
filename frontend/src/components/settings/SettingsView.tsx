import GlassCard from "@/components/common/GlassCard";
import Spinner from "@/components/common/Spinner";
import CircuitBreakerSettings from "@/components/settings/CircuitBreakerSettings";
import DecaySettings from "@/components/settings/DecaySettings";
import GoogleConnection from "@/components/settings/GoogleConnection";
import KillSwitch from "@/components/settings/KillSwitch";
import ModeSettings from "@/components/settings/ModeSettings";
import ProviderSelect from "@/components/settings/ProviderSelect";
import VoiceSettings from "@/components/settings/VoiceSettings";
import { useSettings } from "@/hooks/useSettings";

const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

function SettingsView(): JSX.Element {
  const { settings, loading, error, refetch, updateDecay, updateCircuitBreaker, updateProviderPreference, updateVoiceSettings } =
    useSettings();

  const intervalHours = settings?.decay_interval_hours ?? DEFAULT_INTERVAL_HOURS;
  const confidenceThreshold = settings?.decay_confidence_threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Settings</h2>
          <p className="text-sm text-gray-300">Runtime-Konfiguration fuer Mode, Decay, Circuit Breaker und Provider-Status.</p>
        </div>
        <button
          type="button"
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800"
          onClick={() => void refetch()}
        >
          Neu laden
        </button>
      </GlassCard>

      {loading && !settings ? (
        <GlassCard>
          <Spinner />
        </GlassCard>
      ) : null}
      {error ? (
        <GlassCard>
          <p className="text-sm text-red-300">{error}</p>
        </GlassCard>
      ) : null}

      <ModeSettings />
      <KillSwitch />
      <DecaySettings
        intervalHours={intervalHours}
        confidenceThreshold={confidenceThreshold}
        saving={loading}
        onSave={updateDecay}
      />
      <CircuitBreakerSettings
        maxActions={settings?.cb_max_actions_override ?? null}
        windowSeconds={settings?.cb_window_seconds_override ?? null}
        cooldownSeconds={settings?.cb_cooldown_seconds_override ?? null}
        saving={loading}
        onSave={updateCircuitBreaker}
      />
      <ProviderSelect
        provider={settings?.preferred_provider ?? null}
        model={settings?.preferred_model ?? null}
        localProvider={settings?.preferred_local_provider ?? null}
        localModel={settings?.preferred_local_model ?? null}
        liveWebEnabled={settings?.live_web_enabled ?? false}
        liveWebMode={settings?.live_web_mode ?? "provider_native_first"}
        liveWebS3ConfirmedDefault={settings?.live_web_s3_confirmed_default ?? false}
        saving={loading}
        onSave={updateProviderPreference}
      />
      <VoiceSettings
        voiceEnabled={settings?.voice_enabled ?? false}
        voiceMode={settings?.voice_mode ?? "push_to_talk"}
        ttsVoice={settings?.tts_voice ?? "ash"}
        ttsModel={settings?.tts_model ?? "tts-1"}
        ttsAutoplay={settings?.tts_autoplay ?? true}
        saving={loading}
        onSave={updateVoiceSettings}
      />
      <GoogleConnection />
    </div>
  );
}

export default SettingsView;
