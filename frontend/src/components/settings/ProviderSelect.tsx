import { useEffect, useMemo, useState } from "react";
import { Cloud, HardDrive } from "lucide-react";
import Button from "@/components/common/Button";
import ModelPicker from "@/components/common/ModelPicker";
import Spinner from "@/components/common/Spinner";
import SettingField from "@/components/settings/SettingField";
import SettingsCard from "@/components/settings/SettingsCard";
import { useHealth } from "@/hooks/useHealth";
import { useProviderModels } from "@/hooks/useProviderModels";
import type { LLMProviderName } from "@/api/types";

const CLOUD_PROVIDERS = ["deepseek", "openai", "gemini", "mistral", "anthropic", "openrouter"] as const;
const LOCAL_PROVIDERS = ["ollama", "lmstudio"] as const;

type CloudProviderName = (typeof CLOUD_PROVIDERS)[number];
type LocalProviderName = (typeof LOCAL_PROVIDERS)[number];
type ProviderOption = "auto" | CloudProviderName;
type LocalProviderOption = "auto" | LocalProviderName;

type ProviderSelectProps = {
  provider: LLMProviderName | null;
  model: string | null;
  localProvider: LocalProviderName | null;
  localModel: string | null;
  liveWebEnabled: boolean;
  liveWebMode: "provider_native_first" | "connector_only" | "off";
  liveWebS3ConfirmedDefault: boolean;
  saving: boolean;
  onSave: (
    provider: LLMProviderName | null,
    model: string | null,
    localProvider: LocalProviderName | null,
    localModel: string | null,
    liveWebEnabled: boolean,
    liveWebMode: "provider_native_first" | "connector_only" | "off",
    liveWebS3ConfirmedDefault: boolean,
  ) => Promise<void>;
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  lmstudio: "LM Studio",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
};

function formatProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider[0].toUpperCase() + provider.slice(1);
}

function toCloudProviderOption(provider: LLMProviderName | null): ProviderOption {
  return provider !== null && CLOUD_PROVIDERS.includes(provider as CloudProviderName)
    ? (provider as CloudProviderName)
    : "auto";
}

function localModelsHint(provider: LocalProviderName): string {
  return provider === "lmstudio"
    ? "LM Studio is unreachable or no model is loaded."
    : "Ollama is unreachable or has no models installed.";
}

function ProviderSelect({
  provider,
  model,
  localProvider,
  localModel,
  liveWebEnabled,
  liveWebMode,
  liveWebS3ConfirmedDefault,
  saving,
  onSave,
}: ProviderSelectProps): JSX.Element {
  const { health, loading, error } = useHealth();
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption>(toCloudProviderOption(provider));
  const [selectedModel, setSelectedModel] = useState(model ?? "");
  const [selectedLocalProvider, setSelectedLocalProvider] = useState<LocalProviderOption>(localProvider ?? "auto");
  const [selectedLocalModel, setSelectedLocalModel] = useState(localModel ?? "");
  const [isLiveWebEnabled, setIsLiveWebEnabled] = useState(liveWebEnabled);
  const [selectedLiveWebMode, setSelectedLiveWebMode] = useState(liveWebMode);
  const [allowS3LiveWebByDefault, setAllowS3LiveWebByDefault] = useState(liveWebS3ConfirmedDefault);
  const [saved, setSaved] = useState(false);

  const cloudModels = useProviderModels(selectedProvider === "auto" ? null : selectedProvider);
  const localModels = useProviderModels(selectedLocalProvider === "auto" ? null : selectedLocalProvider);

  useEffect(() => {
    setSelectedProvider(toCloudProviderOption(provider));
  }, [provider]);

  useEffect(() => {
    setSelectedLocalProvider(localProvider ?? "auto");
  }, [localProvider]);

  useEffect(() => {
    setSelectedLocalModel(localModel ?? "");
  }, [localModel]);

  useEffect(() => {
    setIsLiveWebEnabled(liveWebEnabled);
  }, [liveWebEnabled]);

  useEffect(() => {
    setSelectedLiveWebMode(liveWebMode);
  }, [liveWebMode]);

  useEffect(() => {
    setAllowS3LiveWebByDefault(liveWebS3ConfirmedDefault);
  }, [liveWebS3ConfirmedDefault]);

  useEffect(() => {
    // A model belongs to one provider, so switching provider clears it unless
    // we are back at the stored combination.
    setSelectedModel(selectedProvider === toCloudProviderOption(provider) ? (model ?? "") : "");
  }, [selectedProvider, provider, model]);

  const configuredProviders = useMemo(
    () => new Set((health?.llm_providers ?? []).map((item) => item.toLowerCase())),
    [health?.llm_providers],
  );

  async function savePreference(): Promise<void> {
    const nextProvider = selectedProvider === "auto" ? null : selectedProvider;
    const trimmedModel = selectedModel.trim();
    const nextModel = nextProvider === null || trimmedModel.length === 0 ? null : trimmedModel;
    const nextLocalProvider = selectedLocalProvider === "auto" ? null : selectedLocalProvider;
    const trimmedLocalModel = selectedLocalModel.trim();
    const nextLocalModel = nextLocalProvider === null || trimmedLocalModel.length === 0 ? null : trimmedLocalModel;
    await onSave(
      nextProvider,
      nextModel,
      nextLocalProvider,
      nextLocalModel,
      isLiveWebEnabled,
      selectedLiveWebMode,
      allowS3LiveWebByDefault,
    );
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  }

  const liveWebModeDescription: Record<typeof selectedLiveWebMode, string> = {
    provider_native_first:
      "Ozymandias first asks the AI to search the web itself. If the AI cannot, it falls back to the built-in search connector.",
    connector_only: "Ozymandias always uses its own built-in search connector, never the AI's own search.",
    off: "No web lookups at all. Answers rely only on what the AI already knows and what you have saved.",
  };

  return (
    <SettingsCard
      title="Which AI answers you"
      description="Ozymandias sends everyday questions to a cloud AI, but keeps private topics on a model running on your own machine. You choose both."
      badge={loading ? <Spinner /> : null}
      footer={
        <>
          <Button onClick={() => void savePreference()} disabled={saving}>
            Save changes
          </Button>
          {saved ? (
            <span className="text-xs text-emerald-300" role="status" aria-live="polite">
              Saved.
            </span>
          ) : null}
        </>
      }
    >
      <div className="space-y-4 rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-sky-400" aria-hidden="true" />
          <p className="text-sm font-medium text-zinc-100">Everyday topics</p>
        </div>
        <p className="text-xs leading-relaxed text-zinc-400">
          Used for anything that is not personally sensitive — general questions, drafting, brainstorming. These
          messages leave your machine and go to the provider you pick.
        </p>

        <SettingField label="Cloud provider" description="Pick a specific service, or let Ozymandias decide.">
          <select
            aria-label="settings-provider-select"
            className="w-full text-sm"
            value={selectedProvider}
            onChange={(event) => setSelectedProvider(event.target.value as ProviderOption)}
          >
            <option value="auto">Let Ozymandias choose automatically</option>
            {CLOUD_PROVIDERS.map((item) => {
              const configured = configuredProviders.has(item);
              const current = selectedProvider === item;
              return (
                <option key={item} value={item} disabled={!configured && !current}>
                  {formatProviderLabel(item)}
                  {configured ? "" : " — needs an API key first"}
                </option>
              );
            })}
          </select>
        </SettingField>

        {selectedProvider !== "auto" ? (
          <SettingField
            label={cloudModels.unavailable ? "Model name (optional)" : "Model"}
            description={
              cloudModels.unavailable
                ? "This provider publishes no model list. Leave empty for its default, or type an exact name."
                : "Leave on automatic unless you want one specific model."
            }
          >
            <ModelPicker
              models={cloudModels.models}
              value={selectedModel}
              onChange={setSelectedModel}
              loading={cloudModels.loading}
              unavailable={cloudModels.unavailable}
              labels={{
                select: "settings-model-select",
                input: "settings-model-input",
                auto: "Automatic (provider default)",
              }}
            />
          </SettingField>
        ) : null}

        {selectedProvider !== "auto" && cloudModels.loading ? <Spinner /> : null}
      </div>

      <div className="space-y-4 rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <p className="text-sm font-medium text-zinc-100">Private topics</p>
        </div>
        <p className="text-xs leading-relaxed text-zinc-400">
          Health, finances, relationships and similar. These never leave your machine — they are always handled by
          a model running locally, even if a cloud provider is configured above.
        </p>

        <SettingField
          label="Local model runner"
          description="The program on your machine that runs the local model."
        >
          <select
            aria-label="settings-local-provider-select"
            className="w-full text-sm"
            value={selectedLocalProvider}
            onChange={(event) => setSelectedLocalProvider(event.target.value as LocalProviderOption)}
          >
            <option value="auto">Use whichever is available (Ollama or LM Studio)</option>
            {LOCAL_PROVIDERS.map((item) => {
              const configured = configuredProviders.has(item);
              const current = selectedLocalProvider === item;
              return (
                <option key={item} value={item} disabled={!configured && !current}>
                  {formatProviderLabel(item)}
                  {configured ? "" : " — not running"}
                </option>
              );
            })}
          </select>
        </SettingField>

        {selectedLocalProvider !== "auto" ? (
          <SettingField
            label="Local model"
            description="Which of the models installed locally to use."
          >
            <ModelPicker
              models={localModels.models}
              value={selectedLocalModel}
              onChange={setSelectedLocalModel}
              loading={localModels.loading}
              labels={{
                select: "settings-local-model-select",
                input: "settings-local-model-input",
                auto: "Automatic (whatever is loaded)",
              }}
            />
          </SettingField>
        ) : null}

        {localModels.loading ? <Spinner /> : null}
        {selectedLocalProvider !== "auto" && localModels.unavailable ? (
          <p className="text-xs text-amber-300">{localModelsHint(selectedLocalProvider)}</p>
        ) : null}
      </div>

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      <div className="space-y-3 rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">Web search</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
            Lets Ozymandias look things up online when your question needs current information.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-zinc-200">
          <input
            aria-label="settings-live-web-enabled"
            type="checkbox"
            checked={isLiveWebEnabled}
            className="mt-0.5 h-3.5 w-3.5 accent-indigo-500"
            onChange={(event) => setIsLiveWebEnabled(event.target.checked)}
          />
          <span>Allow Ozymandias to search the web</span>
        </label>

        {isLiveWebEnabled ? (
          <>
            <SettingField label="How to search" description={liveWebModeDescription[selectedLiveWebMode]}>
              <select
                aria-label="settings-live-web-mode"
                className="w-full text-sm"
                value={selectedLiveWebMode}
                onChange={(event) =>
                  setSelectedLiveWebMode(
                    event.target.value as "provider_native_first" | "connector_only" | "off",
                  )
                }
              >
                <option value="provider_native_first">Prefer the AI's own search, fall back to ours</option>
                <option value="connector_only">Always use our own search connector</option>
                <option value="off">Never search the web</option>
              </select>
            </SettingField>

            <label className="flex items-start gap-2 text-sm text-zinc-200">
              <input
                aria-label="settings-live-web-s3-default"
                type="checkbox"
                checked={allowS3LiveWebByDefault}
                className="mt-0.5 h-3.5 w-3.5 accent-indigo-500"
                onChange={(event) => setAllowS3LiveWebByDefault(event.target.checked)}
              />
              <span>
                Search the web for private topics too, without asking each time
                <span className="mt-0.5 block text-xs text-zinc-400">
                  Off by default: Ozymandias asks for permission before sending anything derived from a private
                  topic to a search engine. Turning this on skips that prompt.
                </span>
              </span>
            </label>
          </>
        ) : null}
      </div>
    </SettingsCard>
  );
}

export default ProviderSelect;
