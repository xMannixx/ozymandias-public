import { createEvent, listEvents } from "@/api/calendar";
import { listMail, sendMail } from "@/api/mail";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api/mail-calendar", () => {
  it("listMail sends GET /mail", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse([{ id: "m1", subject: null, sender: "a", snippet: "x", date: "2026-01-01", is_read: true }]),
    );

    await listMail();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/mail");
    expect(options?.method).toBeUndefined();
  });

  it("sendMail sends POST /mail/send", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse({ id: "m1", thread_id: "t1" }),
    );

    await sendMail({ to: "test@example.com", subject: "Hello", body: "World" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/mail/send");
    expect(options?.method).toBe("POST");
  });

  it("listEvents sends GET /calendar", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse([
        {
          id: "e1",
          summary: "Meeting",
          start: "2026-01-01T10:00:00Z",
          end: "2026-01-01T11:00:00Z",
          location: null,
          description: null,
          attendees: [],
          html_link: null,
        },
      ]),
    );

    await listEvents();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/calendar");
    expect(options?.method).toBeUndefined();
  });

  it("createEvent sends POST /calendar", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse({
        id: "e1",
        summary: "Meeting",
        start: "2026-01-01T10:00:00Z",
        end: "2026-01-01T11:00:00Z",
        location: null,
        description: null,
        attendees: [],
        html_link: null,
      }),
    );

    await createEvent({
      summary: "Meeting",
      start: "2026-01-01T10:00:00Z",
      end: "2026-01-01T11:00:00Z",
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/calendar");
    expect(options?.method).toBe("POST");
  });
});
