import type { CalendarEvent as CalendarEventType } from "@/api/types";

type CalendarEventProps = {
  event: CalendarEventType;
  onClick: () => void;
};

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} - ${end}`;
  }
  return `${startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function CalendarEvent({ event, onClick }: CalendarEventProps): JSX.Element {
  return (
    <button
      type="button"
      className="w-full rounded border border-blue-600/60 bg-blue-900/30 p-2 text-left text-sm text-blue-100 hover:bg-blue-900/50"
      onClick={onClick}
    >
      <p className="truncate font-medium">{event.summary}</p>
      <p className="truncate text-xs text-blue-200">{formatTimeRange(event.start, event.end)}</p>
      {event.location ? <p className="truncate text-xs text-blue-300">{event.location}</p> : null}
    </button>
  );
}

export default CalendarEvent;
