import { useEffect, useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import SettingsCard from "@/components/settings/SettingsCard";
import type { ProviderKeyId, ProviderKeys, UserSettingsResponse } from "@/api/types";

type ApiKeysSettingsProps = {
  settings: UserSettingsResponse | null;
  saving: boolean;
  onSave: (keys: ProviderKeys) => Promise<void>;
};

const MASKED_KEY = "••••••••";

type KeyFieldConfig = {
  id: ProviderKeyId;
  label: string;
  placeholder: string;
  /** Where the user goes to create this key. */
  source: string;
};

const keyFields: KeyFieldConfig[] = [
  { id: "openai", label: "OpenAI", placeholder: "sk-proj-…", source: "platform.openai.com" },
  { id: "deepseek", label: "DeepSeek", placeholder: "sk-…", source: "platform.deepseek.com" },
  { id: "gemini", label: "Google Gemini", placeholder: "AIzaSy…", source: "aistudio.google.com" },
  { id: "mistral", label: "Mistral", placeholder: "…", source: "console.mistral.ai" },
  { id: "anthropic", label: "Anthropic Claude", placeholder: "sk-ant-…", source: "console.anthropic.com" },
  {
    id: "openrouter",
    label: "OpenRouter",
    placeholder: "sk-or-v1-…",
    source: "openrouter.ai/keys",
  },
];

function keysFromSettings(settings: UserSettingsResponse | null): ProviderKeys {
  return {
    openai: settings?.openai_api_key ?? "",
    deepseek: settings?.deepseek_api_key ?? "",
    gemini: settings?.gemini_api_key ?? "",
    mistral: settings?.mistral_api_key ?? "",
    anthropic: settings?.anthropic_api_key ?? "",
    openrouter: settings?.openrouter_api_key ?? "",
  };
}

function ApiKeysSettings({ settings, saving, onSave }: ApiKeysSettingsProps): JSX.Element {
  const [values, setValues] = useState<ProviderKeys>(keysFromSettings(null));
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setValues(keysFromSettings(settings));
    }
  }, [settings]);

  const storedKeys = keysFromSettings(settings);
  const configuredCount = keyFields.filter((field) => storedKeys[field.id] === MASKED_KEY).length;

  const handleSave = async (): Promise<void> => {
    // A field left blank clears the stored key; the masked value means "keep".
    const trimmed = { ...values };
    for (const field of keyFields) {
      trimmed[field.id] = values[field.id].trim();
    }
    await onSave(trimmed);
    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <SettingsCard
      title="Provider API keys"
      description="Each cloud AI needs its own key so Ozymandias may use it. You only need a key for the providers you actually want."
      badge={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300">
          {configuredCount} of {keyFields.length} set up
        </span>
      }
      footer={
        <>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            Save changes
          </Button>
          {saving ? <Spinner /> : null}
          {saveSuccess ? (
            <span className="text-xs text-emerald-300" role="status" aria-live="polite">
              Keys updated.
            </span>
          ) : null}
        </>
      }
    >
      <p className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-zinc-400">
        Keys are stored encrypted on your own server and are never shown again after saving — a saved key shows as
        dots. To remove a key, clear the field and save.
      </p>

      <div className="space-y-4">
        {keyFields.map((field) => {
          const value = values[field.id];
          const isConfigured = storedKeys[field.id] === MASKED_KEY;
          const isRevealed = revealed[field.id] === true;

          return (
            <div key={field.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`api-key-${field.id}`} className="text-sm font-medium text-zinc-200">
                  {field.label}
                </label>
                {isConfigured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                    Key saved
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-500">Get one at {field.source}</span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  id={`api-key-${field.id}`}
                  type={isRevealed ? "text" : "password"}
                  value={value}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.id]: event.target.value }))
                  }
                  placeholder={field.placeholder}
                  autoComplete="new-password"
                  className="w-full pr-16 text-sm"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRevealed((prev) => ({ ...prev, [field.id]: !isRevealed }))}
                    className="rounded p-1 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
                    aria-label={isRevealed ? `Hide ${field.label} key` : `Show ${field.label} key`}
                  >
                    {isRevealed ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                  {value.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setValues((prev) => ({ ...prev, [field.id]: "" }))}
                      className="rounded p-1 text-zinc-500 hover:bg-white/[0.05] hover:text-rose-300"
                      aria-label={`Clear ${field.label} key`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
}

export default ApiKeysSettings;
