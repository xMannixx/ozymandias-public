import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { getVoices, synthesizeSpeech } from "@/api/voice";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import SettingField from "@/components/settings/SettingField";
import SettingsCard from "@/components/settings/SettingsCard";
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
  const [saved, setSaved] = useState(false);
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
      const blob = await synthesizeSpeech("Hi, I am Ozy. This is how I sound.", voice, model);
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

  async function handleSave(): Promise<void> {
    await onSave(enabled, mode, voice, model, autoplay);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  }

  return (
    <SettingsCard
      title="Voice"
      description="Speak to Ozymandias instead of typing, and have its replies read out loud."
      footer={
        <>
          <Button onClick={() => void handleSave()} disabled={saving || loadingVoices}>
            Save changes
          </Button>
          <Button
            variant="ghost"
            onClick={() => void onTestVoice()}
            disabled={!enabled || testBusy || loadingVoices}
          >
            <span className="inline-flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Test voice
            </span>
          </Button>
          {loadingVoices ? <Spinner /> : null}
          {saved ? (
            <span className="text-xs text-emerald-300" role="status" aria-live="polite">
              Saved.
            </span>
          ) : null}
          {error ? (
            <span className="text-xs text-rose-300" role="alert">
              {error}
            </span>
          ) : null}
        </>
      }
    >
      <label className="flex items-start gap-2 text-sm text-zinc-200">
        <input
          aria-label="settings-voice-enabled"
          type="checkbox"
          checked={enabled}
          className="mt-0.5 h-3.5 w-3.5 accent-indigo-500"
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span>
          Turn voice on
          <span className="mt-0.5 block text-xs text-zinc-400">
            Adds a microphone button to the chat. Everything below only applies while this is on.
          </span>
        </span>
      </label>

      <fieldset className="space-y-2 disabled:opacity-50" disabled={!enabled}>
        <legend className="text-sm font-medium text-zinc-200">How to start recording</legend>
        <label className="flex items-start gap-2 text-sm text-zinc-200">
          <input
            type="radio"
            name="voice-mode"
            value="push_to_talk"
            checked={mode === "push_to_talk"}
            onChange={() => setMode("push_to_talk")}
            className="mt-0.5 accent-indigo-500"
          />
          <span>
            Push-to-Talk
            <span className="mt-0.5 block text-xs text-zinc-400">
              Hold the spacebar or the microphone button while you speak, release to send.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-zinc-200">
          <input
            type="radio"
            name="voice-mode"
            value="hands_free"
            checked={mode === "hands_free"}
            onChange={() => setMode("hands_free")}
            className="mt-0.5 accent-indigo-500"
          />
          <span>
            Hands-free
            <span className="mt-0.5 block text-xs text-zinc-400">
              Ozymandias listens continuously and sends when you stop speaking. Convenient, but the microphone
              stays active.
            </span>
          </span>
        </label>
      </fieldset>

      <SettingField
        label="Reply voice"
        description="The voice used when Ozymandias reads answers out loud. Use Test voice below to hear it."
      >
        <select
          aria-label="settings-voice-select"
          className="w-full text-sm"
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
      </SettingField>

      <fieldset className="space-y-2 disabled:opacity-50" disabled={!enabled}>
        <legend className="text-sm font-medium text-zinc-200">Audio quality</legend>
        <label className="flex items-start gap-2 text-sm text-zinc-200">
          <input
            type="radio"
            name="tts-model"
            value="tts-1"
            checked={model === "tts-1"}
            onChange={() => setModel("tts-1")}
            className="mt-0.5 accent-indigo-500"
          />
          <span>
            Standard
            <span className="mt-0.5 block text-xs text-zinc-400">
              Faster and cheaper. Good enough for everyday use. (tts-1)
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-zinc-200">
          <input
            type="radio"
            name="tts-model"
            value="tts-1-hd"
            checked={model === "tts-1-hd"}
            onChange={() => setModel("tts-1-hd")}
            className="mt-0.5 accent-indigo-500"
          />
          <span>
            Higher quality
            <span className="mt-0.5 block text-xs text-zinc-400">
              Clearer and more natural, but slower to generate and more expensive. (tts-1-hd)
            </span>
          </span>
        </label>
      </fieldset>

      <label className="flex items-start gap-2 text-sm text-zinc-200">
        <input
          aria-label="settings-voice-autoplay"
          type="checkbox"
          checked={autoplay}
          onChange={(event) => setAutoplay(event.target.checked)}
          disabled={!enabled}
          className="mt-0.5 h-3.5 w-3.5 accent-indigo-500"
        />
        <span>
          Read replies out loud automatically
          <span className="mt-0.5 block text-xs text-zinc-400">
            When off, replies stay silent until you press play on a message.
          </span>
        </span>
      </label>
    </SettingsCard>
  );
}

export default VoiceSettings;
