import { request } from "@/api/client";
import type { CalendarEvent, CreateEventRequest } from "@/api/types";

type ListEventsParams = {
  time_min?: string;
  time_max?: string;
  max_results?: number;
};

function buildQuery(params: ListEventsParams | undefined): string {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams();
  if (params.time_min) {
    searchParams.set("time_min", params.time_min);
  }
  if (params.time_max) {
    searchParams.set("time_max", params.time_max);
  }
  if (typeof params.max_results === "number") {
    searchParams.set("max_results", String(params.max_results));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function listEvents(params?: ListEventsParams): Promise<CalendarEvent[]> {
  return request<CalendarEvent[]>(`/calendar${buildQuery(params)}`);
}

export function getEvent(id: string): Promise<CalendarEvent> {
  return request<CalendarEvent>(`/calendar/${id}`);
}

export function createEvent(data: CreateEventRequest): Promise<CalendarEvent> {
  return request<CalendarEvent>("/calendar", {
    method: "POST",
    body: data,
  });
}

export function deleteEvent(id: string): Promise<void> {
  return request<void>(`/calendar/${id}`, {
    method: "DELETE",
  });
}
