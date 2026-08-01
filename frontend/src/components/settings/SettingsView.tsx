import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";
import Spinner from "@/components/common/Spinner";
import CircuitBreakerSettings from "@/components/settings/CircuitBreakerSettings";
import DecaySettings from "@/components/settings/DecaySettings";
import GoogleConnection from "@/components/settings/GoogleConnection";
import KillSwitch from "@/components/settings/KillSwitch";
import ModeSettings from "@/components/settings/ModeSettings";
import ProviderSelect from "@/components/settings/ProviderSelect";
import ApiKeysSettings from "@/components/settings/ApiKeysSettings";
import VoiceSettings from "@/components/settings/VoiceSettings";
import { useSettings } from "@/hooks/useSettings";

const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

function SettingsView(): JSX.Element {
  const {
    settings,
    loading,
    error,
    refetch,
    updateDecay,
    updateCircuitBreaker,
    updateProviderPreference,
    updateVoiceSettings,
    updateApiKeys,
  } = useSettings();

  const intervalHours = settings?.decay_interval_hours ?? DEFAULT_INTERVAL_HOURS;
  const confidenceThreshold = settings?.decay_confidence_threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  const sections = [
    { id: "governance", label: "Governance" },
    { id: "automation", label: "Automation" },
    { id: "providers", label: "Providers" },
    { id: "integrations", label: "Voice & Google" },
  ];

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Settings</h2>
          <p className="text-sm text-gray-300">Configure how Ozymandias behaves, which providers it uses, and how it connects to your accounts.</p>
        </div>
        <Button variant="ghost" onClick={() => void refetch()}>
          Reload
        </Button>
      </GlassCard>

      <nav aria-label="Settings sections" className="glass-card flex flex-wrap gap-2 p-2">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#settings-${section.id}`}
            className="rounded px-3 py-1 text-sm text-gray-300 hover:bg-gray-800/60"
          >
            {section.label}
          </a>
        ))}
      </nav>

      {loading && !settings ? (
        <GlassCard>
          <Spinner />
        </GlassCard>
      ) : null}
      {error && !settings ? (
        <GlassCard>
          <p className="text-sm text-red-300" role="alert">Could not load settings. {error}</p>
        </GlassCard>
      ) : null}

      <section id="settings-governance" aria-labelledby="settings-governance-heading" className="space-y-3">
        <h3 id="settings-governance-heading" className="text-sm font-semibold uppercase tracking-wider text-blue-300">
          Governance
        </h3>
        <p className="text-xs text-gray-400">
          Controls that decide whether Ozymandias acts on its own (Autopilot) or asks you to confirm each action (Guardian). The kill switch pauses everything immediately.
        </p>
        <ModeSettings />
        <KillSwitch />
      </section>

      <section id="settings-automation" aria-labelledby="settings-automation-heading" className="space-y-3">
        <h3 id="settings-automation-heading" className="text-sm font-semibold uppercase tracking-wider text-blue-300">
          Automation
        </h3>
        <p className="text-xs text-gray-400">
          Fine-tune how often stale memories are re-checked and how many actions Ozymandias may take before pausing itself.
        </p>
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
      </section>

      <section id="settings-providers" aria-labelledby="settings-providers-heading" className="space-y-3">
        <h3 id="settings-providers-heading" className="text-sm font-semibold uppercase tracking-wider text-blue-300">
          Providers
        </h3>
        <p className="text-xs text-gray-400">
          Choose which language model Ozymandias uses by default, and store the API keys it needs to talk to cloud providers.
        </p>
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
        <ApiKeysSettings
          settings={settings}
          saving={loading}
          onSave={updateApiKeys}
        />
      </section>

      <section id="settings-integrations" aria-labelledby="settings-integrations-heading" className="space-y-3">
        <h3 id="settings-integrations-heading" className="text-sm font-semibold uppercase tracking-wider text-blue-300">
          Voice & Google
        </h3>
        <p className="text-xs text-gray-400">
          Enable voice input and speech playback, and connect the Google account Ozymandias uses for mail and calendar.
        </p>
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
      </section>
    </div>
  );
}

export default SettingsView;
