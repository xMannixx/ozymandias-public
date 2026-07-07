import { useCallback, useEffect, useMemo, useState } from "react";
import { getGoogleStatus } from "@/api/auth";
import { ApiError } from "@/api/client";
import { createEvent, deleteEvent, listEvents } from "@/api/calendar";
import type { CalendarEvent, CreateEventRequest } from "@/api/types";

type WeekRange = {
  start: Date;
  end: Date;
};

type CalendarToast = {
  message: string;
  type: "success" | "error" | "info";
};

type UseCalendarResult = {
  events: CalendarEvent[];
  currentWeek: WeekRange;
  googleConnected: boolean;
  loading: boolean;
  error: string | null;
  toast: CalendarToast | null;
  prevWeek: () => void;
  nextWeek: () => void;
  goToday: () => void;
  createEvent: (data: CreateEventRequest) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
  clearToast: () => void;
};

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load calendar";
}

function startOfWeek(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function weekFromDate(date: Date): WeekRange {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  return { start, end };
}

export function useCalendar(): UseCalendarResult {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => startOfWeek(new Date()));
  const [googleConnected, setGoogleConnected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<CalendarToast | null>(null);

  const currentWeek = useMemo(
    () => ({
      start: new Date(weekAnchor),
      end: addDays(weekAnchor, 6),
    }),
    [weekAnchor],
  );

  const ensureGoogleConnected = useCallback(async () => {
    const status = await getGoogleStatus();
    setGoogleConnected(status.connected);
    if (!status.connected) {
      setEvents([]);
      setError(null);
      return false;
    }
    return true;
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const connected = await ensureGoogleConnected();
      if (!connected) {
        return;
      }
      const response = await listEvents({
        time_min: currentWeek.start.toISOString(),
        time_max: addDays(currentWeek.end, 1).toISOString(),
        max_results: 200,
      });
      setEvents(response);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [currentWeek.end, currentWeek.start, ensureGoogleConnected]);

  const prevWeek = useCallback(() => {
    setWeekAnchor((prev) => addDays(prev, -7));
  }, []);

  const nextWeek = useCallback(() => {
    setWeekAnchor((prev) => addDays(prev, 7));
  }, []);

  const goToday = useCallback(() => {
    setWeekAnchor(startOfWeek(new Date()));
  }, []);

  const createCalendarEvent = useCallback(
    async (data: CreateEventRequest) => {
      setLoading(true);
      setError(null);
      try {
        const connected = await ensureGoogleConnected();
        if (!connected) {
          return;
        }
        await createEvent(data);
        setToast({ type: "success", message: "Event created." });
        await refetch();
      } catch (err) {
        const message = normalizeError(err);
        setError(message);
        setToast({ type: "error", message });
      } finally {
        setLoading(false);
      }
    },
    [ensureGoogleConnected, refetch],
  );

  const deleteCalendarEvent = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const connected = await ensureGoogleConnected();
        if (!connected) {
          return;
        }
        await deleteEvent(id);
        setToast({ type: "success", message: "Event deleted." });
        await refetch();
      } catch (err) {
        const message = normalizeError(err);
        setError(message);
        setToast({ type: "error", message });
      } finally {
        setLoading(false);
      }
    },
    [ensureGoogleConnected, refetch],
  );

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    events,
    currentWeek,
    googleConnected,
    loading,
    error,
    toast,
    prevWeek,
    nextWeek,
    goToday,
    createEvent: createCalendarEvent,
    deleteEvent: deleteCalendarEvent,
    refetch,
    clearToast,
  };
}

export { weekFromDate };
