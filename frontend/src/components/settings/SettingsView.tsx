import { useState } from "react";
import { Brain, KeyRound, type LucideIcon, Mic, RefreshCw, ShieldCheck } from "lucide-react";
import Spinner from "@/components/common/Spinner";
import ApiKeysSettings from "@/components/settings/ApiKeysSettings";
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

type TabId = "behaviour" | "models" | "memory" | "connections";

type Tab = {
  id: TabId;
  label: string;
  icon: LucideIcon;
  /** Shown under the tab bar so the user knows what this group is for. */
  blurb: string;
};

const tabs: Tab[] = [
  {
    id: "behaviour",
    label: "Behaviour",
    icon: ShieldCheck,
    blurb: "Decide how much Ozymandias may do on its own, and how to stop it instantly.",
  },
  {
    id: "models",
    label: "AI models",
    icon: KeyRound,
    blurb: "Pick which AI answers your messages and store the keys needed to reach it.",
  },
  {
    id: "memory",
    label: "Memory & limits",
    icon: Brain,
    blurb: "Control how memories age and how many actions Ozymandias may take in a row.",
  },
  {
    id: "connections",
    label: "Voice & Google",
    icon: Mic,
    blurb: "Talk to Ozymandias out loud, and connect Gmail and Google Calendar.",
  },
];

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
  const [activeTab, setActiveTab] = useState<TabId>("behaviour");

  const intervalHours = settings?.decay_interval_hours ?? DEFAULT_INTERVAL_HOURS;
  const confidenceThreshold = settings?.decay_confidence_threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Settings</h2>
          <p className="text-sm text-zinc-400">
            Everything here changes how Ozymandias behaves. Each option explains what it does.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.05]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Reload
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex flex-wrap gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.id}`}
              id={`settings-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-white/[0.07] text-white"
                  : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-zinc-400">{activeTabConfig.blurb}</p>

      {loading && !settings ? (
        <div className="glass-card flex justify-center p-6" role="status" aria-live="polite">
          <Spinner />
        </div>
      ) : null}
      {error && !settings ? (
        <div className="glass-card p-5" role="alert">
          <p className="text-sm text-rose-300">Could not load settings. {error}</p>
        </div>
      ) : null}

      <div
        role="tabpanel"
        id={`settings-panel-${activeTab}`}
        aria-labelledby={`settings-tab-${activeTab}`}
        className="space-y-4"
      >
        {activeTab === "behaviour" ? (
          <>
            <ModeSettings />
            <KillSwitch />
          </>
        ) : null}

        {activeTab === "models" ? (
          <>
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
            <ApiKeysSettings settings={settings} saving={loading} onSave={updateApiKeys} />
          </>
        ) : null}

        {activeTab === "memory" ? (
          <>
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
          </>
        ) : null}

        {activeTab === "connections" ? (
          <>
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
          </>
        ) : null}
      </div>
    </div>
  );
}

export default SettingsView;
