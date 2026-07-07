import { useMemo, useState } from "react";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import Toast from "@/components/common/Toast";
import CalendarEvent from "@/components/calendar/CalendarEvent";
import EventCreate from "@/components/calendar/EventCreate";
import EventDetail from "@/components/calendar/EventDetail";
import GoogleNotConnected from "@/components/mail/GoogleNotConnected";
import { useCalendar } from "@/hooks/useCalendar";
import type { CalendarEvent as CalendarEventType } from "@/api/types";

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function isSameDay(value: string, day: Date): boolean {
  const date = new Date(value);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

function CalendarView(): JSX.Element {
  const { events, currentWeek, googleConnected, loading, error, toast, prevWeek, nextWeek, goToday, createEvent, deleteEvent, clearToast } =
    useCalendar();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(currentWeek.start, index);
        return {
          key: date.toISOString(),
          date,
          events: events.filter((event) => isSameDay(event.start, date)),
        };
      }),
    [currentWeek.start, events],
  );

  if (!googleConnected) {
    return <GoogleNotConnected />;
  }

  return (
    <section className="space-y-4">
      <div className="glass-card flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={prevWeek}>
            Previous week
          </Button>
          <Button type="button" variant="ghost" onClick={nextWeek}>
            Next week
          </Button>
          <Button type="button" variant="ghost" onClick={goToday}>
            Today
          </Button>
        </div>
        <Button type="button" onClick={() => setCreateOpen((prev) => !prev)}>
          {createOpen ? "Close event form" : "New event"}
        </Button>
      </div>

      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} timeoutMs={3200} />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading && events.length === 0 ? (
        <div className="glass-card flex justify-center p-6">
          <Spinner />
        </div>
      ) : null}

      {createOpen ? (
        <EventCreate
          creating={loading}
          onCreate={async (payload) => {
            await createEvent(payload);
            setCreateOpen(false);
          }}
          onCancel={() => setCreateOpen(false)}
        />
      ) : null}

      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day, index) => (
          <div key={day.key} data-testid={`calendar-day-${index}`} className="glass-card min-h-44 space-y-2 p-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">
              {day.date.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </p>
            <div className="space-y-2">
              {day.events.map((event) => (
                <CalendarEvent key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedEvent ? (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={async (id) => {
            await deleteEvent(id);
          }}
        />
      ) : null}
    </section>
  );
}

export default CalendarView;
