import { useState, type FormEvent } from "react";
import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";

type EventCreateProps = {
  onCreate: (payload: {
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
  }) => Promise<void>;
  onCancel?: () => void;
  creating?: boolean;
};

type EventFormState = {
  summary: string;
  start: string;
  end: string;
  description: string;
  location: string;
};

function toIsoString(value: string): string {
  return new Date(value).toISOString();
}

function EventCreate({ onCreate, onCancel, creating = false }: EventCreateProps): JSX.Element {
  const [form, setForm] = useState<EventFormState>({
    summary: "",
    start: "",
    end: "",
    description: "",
    location: "",
  });

  const canSubmit = Boolean(form.summary.trim() && form.start && form.end && !creating);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await onCreate({
      summary: form.summary.trim(),
      start: toIsoString(form.start),
      end: toIsoString(form.end),
      description: form.description.trim() || undefined,
      location: form.location.trim() || undefined,
    });
    setForm((prev) => ({ ...prev, summary: "", description: "", location: "" }));
  }

  return (
    <GlassCard className="space-y-3">
      <h3 className="text-base font-semibold text-gray-100">New event</h3>
      <form className="space-y-2" onSubmit={(event) => void handleSubmit(event)}>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Title
          <input
            aria-label="event-create-summary"
            className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            value={form.summary}
            onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
          />
        </label>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Start
            <input
              aria-label="event-create-start"
              type="datetime-local"
              className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
              value={form.start}
              onChange={(event) => setForm((prev) => ({ ...prev, start: event.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            Ende
            <input
              aria-label="event-create-end"
              type="datetime-local"
              className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
              value={form.end}
              onChange={(event) => setForm((prev) => ({ ...prev, end: event.target.value }))}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Description
          <textarea
            aria-label="event-create-description"
            className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          Location
          <input
            aria-label="event-create-location"
            className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            value={form.location}
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit}>
            Create
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </GlassCard>
  );
}

export default EventCreate;
