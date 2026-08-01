import { useEffect, useState } from "react";
import Button from "@/components/common/Button";
import SettingField from "@/components/settings/SettingField";
import SettingsCard from "@/components/settings/SettingsCard";

type CircuitBreakerSettingsProps = {
  maxActions: number | null;
  windowSeconds: number | null;
  cooldownSeconds: number | null;
  saving?: boolean;
  onSave: (
    maxActions: number | null,
    windowSeconds: number | null,
    cooldownSeconds: number | null,
  ) => Promise<void>;
};

function parseNullableInteger(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }
  return Math.round(parsed);
}

function describeSeconds(value: string): string | null {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  if (parsed < 60) {
    return `${parsed} seconds`;
  }
  const minutes = Math.round((parsed / 60) * 10) / 10;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function CircuitBreakerSettings({
  maxActions,
  windowSeconds,
  cooldownSeconds,
  saving = false,
  onSave,
}: CircuitBreakerSettingsProps): JSX.Element {
  const [max, setMax] = useState(maxActions === null ? "" : String(maxActions));
  const [windowValue, setWindowValue] = useState(windowSeconds === null ? "" : String(windowSeconds));
  const [cooldown, setCooldown] = useState(cooldownSeconds === null ? "" : String(cooldownSeconds));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMax(maxActions === null ? "" : String(maxActions));
  }, [maxActions]);

  useEffect(() => {
    setWindowValue(windowSeconds === null ? "" : String(windowSeconds));
  }, [windowSeconds]);

  useEffect(() => {
    setCooldown(cooldownSeconds === null ? "" : String(cooldownSeconds));
  }, [cooldownSeconds]);

  const handleSave = async (): Promise<void> => {
    const parsedMax = parseNullableInteger(max);
    const parsedWindow = parseNullableInteger(windowValue);
    const parsedCooldown = parseNullableInteger(cooldown);

    if (
      Number.isNaN(parsedMax)
      || Number.isNaN(parsedWindow)
      || Number.isNaN(parsedCooldown)
      || (typeof parsedMax === "number" && parsedMax < 1)
      || (typeof parsedWindow === "number" && parsedWindow < 10)
      || (typeof parsedCooldown === "number" && parsedCooldown < 10)
    ) {
      setError("Invalid values. Actions must be at least 1, and both time spans at least 10 seconds.");
      return;
    }

    setError(null);
    await onSave(parsedMax, parsedWindow, parsedCooldown);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  const windowLabel = describeSeconds(windowValue);
  const cooldownLabel = describeSeconds(cooldown);
  const summary =
    max.trim() && windowLabel && cooldownLabel
      ? `In plain words: if Ozymandias performs more than ${max.trim()} actions within ${windowLabel}, it pauses itself for ${cooldownLabel}.`
      : "Leave a field empty to use the built-in default. Fill in all three to see a plain-language summary here.";

  return (
    <SettingsCard
      title="Runaway protection"
      description="A safety net. If Ozymandias starts doing an unusual number of things in a short time, it pauses itself instead of continuing."
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
      <p className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-zinc-400">
        {summary}
      </p>

      <div className="grid gap-5 md:grid-cols-3">
        <SettingField
          label="Actions allowed"
          description="How many actions may happen before the brake kicks in."
          htmlFor="cb-max-actions"
        >
          <input
            id="cb-max-actions"
            aria-label="cb-max-actions"
            type="number"
            min={1}
            placeholder="Default"
            value={max}
            onChange={(event) => setMax(event.target.value)}
            className="w-full text-sm"
          />
        </SettingField>

        <SettingField
          label="Counted over"
          description="The time span those actions are counted in."
          hint={windowLabel ? `= ${windowLabel}` : undefined}
          htmlFor="cb-window-seconds"
        >
          <div className="flex items-center gap-2">
            <input
              id="cb-window-seconds"
              aria-label="cb-window-seconds"
              type="number"
              min={10}
              placeholder="Default"
              value={windowValue}
              onChange={(event) => setWindowValue(event.target.value)}
              className="w-full text-sm"
            />
            <span className="shrink-0 text-sm text-zinc-400">sec</span>
          </div>
        </SettingField>

        <SettingField
          label="Pause length"
          description="How long Ozymandias waits before trying again."
          hint={cooldownLabel ? `= ${cooldownLabel}` : undefined}
          htmlFor="cb-cooldown-seconds"
        >
          <div className="flex items-center gap-2">
            <input
              id="cb-cooldown-seconds"
              aria-label="cb-cooldown-seconds"
              type="number"
              min={10}
              placeholder="Default"
              value={cooldown}
              onChange={(event) => setCooldown(event.target.value)}
              className="w-full text-sm"
            />
            <span className="shrink-0 text-sm text-zinc-400">sec</span>
          </div>
        </SettingField>
      </div>
    </SettingsCard>
  );
}

export default CircuitBreakerSettings;
