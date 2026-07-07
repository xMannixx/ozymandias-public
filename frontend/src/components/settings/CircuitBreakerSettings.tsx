import { useEffect, useState } from "react";
import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";

type CircuitBreakerSettingsProps = {
  maxActions: number | null;
  windowSeconds: number | null;
  cooldownSeconds: number | null;
  saving?: boolean;
  onSave: (maxActions: number | null, windowSeconds: number | null, cooldownSeconds: number | null) => Promise<void>;
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
      Number.isNaN(parsedMax) ||
      Number.isNaN(parsedWindow) ||
      Number.isNaN(parsedCooldown) ||
      (typeof parsedMax === "number" && parsedMax < 1) ||
      (typeof parsedWindow === "number" && parsedWindow < 10) ||
      (typeof parsedCooldown === "number" && parsedCooldown < 10)
    ) {
      setError("Invalid values. An empty field uses the backend default.");
      return;
    }

    setError(null);
    await onSave(parsedMax, parsedWindow, parsedCooldown);
  };

  return (
    <GlassCard className="space-y-3">
      <p className="text-sm font-medium text-gray-200">Circuit Breaker</p>
      <p className="text-xs text-gray-300">Leer lassen, um die Server-Defaults zu verwenden.</p>

      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-xs text-gray-300" htmlFor="cb-max-actions">
          Max Actions
          <input
            id="cb-max-actions"
            aria-label="cb-max-actions"
            type="number"
            min={1}
            value={max}
            onChange={(event) => setMax(event.target.value)}
            className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
          />
        </label>
        <label className="text-xs text-gray-300" htmlFor="cb-window-seconds">
          Window (s)
          <input
            id="cb-window-seconds"
            aria-label="cb-window-seconds"
            type="number"
            min={10}
            value={windowValue}
            onChange={(event) => setWindowValue(event.target.value)}
            className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
          />
        </label>
        <label className="text-xs text-gray-300" htmlFor="cb-cooldown-seconds">
          Cooldown (s)
          <input
            id="cb-cooldown-seconds"
            aria-label="cb-cooldown-seconds"
            type="number"
            min={10}
            value={cooldown}
            onChange={(event) => setCooldown(event.target.value)}
            className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
          />
        </label>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}

      <Button disabled={saving} onClick={() => void handleSave()}>
        Save
      </Button>
    </GlassCard>
  );
}

export default CircuitBreakerSettings;
