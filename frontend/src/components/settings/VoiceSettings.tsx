import { useEffect, useRef, useState } from "react";
import { getVoices, synthesizeSpeech } from "@/api/voice";
import GlassCard from "@/components/common/GlassCard";
import Spinner from "@/components/common/Spinner";
import type { VoiceMode } from "@/api/types";

type VoiceSettingsProps = {
  voiceEnabled: boolean;
  voiceMode: VoiceMode;
  ttsVoice: string;
  ttsModel: "tts-1" | "tts-1-hd";
  ttsAutoplay: boolean;
  saving: boolean;
  onSave: (
    voiceEnabled: boolean,
    voiceMode: VoiceMode,
    ttsVoice: string,
    ttsModel: "tts-1" | "tts-1-hd",
    ttsAutoplay: boolean,
  ) => Promise<void>;
};

function VoiceSettings({
  voiceEnabled,
  voiceMode,
  ttsVoice,
  ttsModel,
  ttsAutoplay,
  saving,
  onSave,
}: VoiceSettingsProps): JSX.Element {
  const [enabled, setEnabled] = useState(voiceEnabled);
  const [mode, setMode] = useState<VoiceMode>(voiceMode);
  const [voice, setVoice] = useState(ttsVoice);
  const [model, setModel] = useState<"tts-1" | "tts-1-hd">(ttsModel);
  const [autoplay, setAutoplay] = useState(ttsAutoplay);
  const [voices, setVoices] = useState<string[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const testUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setEnabled(voiceEnabled);
  }, [voiceEnabled]);

  useEffect(() => {
    setMode(voiceMode);
  }, [voiceMode]);

  useEffect(() => {
    setVoice(ttsVoice);
  }, [ttsVoice]);

  useEffect(() => {
    setModel(ttsModel);
  }, [ttsModel]);

  useEffect(() => {
    setAutoplay(ttsAutoplay);
  }, [ttsAutoplay]);

  useEffect(() => {
    let cancelled = false;
    setLoadingVoices(true);
    setError(null);
    void (async () => {
      try {
        const options = await getVoices();
        if (cancelled) {
          return;
        }
        setVoices(options);
        if (options.length > 0 && !options.includes(voice)) {
          setVoice(options[0]);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load voices");
        }
      } finally {
        if (!cancelled) {
          setLoadingVoices(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [voice]);

  useEffect(() => {
    return () => {
      if (testAudioRef.current) {
        testAudioRef.current.pause();
      }
      if (testUrlRef.current) {
        URL.revokeObjectURL(testUrlRef.current);
      }
    };
  }, []);

  async function onTestVoice(): Promise<void> {
    setTestBusy(true);
    setError(null);
    try {
      const blob = await synthesizeSpeech("Hallo, ich bin Ozy.", voice, model);
      if (testAudioRef.current) {
        testAudioRef.current.pause();
      }
      if (testUrlRef.current) {
        URL.revokeObjectURL(testUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      testUrlRef.current = url;
      const audio = new Audio(url);
      testAudioRef.current = audio;
      await audio.play();
    } catch {
      setError("Voice test failed");
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <GlassCard className="space-y-3">
      <p className="text-sm font-medium text-gray-200">Speech / Voice</p>

      <label className="inline-flex items-center gap-2 text-sm text-gray-300">
        <input
          aria-label="settings-voice-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Enable voice
      </label>

      <fieldset className="space-y-2" disabled={!enabled}>
        <legend className="text-xs text-gray-400">Voice-Modus</legend>
        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
          <input
            type="radio"
            name="voice-mode"
            value="push_to_talk"
            checked={mode === "push_to_talk"}
            onChange={() => setMode("push_to_talk")}
          />
          Push-to-Talk
        </label>
        <label className="ml-4 inline-flex items-center gap-2 text-sm text-gray-300">
          <input
            type="radio"
            name="voice-mode"
            value="hands_free"
            checked={mode === "hands_free"}
            onChange={() => setMode("hands_free")}
          />
          Hands-free
        </label>
      </fieldset>

      <label className="flex flex-col gap-1 text-xs text-gray-400">
        TTS voice
        <select
          aria-label="settings-voice-select"
          className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
          value={voice}
          onChange={(event) => setVoice(event.target.value)}
          disabled={!enabled || loadingVoices}
        >
          {voices.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2" disabled={!enabled}>
        <legend className="text-xs text-gray-400">TTS-Modell</legend>
        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
          <input type="radio" name="tts-model" value="tts-1" checked={model === "tts-1"} onChange={() => setModel("tts-1")} />
          tts-1
        </label>
        <label className="ml-4 inline-flex items-center gap-2 text-sm text-gray-300">
          <input
            type="radio"
            name="tts-model"
            value="tts-1-hd"
            checked={model === "tts-1-hd"}
            onChange={() => setModel("tts-1-hd")}
          />
          tts-1-hd
        </label>
      </fieldset>

      <label className="inline-flex items-center gap-2 text-sm text-gray-300">
        <input
          aria-label="settings-voice-autoplay"
          type="checkbox"
          checked={autoplay}
          onChange={(event) => setAutoplay(event.target.checked)}
          disabled={!enabled}
        />
        Auto-play response
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void onTestVoice()}
          disabled={!enabled || testBusy || loadingVoices}
        >
          Test voice
        </button>
        <button
          type="button"
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void onSave(enabled, mode, voice, model, autoplay)}
          disabled={saving || loadingVoices}
        >
          Save voice
        </button>
        {loadingVoices ? <Spinner /> : null}
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </GlassCard>
  );
}

export default VoiceSettings;
