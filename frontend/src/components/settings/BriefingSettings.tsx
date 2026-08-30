import { useEffect, useState } from "react";
import Button from "@/components/common/Button";
import SettingField from "@/components/settings/SettingField";
import SettingsCard from "@/components/settings/SettingsCard";

type BriefingSettingsProps = {
  enabled: boolean;
  /** Hour of day in UTC, which is what the scheduler runs on. */
  hour: number;
  saving?: boolean;
  onSave: (enabled: boolean, hour: number) => Promise<void>;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00 UTC`;
}

/** Your local time, so nobody has to do UTC arithmetic in their head. */
function describeLocalTime(hour: number): string {
  const utc = new Date();
  utc.setUTCHours(hour, 0, 0, 0);
  const local = utc.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `That is ${local} where you are.`;
}

function BriefingSettings({
  enabled,
  hour,
  saving = false,
  onSave,
}: BriefingSettingsProps): JSX.Element {
  const [briefingEnabled, setBriefingEnabled] = useState(enabled);
  const [briefingHour, setBriefingHour] = useState(hour);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBriefingEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    setBriefingHour(hour);
  }, [hour]);

  const handleSave = async (): Promise<void> => {
    await onSave(briefingEnabled, briefingHour);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  return (
    <SettingsCard
      title="Morning briefing"
      description="Once a day Ozymandias collects your calendar, unread mail, waiting proposals, memories due for review and overdue tasks into one short summary on the dashboard."
      footer={
        <>
          <Button disabled={saving} onClick={() => void handleSave()}>
            Save changes
          </Button>
          {saved ? (
            <span className="text-xs text-emerald-300" role="status" aria-live="polite">
              Saved.
            </span>
          ) : null}
        </>
      }
    >
      <label className="flex items-start gap-2 text-sm text-zinc-200">
        <input
          aria-label="settings-briefing-enabled"
          type="checkbox"
          checked={briefingEnabled}
          className="mt-0.5 h-3.5 w-3.5 accent-indigo-500"
          onChange={(event) => setBriefingEnabled(event.target.checked)}
        />
        <span>
          Write a daily briefing
          <span className="mt-0.5 block text-xs text-zinc-400">
            Nothing is sent anywhere. The briefing appears on the dashboard and stays there until
            the next one.
          </span>
        </span>
      </label>

      <SettingField
        label="When to write it"
        description="Pick a time shortly before you start your day, so the briefing is waiting rather than being written while you read it."
        hint={describeLocalTime(briefingHour)}
        htmlFor="briefing-hour"
      >
        <select
          id="briefing-hour"
          aria-label="settings-briefing-hour"
          className="w-full text-sm"
          disabled={!briefingEnabled}
          value={briefingHour}
          onChange={(event) => setBriefingHour(Number(event.target.value))}
        >
          {HOURS.map((value) => (
            <option key={value} value={value}>
              {formatHour(value)}
            </option>
          ))}
        </select>
      </SettingField>
    </SettingsCard>
  );
}

export default BriefingSettings;
