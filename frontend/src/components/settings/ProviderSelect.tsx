import { useEffect, useMemo, useState } from "react";
import { Cloud, HardDrive } from "lucide-react";
import { listDeepSeekModels, listLMStudioModels, listOllamaModels, listMistralModels } from "@/api/llm";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import SettingField from "@/components/settings/SettingField";
import SettingsCard from "@/components/settings/SettingsCard";
import { useHealth } from "@/hooks/useHealth";
import type { LLMProviderName } from "@/api/types";

const CLOUD_PROVIDERS = ["deepseek", "openai", "gemini", "mistral"] as const;
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

function formatProviderLabel(provider: LLMProviderName): string {
  if (provider === "openai") {
    return "OpenAI";
  }
  if (provider === "lmstudio") {
    return "LM Studio";
  }
  return provider[0].toUpperCase() + provider.slice(1);
}

function toCloudProviderOption(provider: LLMProviderName | null): ProviderOption {
  if (provider === "deepseek" || provider === "openai" || provider === "gemini" || provider === "mistral") {
    return provider;
  }
  return "auto";
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
  const [modelInput, setModelInput] = useState(model ?? "");
  const [selectedLocalProvider, setSelectedLocalProvider] = useState<LocalProviderOption>(localProvider ?? "auto");
  const [selectedLocalModel, setSelectedLocalModel] = useState(localModel ?? "");
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [localModelsLoading, setLocalModelsLoading] = useState(false);
  const [localModelsError, setLocalModelsError] = useState<string | null>(null);
  const [deepseekModels, setDeepseekModels] = useState<string[]>([]);
  const [deepseekModelsLoading, setDeepseekModelsLoading] = useState(false);
  const [deepseekModelsError, setDeepseekModelsError] = useState<string | null>(null);
  const [selectedDeepseekModel, setSelectedDeepseekModel] = useState("");
  const [mistralModels, setMistralModels] = useState<string[]>([]);
  const [mistralModelsLoading, setMistralModelsLoading] = useState(false);
  const [mistralModelsError, setMistralModelsError] = useState<string | null>(null);
  const [selectedMistralModel, setSelectedMistralModel] = useState("");
  const [isLiveWebEnabled, setIsLiveWebEnabled] = useState(liveWebEnabled);
  const [selectedLiveWebMode, setSelectedLiveWebMode] = useState(liveWebMode);
  const [allowS3LiveWebByDefault, setAllowS3LiveWebByDefault] = useState(liveWebS3ConfirmedDefault);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSelectedProvider(toCloudProviderOption(provider));
  }, [provider]);

  useEffect(() => {
    setModelInput(model ?? "");
  }, [model]);

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
    if (selectedProvider === "deepseek" && provider === "deepseek") {
      setSelectedDeepseekModel(model ?? "");
    } else if (selectedProvider === "deepseek") {
      setSelectedDeepseekModel("");
    }
  }, [selectedProvider, provider, model]);

  useEffect(() => {
    if (selectedProvider === "mistral" && provider === "mistral") {
      setSelectedMistralModel(model ?? "");
    } else if (selectedProvider === "mistral") {
      setSelectedMistralModel("");
    }
  }, [selectedProvider, provider, model]);

  useEffect(() => {
    let cancelled = false;
    async function fetchLocalModels(): Promise<void> {
      if (selectedLocalProvider === "auto") {
        setLocalModels([]);
        setLocalModelsError(null);
        return;
      }
      setLocalModelsLoading(true);
      setLocalModelsError(null);
      try {
        const models = selectedLocalProvider === "ollama" ? await listOllamaModels() : await listLMStudioModels();
        if (cancelled) {
          return;
        }
        setLocalModels(models);
        if (models.length === 0) {
          if (selectedLocalProvider === "lmstudio") {
            setLocalModelsError("LM Studio is unreachable or no model is loaded.");
          } else {
            setLocalModelsError("No Ollama models found.");
          }
        }
      } catch {
        if (cancelled) {
          return;
        }
        setLocalModels([]);
        if (selectedLocalProvider === "lmstudio") {
          setLocalModelsError("LM Studio is unreachable.");
        } else {
          setLocalModelsError("Ollama is unreachable.");
        }
      } finally {
        if (!cancelled) {
          setLocalModelsLoading(false);
        }
      }
    }

    void fetchLocalModels();
    return () => {
      cancelled = true;
    };
  }, [selectedLocalProvider]);

  useEffect(() => {
    let cancelled = false;
    async function fetchDeepseekModels(): Promise<void> {
      if (selectedProvider !== "deepseek") {
        setDeepseekModels([]);
        setDeepseekModelsError(null);
        return;
      }
      setDeepseekModelsLoading(true);
      setDeepseekModelsError(null);
      try {
        const models = await listDeepSeekModels();
        if (cancelled) {
          return;
        }
        setDeepseekModels(models);
        if (models.length === 0) {
          setDeepseekModelsError("No DeepSeek models received.");
        }
      } catch {
        if (cancelled) {
          return;
        }
        setDeepseekModels([]);
        setDeepseekModelsError("Failed to load DeepSeek models.");
      } finally {
        if (!cancelled) {
          setDeepseekModelsLoading(false);
        }
      }
    }

    void fetchDeepseekModels();
    return () => {
      cancelled = true;
    };
  }, [selectedProvider]);

  useEffect(() => {
    let cancelled = false;
    async function fetchMistralModels(): Promise<void> {
      if (selectedProvider !== "mistral") {
        setMistralModels([]);
        setMistralModelsError(null);
        return;
      }
      setMistralModelsLoading(true);
      setMistralModelsError(null);
      try {
        const models = await listMistralModels();
        if (cancelled) {
          return;
        }
        setMistralModels(models);
        if (models.length === 0) {
          setMistralModelsError("No Mistral models received.");
        }
      } catch {
        if (cancelled) {
          return;
        }
        setMistralModels([]);
        setMistralModelsError("Failed to load Mistral models.");
      } finally {
        if (!cancelled) {
          setMistralModelsLoading(false);
        }
      }
    }

    void fetchMistralModels();
    return () => {
      cancelled = true;
    };
  }, [selectedProvider]);

  const configuredProviders = useMemo(
    () => new Set((health?.llm_providers ?? []).map((item) => item.toLowerCase())),
    [health?.llm_providers],
  );

  async function savePreference(): Promise<void> {
    const nextProvider = selectedProvider === "auto" ? null : selectedProvider;
    const nextModel =
      selectedProvider === "deepseek"
        ? selectedDeepseekModel.trim().length > 0
          ? selectedDeepseekModel.trim()
          : null
        : selectedProvider === "mistral"
          ? selectedMistralModel.trim().length > 0
            ? selectedMistralModel.trim()
            : null
          : modelInput.trim().length > 0
            ? modelInput.trim()
            : null;
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

  const localModelSelectValue = selectedLocalModel.trim().length > 0 ? selectedLocalModel : "__auto__";
  const localModelOptions = localModels.includes(selectedLocalModel)
    ? localModels
    : selectedLocalModel.trim().length > 0
      ? [selectedLocalModel, ...localModels]
      : localModels;

  const deepseekModelSelectValue = selectedDeepseekModel.trim().length > 0 ? selectedDeepseekModel : "__auto__";
  const deepseekModelOptions = deepseekModels.includes(selectedDeepseekModel)
    ? deepseekModels
    : selectedDeepseekModel.trim().length > 0
      ? [selectedDeepseekModel, ...deepseekModels]
      : deepseekModels;

  const mistralModelSelectValue = selectedMistralModel.trim().length > 0 ? selectedMistralModel : "__auto__";
  const mistralModelOptions = mistralModels.includes(selectedMistralModel)
    ? mistralModels
    : selectedMistralModel.trim().length > 0
      ? [selectedMistralModel, ...mistralModels]
      : mistralModels;

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

        {selectedProvider === "deepseek" ? (
          <SettingField
            label="Model"
            description="Leave on automatic unless you specifically want a different DeepSeek model."
          >
            <select
              aria-label="settings-deepseek-model-select"
              className="w-full text-sm"
              value={deepseekModelSelectValue}
              onChange={(event) => {
                setSelectedDeepseekModel(event.target.value === "__auto__" ? "" : event.target.value);
              }}
              disabled={deepseekModelsLoading}
            >
              <option value="__auto__">Automatic (provider default)</option>
              {deepseekModelOptions.map((modelOption) => (
                <option key={modelOption} value={modelOption}>
                  {modelOption}
                </option>
              ))}
            </select>
          </SettingField>
        ) : selectedProvider === "mistral" ? (
          <SettingField
            label="Model"
            description="Leave on automatic unless you specifically want a different Mistral model."
          >
            <select
              aria-label="settings-mistral-model-select"
              className="w-full text-sm"
              value={mistralModelSelectValue}
              onChange={(event) => {
                setSelectedMistralModel(event.target.value === "__auto__" ? "" : event.target.value);
              }}
              disabled={mistralModelsLoading}
            >
              <option value="__auto__">Automatic (provider default)</option>
              {mistralModelOptions.map((modelOption) => (
                <option key={modelOption} value={modelOption}>
                  {modelOption}
                </option>
              ))}
            </select>
          </SettingField>
        ) : (
          <SettingField
            label="Model name (optional)"
            description="Leave empty to use the provider's default model. Only fill this in if you know the exact name you want."
          >
            <input
              aria-label="settings-model-input"
              className="w-full text-sm"
              placeholder="Leave empty for the default"
              value={modelInput}
              onChange={(event) => setModelInput(event.target.value)}
            />
          </SettingField>
        )}

        {selectedProvider === "deepseek" && deepseekModelsLoading ? <Spinner /> : null}
        {selectedProvider === "deepseek" && deepseekModelsError ? (
          <p className="text-xs text-amber-300">{deepseekModelsError}</p>
        ) : null}
        {selectedProvider === "mistral" && mistralModelsLoading ? <Spinner /> : null}
        {selectedProvider === "mistral" && mistralModelsError ? (
          <p className="text-xs text-amber-300">{mistralModelsError}</p>
        ) : null}
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
            <select
              aria-label="settings-local-model-select"
              className="w-full text-sm"
              value={localModelSelectValue}
              onChange={(event) => {
                setSelectedLocalModel(event.target.value === "__auto__" ? "" : event.target.value);
              }}
              disabled={localModelsLoading}
            >
              <option value="__auto__">Automatic (whatever is loaded)</option>
              {localModelOptions.map((modelOption) => (
                <option key={modelOption} value={modelOption}>
                  {modelOption}
                </option>
              ))}
            </select>
          </SettingField>
        ) : null}

        {localModelsLoading ? <Spinner /> : null}
        {localModelsError ? <p className="text-xs text-amber-300">{localModelsError}</p> : null}
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
