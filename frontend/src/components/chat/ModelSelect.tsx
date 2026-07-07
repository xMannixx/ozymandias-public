import { useEffect, useState } from "react";
import { listModelsForProvider } from "@/api/llm";
import type { LLMProviderName } from "@/api/types";

type ModelSelectProps = {
  provider: LLMProviderName | null;
  model: string;
  onChange: (model: string) => void;
};

const AUTO_VALUE = "__auto__";

function ModelSelect({ provider, model, onChange }: ModelSelectProps): JSX.Element {
  const [models, setModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!provider) {
      setModels([]);
      setLoadFailed(false);
      return;
    }
    setIsLoading(true);
    setLoadFailed(false);
    void (async () => {
      try {
        const items = await listModelsForProvider(provider);
        if (cancelled) {
          return;
        }
        setModels(items);
        setLoadFailed(items.length === 0);
      } catch {
        if (cancelled) {
          return;
        }
        setModels([]);
        setLoadFailed(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider]);

  if (!provider) {
    return (
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Model
        <select
          aria-label="chat-model-select"
          className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100 opacity-60"
          value={AUTO_VALUE}
          disabled
        >
          <option value={AUTO_VALUE}>Automatic (picked by router)</option>
        </select>
      </label>
    );
  }

  if (loadFailed) {
    return (
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Model (optional)
        <input
          aria-label="chat-model-input"
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          placeholder="Model name (list unavailable)"
          value={model}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  const options = model && !models.includes(model) ? [model, ...models] : models;
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-400">
      Model
      <select
        aria-label="chat-model-select"
        className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
        value={model || AUTO_VALUE}
        onChange={(event) => onChange(event.target.value === AUTO_VALUE ? "" : event.target.value)}
        disabled={isLoading}
      >
        <option value={AUTO_VALUE}>
          {isLoading ? "Loading models..." : "Default model"}
        </option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

export default ModelSelect;
