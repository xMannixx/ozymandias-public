import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventCreate from "@/components/calendar/EventCreate";

describe("EventCreate", () => {
  it("Create calls createEvent API", async () => {
    const onCreate = vi.fn(async (_payload: Record<string, unknown>) => undefined);
    render(<EventCreate onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText("event-create-summary"), "Sync");
    await userEvent.type(screen.getByLabelText("event-create-start"), "2026-04-07T10:00");
    await userEvent.type(screen.getByLabelText("event-create-end"), "2026-04-07T11:00");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      summary: "Sync",
      start: new Date("2026-04-07T10:00").toISOString(),
      end: new Date("2026-04-07T11:00").toISOString(),
    });
  });

  it("title is required", () => {
    render(<EventCreate onCreate={vi.fn(async () => undefined)} />);
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("optionalen Ort und Beschreibung im Payload", async () => {
    const onCreate = vi.fn(async (_payload: Record<string, unknown>) => undefined);
    render(<EventCreate onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText("event-create-summary"), "Termin");
    await userEvent.type(screen.getByLabelText("event-create-start"), "2026-04-07T10:00");
    await userEvent.type(screen.getByLabelText("event-create-end"), "2026-04-07T11:00");
    await userEvent.type(screen.getByLabelText("event-create-description"), "Beschreibung");
    await userEvent.type(screen.getByLabelText("event-create-location"), "Wien");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate.mock.calls[0][0]).toMatchObject({
      description: "Beschreibung",
      location: "Wien",
    });
  });
});
