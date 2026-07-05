import { useEffect, useMemo, useState } from "react";
import { listDeepSeekModels, listLMStudioModels, listOllamaModels, listMistralModels } from "@/api/llm";
import GlassCard from "@/components/common/GlassCard";
import Spinner from "@/components/common/Spinner";
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

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-200">LLM Auswahl</p>
        {loading ? <Spinner /> : null}
      </div>

      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Cloud-Provider (S0-S2)
        <select
          aria-label="settings-provider-select"
          className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
          value={selectedProvider}
          onChange={(event) => setSelectedProvider(event.target.value as ProviderOption)}
        >
          <option value="auto">Auto (Router)</option>
          {CLOUD_PROVIDERS.map((item) => {
            const configured = configuredProviders.has(item);
            const current = selectedProvider === item;
            return (
              <option key={item} value={item} disabled={!configured && !current}>
                {formatProviderLabel(item)}
                {configured ? "" : " (not configured)"}
              </option>
            );
          })}
        </select>
      </label>

      {selectedProvider === "deepseek" ? (
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Modell (optional)
          <select
            aria-label="settings-deepseek-model-select"
            className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
            value={deepseekModelSelectValue}
            onChange={(event) => {
              setSelectedDeepseekModel(event.target.value === "__auto__" ? "" : event.target.value);
            }}
            disabled={deepseekModelsLoading}
          >
            <option value="__auto__">Auto (Provider-Default)</option>
            {deepseekModelOptions.map((modelOption) => (
              <option key={modelOption} value={modelOption}>
                {modelOption}
              </option>
            ))}
          </select>
        </label>
      ) : selectedProvider === "mistral" ? (
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Modell (optional)
          <select
            aria-label="settings-mistral-model-select"
            className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
            value={mistralModelSelectValue}
            onChange={(event) => {
              setSelectedMistralModel(event.target.value === "__auto__" ? "" : event.target.value);
            }}
            disabled={mistralModelsLoading}
          >
            <option value="__auto__">Auto (Provider-Default)</option>
            {mistralModelOptions.map((modelOption) => (
              <option key={modelOption} value={modelOption}>
                {modelOption}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Modell (optional)
          <input
            aria-label="settings-model-input"
            className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            placeholder="e.g. gpt-4o or deepseek-chat"
            value={modelInput}
            onChange={(event) => setModelInput(event.target.value)}
          />
        </label>
      )}

      {selectedProvider === "deepseek" && deepseekModelsLoading ? <Spinner /> : null}
      {selectedProvider === "deepseek" && deepseekModelsError ? (
        <p className="text-xs text-yellow-300">{deepseekModelsError}</p>
      ) : null}

      {selectedProvider === "mistral" && mistralModelsLoading ? <Spinner /> : null}
      {selectedProvider === "mistral" && mistralModelsError ? (
        <p className="text-xs text-yellow-300">{mistralModelsError}</p>
      ) : null}

      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Lokaler Provider (S3/S4)
        <select
          aria-label="settings-local-provider-select"
          className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
          value={selectedLocalProvider}
          onChange={(event) => setSelectedLocalProvider(event.target.value as LocalProviderOption)}
        >
          <option value="auto">Auto (Ollama/LM Studio)</option>
          {LOCAL_PROVIDERS.map((item) => {
            const configured = configuredProviders.has(item);
            const current = selectedLocalProvider === item;
            return (
              <option key={item} value={item} disabled={!configured && !current}>
                {formatProviderLabel(item)}
                {configured ? "" : " (not configured)"}
              </option>
            );
          })}
        </select>
      </label>

      {selectedLocalProvider !== "auto" ? (
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Lokales Modell
          <select
            aria-label="settings-local-model-select"
            className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
            value={localModelSelectValue}
            onChange={(event) => {
              setSelectedLocalModel(event.target.value === "__auto__" ? "" : event.target.value);
            }}
            disabled={localModelsLoading}
          >
            <option value="__auto__">Auto (Provider-Default)</option>
            {localModelOptions.map((modelOption) => (
              <option key={modelOption} value={modelOption}>
                {modelOption}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {localModelsLoading ? <Spinner /> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {localModelsError ? <p className="text-xs text-yellow-300">{localModelsError}</p> : null}

      <div className="space-y-2 rounded border border-gray-800 bg-gray-900/40 p-2">
        <p className="text-xs font-medium text-gray-300">Live web access</p>
        <label className="inline-flex items-center gap-2 text-xs text-gray-300">
          <input
            aria-label="settings-live-web-enabled"
            type="checkbox"
            checked={isLiveWebEnabled}
            onChange={(event) => setIsLiveWebEnabled(event.target.checked)}
          />
          Enable live web in chat
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Modus
          <select
            aria-label="settings-live-web-mode"
            className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
            value={selectedLiveWebMode}
            onChange={(event) =>
              setSelectedLiveWebMode(
                event.target.value as "provider_native_first" | "connector_only" | "off",
              )
            }
            disabled={!isLiveWebEnabled}
          >
            <option value="provider_native_first">Provider-native first (with connector fallback)</option>
            <option value="connector_only">Nur Connector</option>
            <option value="off">Aus</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-gray-300">
          <input
            aria-label="settings-live-web-s3-default"
            type="checkbox"
            checked={allowS3LiveWebByDefault}
            onChange={(event) => setAllowS3LiveWebByDefault(event.target.checked)}
            disabled={!isLiveWebEnabled}
          />
          S3-Live-Web standardmaessig erlauben
        </label>
      </div>

      <button
        type="button"
        className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => void savePreference()}
        disabled={saving}
      >
        Save provider
      </button>
    </GlassCard>
  );
}

export default ProviderSelect;
