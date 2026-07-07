import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";
import type { CalendarEvent } from "@/api/types";

type EventDetailProps = {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function EventDetail({ event, onClose, onDelete }: EventDetailProps): JSX.Element {
  async function handleDelete(): Promise<void> {
    if (!window.confirm("Delete this event?")) {
      return;
    }
    await onDelete(event.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <GlassCard className="w-full max-w-lg space-y-3">
        <h3 className="text-lg font-semibold text-gray-100">{event.summary}</h3>
        <div className="space-y-1 text-sm text-gray-300">
          <p>
            <span className="text-gray-400">Start:</span> {formatDate(event.start)}
          </p>
          <p>
            <span className="text-gray-400">Ende:</span> {formatDate(event.end)}
          </p>
          <p>
            <span className="text-gray-400">Location:</span> {event.location ?? "-"}
          </p>
          <p>
            <span className="text-gray-400">Description:</span> {event.description ?? "-"}
          </p>
          <p>
            <span className="text-gray-400">Teilnehmer:</span>{" "}
            {event.attendees.length > 0 ? event.attendees.join(", ") : "-"}
          </p>
        </div>

        {event.html_link ? (
          <a
            href={event.html_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-sm text-blue-300 underline underline-offset-2 hover:text-blue-200"
          >
            In Google Calendar oeffnen
          </a>
        ) : null}

        <div className="flex gap-2">
          <Button type="button" variant="danger" onClick={() => void handleDelete()}>
            Delete
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Schliessen
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

export default EventDetail;
