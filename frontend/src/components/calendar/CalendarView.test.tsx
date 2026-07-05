import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CalendarView from "@/components/calendar/CalendarView";

const hookState = {
  events: [
    {
      id: "e1",
      summary: "Team Sync",
      start: "2026-04-07T10:00:00Z",
      end: "2026-04-07T11:00:00Z",
      location: "Room A",
      description: null,
      attendees: [],
      html_link: null,
    },
  ],
  currentWeek: {
    start: new Date("2026-04-06T00:00:00Z"),
    end: new Date("2026-04-12T00:00:00Z"),
  },
  googleConnected: true,
  loading: false,
  error: null as string | null,
  toast: null as { message: string; type: "success" | "error" | "info" } | null,
  prevWeek: vi.fn(),
  nextWeek: vi.fn(),
  goToday: vi.fn(),
  createEvent: vi.fn(async () => undefined),
  deleteEvent: vi.fn(async () => undefined),
  refetch: vi.fn(async () => undefined),
  clearToast: vi.fn(),
};

vi.mock("@/hooks/useCalendar", () => ({
  useCalendar: () => hookState,
}));

describe("CalendarView", () => {
  function renderView(): void {
    render(
      <MemoryRouter>
        <CalendarView />
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    hookState.prevWeek.mockClear();
    hookState.nextWeek.mockClear();
    hookState.goToday.mockClear();
    hookState.events = [
      {
        id: "e1",
        summary: "Team Sync",
        start: "2026-04-07T10:00:00Z",
        end: "2026-04-07T11:00:00Z",
        location: "Room A",
        description: null,
        attendees: [],
        html_link: null,
      },
    ];
  });

  it("zeigt 7 Tage der aktuellen Woche", () => {
    renderView();
    expect(screen.getAllByTestId(/calendar-day-/)).toHaveLength(7);
  });

  it("Events werden im richtigen Tag angezeigt", () => {
    renderView();
    const day = screen.getByTestId("calendar-day-1");
    expect(within(day).getByText("Team Sync")).toBeInTheDocument();
  });

  it("Vor/Zurueck aendert Woche", async () => {
    renderView();
    await userEvent.click(screen.getByRole("button", { name: "Previous week" }));
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(hookState.prevWeek).toHaveBeenCalledTimes(1);
    expect(hookState.nextWeek).toHaveBeenCalledTimes(1);
  });

  it('"Heute" springt zur aktuellen Woche', async () => {
    renderView();
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(hookState.goToday).toHaveBeenCalledTimes(1);
  });

  it("Leerer Tag zeigt nichts", () => {
    hookState.events = [];
    renderView();
    expect(screen.queryByText("Team Sync")).not.toBeInTheDocument();
  });
});
