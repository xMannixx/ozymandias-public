import { useEffect, useState } from "react";
import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";

type DecaySettingsProps = {
  intervalHours: number;
  confidenceThreshold: number;
  saving?: boolean;
  onSave: (intervalHours: number, confidenceThreshold: number) => Promise<void>;
};

function DecaySettings({ intervalHours, confidenceThreshold, saving = false, onSave }: DecaySettingsProps): JSX.Element {
  const [interval, setInterval] = useState(String(intervalHours));
  const [threshold, setThreshold] = useState(confidenceThreshold.toFixed(2));
  const [error, setError] = useState<string | null>(null);

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
      setError("Intervall muss zwischen 1 und 720 Stunden liegen.");
      return;
    }
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1) {
      setError("Confidence muss zwischen 0.00 und 1.00 liegen.");
      return;
    }
    setError(null);
    await onSave(Math.round(parsedInterval), Number(parsedThreshold.toFixed(2)));
  };

  return (
    <GlassCard className="space-y-3">
      <p className="text-sm font-medium text-gray-200">Decay</p>

      <label className="block text-xs text-gray-300" htmlFor="decay-interval-hours">
        Intervall (Stunden)
      </label>
      <input
        id="decay-interval-hours"
        aria-label="decay-interval-hours"
        type="number"
        min={1}
        max={720}
        value={interval}
        onChange={(event) => setInterval(event.target.value)}
        className="w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
      />

      <label className="block text-xs text-gray-300" htmlFor="decay-confidence-threshold">
        Confidence Threshold ({Number(threshold || 0).toFixed(2)})
      </label>
      <input
        id="decay-confidence-threshold"
        aria-label="decay-confidence-threshold"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={threshold}
        onChange={(event) => setThreshold(event.target.value)}
        className="w-full"
      />

      {error ? <p className="text-xs text-red-300">{error}</p> : null}

      <Button disabled={saving} onClick={() => void handleSave()}>
        Speichern
      </Button>
    </GlassCard>
  );
}

export default DecaySettings;
