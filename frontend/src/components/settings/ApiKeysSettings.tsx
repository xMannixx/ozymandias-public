import { useEffect, useState } from "react";
import GlassCard from "@/components/common/GlassCard";
import Spinner from "@/components/common/Spinner";
import type { UserSettingsResponse } from "@/api/types";

type ApiKeysSettingsProps = {
  settings: UserSettingsResponse | null;
  saving: boolean;
  onSave: (
    openaiKey: string | null,
    deepseekKey: string | null,
    geminiKey: string | null,
    mistralKey: string | null,
    anthropicKey: string | null,
  ) => Promise<void>;
};

function ApiKeysSettings({ settings, saving, onSave }: ApiKeysSettingsProps): JSX.Element {
  const [openaiKey, setOpenaiKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [mistralKey, setMistralKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");

  const [showOpenai, setShowOpenai] = useState(false);
  const [showDeepseek, setShowDeepseek] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showMistral, setShowMistral] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync settings when they load
  useEffect(() => {
    if (settings) {
      setOpenaiKey(settings.openai_api_key ?? "");
      setDeepseekKey(settings.deepseek_api_key ?? "");
      setGeminiKey(settings.gemini_api_key ?? "");
      setMistralKey(settings.mistral_api_key ?? "");
      setAnthropicKey(settings.anthropic_api_key ?? "");
    }
  }, [settings]);

  const hasConfiguredKey = (originalKey: string | null | undefined) => {
    return originalKey === "••••••••";
  };

  const handleSave = async () => {
    // Treat empty string as null to clear key
    const nextOpenai = openaiKey.trim() === "" ? "" : openaiKey;
    const nextDeepseek = deepseekKey.trim() === "" ? "" : deepseekKey;
    const nextGemini = geminiKey.trim() === "" ? "" : geminiKey;
    const nextMistral = mistralKey.trim() === "" ? "" : mistralKey;
    const nextAnthropic = anthropicKey.trim() === "" ? "" : anthropicKey;

    await onSave(nextOpenai, nextDeepseek, nextGemini, nextMistral, nextAnthropic);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const renderKeyField = (
    label: string,
    value: string,
    onChange: (val: string) => void,
    show: boolean,
    toggleShow: () => void,
    originalKey: string | null | undefined,
    placeholder: string
  ) => {
    const isConfigured = hasConfiguredKey(originalKey);
    const hasValue = value.length > 0;

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-400">{label}</label>
          {isConfigured && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Active
            </span>
          )}
        </div>
        <div className="relative flex items-center">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pr-20 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none"
            autoComplete="new-password"
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleShow}
              className="p-1 hover:text-gray-100 text-gray-400 focus:outline-none transition-colors cursor-pointer"
              title={show ? "Hide" : "Show"}
            >
              {show ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
            {hasValue && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="p-1 hover:text-red-400 text-gray-400 focus:outline-none transition-colors cursor-pointer"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-800 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">Cloud API keys</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure your own API keys for external model providers.
          </p>
        </div>
        {saving && <Spinner />}
      </div>

      <div className="space-y-3">
        {renderKeyField(
          "OpenAI API Key",
          openaiKey,
          setOpenaiKey,
          showOpenai,
          () => setShowOpenai(!showOpenai),
          settings?.openai_api_key,
          "sk-proj-..."
        )}
        {renderKeyField(
          "DeepSeek API Key",
          deepseekKey,
          setDeepseekKey,
          showDeepseek,
          () => setShowDeepseek(!showDeepseek),
          settings?.deepseek_api_key,
          "sk-..."
        )}
        {renderKeyField(
          "Google Gemini API Key",
          geminiKey,
          setGeminiKey,
          showGemini,
          () => setShowGemini(!showGemini),
          settings?.gemini_api_key,
          "AIzaSy..."
        )}
        {renderKeyField(
          "Mistral API Key",
          mistralKey,
          setMistralKey,
          showMistral,
          () => setShowMistral(!showMistral),
          settings?.mistral_api_key,
          "..."
        )}
        {renderKeyField(
          "Anthropic Claude API Key",
          anthropicKey,
          setAnthropicKey,
          showAnthropic,
          () => setShowAnthropic(!showAnthropic),
          settings?.anthropic_api_key,
          "sk-ant-..."
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          className="rounded border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-800 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleSave}
          disabled={saving}
        >
          Save keys
        </button>

        {saveSuccess && (
          <span className="text-xs text-green-400 animate-fade-in">
            Keys updated successfully!
          </span>
        )}
      </div>
    </GlassCard>
  );
}

export default ApiKeysSettings;
