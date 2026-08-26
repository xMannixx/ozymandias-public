import ModelPicker, { AUTO_VALUE } from "@/components/common/ModelPicker";
import { useProviderModels } from "@/hooks/useProviderModels";
import type { LLMProviderName } from "@/api/types";

type ModelSelectProps = {
  provider: LLMProviderName | null;
  model: string;
  onChange: (model: string) => void;
};

const FIELD_CLASS = "rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100";

function ModelSelect({ provider, model, onChange }: ModelSelectProps): JSX.Element {
  const { models, loading, unavailable } = useProviderModels(provider);

  if (!provider) {
    return (
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        Model
        <select
          aria-label="chat-model-select"
          className={`${FIELD_CLASS} opacity-60`}
          value={AUTO_VALUE}
          disabled
        >
          <option value={AUTO_VALUE}>Automatic (picked by router)</option>
        </select>
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-gray-400">
      {unavailable ? "Model (optional)" : "Model"}
      <ModelPicker
        models={models}
        value={model}
        onChange={onChange}
        loading={loading}
        unavailable={unavailable}
        className={FIELD_CLASS}
        labels={{
          select: "chat-model-select",
          input: "chat-model-input",
          auto: "Default model",
        }}
      />
    </label>
  );
}

export default ModelSelect;
