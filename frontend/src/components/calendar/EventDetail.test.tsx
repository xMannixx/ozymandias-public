import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventDetail from "@/components/calendar/EventDetail";
import type { CalendarEvent } from "@/api/types";

const event: CalendarEvent = {
  id: "e1",
  summary: "Planning",
  start: "2026-04-07T10:00:00Z",
  end: "2026-04-07T11:00:00Z",
  location: "Room A",
  description: "Sprint planning",
  attendees: ["alice@example.com"],
  html_link: "https://calendar.google.com/event?e=1",
};

describe("EventDetail", () => {
  it("zeigt alle Felder", () => {
    render(<EventDetail event={event} onClose={vi.fn()} onDelete={vi.fn(async () => undefined)} />);
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText(/Room A/)).toBeInTheDocument();
    expect(screen.getByText(/Sprint planning/)).toBeInTheDocument();
    expect(screen.getByText(/alice@example.com/)).toBeInTheDocument();
  });

  it('"In Google Calendar" Link vorhanden', () => {
    render(<EventDetail event={event} onClose={vi.fn()} onDelete={vi.fn(async () => undefined)} />);
    expect(screen.getByRole("link", { name: "In Google Calendar oeffnen" })).toHaveAttribute(
      "href",
      "https://calendar.google.com/event?e=1",
    );
  });

  it("Loeschen zeigt Bestaetigung", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onDelete = vi.fn(async () => undefined);
    render(<EventDetail event={event} onClose={vi.fn()} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
