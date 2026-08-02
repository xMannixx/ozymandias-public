import { useEffect, useState } from "react";
import Button from "@/components/common/Button";
import SettingField from "@/components/settings/SettingField";
import SettingsCard from "@/components/settings/SettingsCard";

type DecaySettingsProps = {
  intervalHours: number;
  confidenceThreshold: number;
  saving?: boolean;
  onSave: (intervalHours: number, confidenceThreshold: number) => Promise<void>;
};

function describeInterval(hours: number): string {
  if (!Number.isFinite(hours) || hours < 1) {
    return "Not a valid interval yet.";
  }
  if (hours < 24) {
    return `Currently: every ${hours} ${hours === 1 ? "hour" : "hours"}.`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  if (days === 1) {
    return "Currently: once a day.";
  }
  if (days === 7) {
    return "Currently: once a week.";
  }
  return `Currently: every ${days} days.`;
}

function describeThreshold(threshold: number): string {
  if (threshold <= 0.25) {
    return "Very forgiving — almost nothing gets flagged for review. Your memory stays large but may keep stale facts.";
  }
  if (threshold <= 0.45) {
    return "Forgiving — only clearly doubtful memories get flagged.";
  }
  if (threshold <= 0.65) {
    return "Balanced — a good default for most people.";
  }
  if (threshold <= 0.85) {
    return "Strict — Ozymandias re-checks often, so you will see more review requests.";
  }
  return "Very strict — nearly every memory gets flagged eventually. Expect a lot of review work.";
}

function DecaySettings({
  intervalHours,
  confidenceThreshold,
  saving = false,
  onSave,
}: DecaySettingsProps): JSX.Element {
  const [interval, setInterval] = useState(String(intervalHours));
  const [threshold, setThreshold] = useState(confidenceThreshold.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setInterval(String(intervalHours));
  }, [intervalHours]);

  useEffect(() => {
    setThreshold(confidenceThreshold.toFixed(2));
  }, [confidenceThreshold]);

  const handleSave = async (): Promise<void> => {
    const parsedInterval = Number(interval);
    const parsedThreshold = Number(threshold);
    if (!Number.isFinite(parsedInterval) || parsedInterval < 1 || parsedInterval > 720) {
      setError("Interval must be between 1 and 720 hours.");
      return;
    }
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1) {
      setError("Confidence must be between 0.00 and 1.00.");
      return;
    }
    setError(null);
    await onSave(Math.round(parsedInterval), Number(parsedThreshold.toFixed(2)));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  const thresholdValue = Number(threshold || 0);
  const thresholdPercent = Math.round(thresholdValue * 100);

  return (
    <SettingsCard
      title="Memory review"
      description="Older memories can go out of date. Ozymandias re-checks them on a schedule and asks you to confirm the ones it is no longer sure about."
      footer={
        <>
          <Button disabled={saving} onClick={() => void handleSave()}>
            Save changes
          </Button>
          {error ? (
            <span className="text-xs text-rose-300" role="alert">
              {error}
            </span>
          ) : null}
          {saved && !error ? (
            <span className="text-xs text-emerald-300" role="status" aria-live="polite">
              Saved.
            </span>
          ) : null}
        </>
      }
    >
      <SettingField
        label="How often to re-check memories"
        description="Ozymandias runs this check in the background. A longer interval means less review work but slower cleanup of outdated facts."
        hint={describeInterval(Number(interval))}
        htmlFor="decay-interval-hours"
      >
        <div className="flex items-center gap-2">
          <input
            id="decay-interval-hours"
            aria-label="decay-interval-hours"
            type="number"
            min={1}
            max={720}
            value={interval}
            onChange={(event) => setInterval(event.target.value)}
            className="w-28 text-sm"
          />
          <span className="text-sm text-zinc-400">hours</span>
        </div>
      </SettingField>

      <SettingField
        label="How sure Ozymandias must be to keep a memory quietly"
        description="Every memory carries a confidence score. If it drops below this line, the memory is flagged so you can confirm or discard it."
        hint={describeThreshold(thresholdValue)}
        htmlFor="decay-confidence-threshold"
      >
        <div className="space-y-1.5">
          <input
            id="decay-confidence-threshold"
            aria-label="decay-confidence-threshold"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-[11px] text-zinc-500">
            <span>Forgiving</span>
            <span className="font-medium text-zinc-300">{thresholdPercent}%</span>
            <span>Strict</span>
          </div>
        </div>
      </SettingField>
    </SettingsCard>
  );
}

export default DecaySettings;
