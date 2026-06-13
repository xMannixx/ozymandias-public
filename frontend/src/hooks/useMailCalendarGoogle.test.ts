import { act, renderHook, waitFor } from "@testing-library/react";
import { useCalendar } from "@/hooks/useCalendar";
import { useGoogleStatus } from "@/hooks/useGoogleStatus";
import { useMail } from "@/hooks/useMail";

const getGoogleStatusMock = vi.fn();
const listMailMock = vi.fn();
const getMailMock = vi.fn();
const sendMailMock = vi.fn();
const listEventsMock = vi.fn();
const createEventMock = vi.fn();
const deleteEventMock = vi.fn();

vi.mock("@/api/auth", () => ({
  getGoogleStatus: (...args: unknown[]) => getGoogleStatusMock(...args),
}));

vi.mock("@/api/mail", () => ({
  listMail: (...args: unknown[]) => listMailMock(...args),
  getMail: (...args: unknown[]) => getMailMock(...args),
  sendMail: (...args: unknown[]) => sendMailMock(...args),
}));

vi.mock("@/api/calendar", () => ({
  listEvents: (...args: unknown[]) => listEventsMock(...args),
  createEvent: (...args: unknown[]) => createEventMock(...args),
  deleteEvent: (...args: unknown[]) => deleteEventMock(...args),
}));

describe("mail/calendar/google hooks", () => {
  beforeEach(() => {
    getGoogleStatusMock.mockReset();
    listMailMock.mockReset();
    getMailMock.mockReset();
    sendMailMock.mockReset();
    listEventsMock.mockReset();
    createEventMock.mockReset();
    deleteEventMock.mockReset();

    getGoogleStatusMock.mockResolvedValue({
      connected: true,
      email: "owner@example.com",
      scopes: ["scope-a"],
    });
    listMailMock.mockResolvedValue([
      {
        id: "m1",
        subject: "Hello",
        sender: "alice@example.com",
        snippet: "snippet",
        date: "2026-04-05T10:00:00Z",
        is_read: true,
      },
    ]);
    getMailMock.mockResolvedValue({
      id: "m1",
      sender: "alice@example.com",
      to: ["bob@example.com"],
      subject: "Hello",
      date: "2026-04-05T10:00:00Z",
      body: "Body",
      attachments: [],
    });
    sendMailMock.mockResolvedValue({ id: "m2", thread_id: "t1" });
    listEventsMock.mockResolvedValue([
      {
        id: "e1",
        summary: "Sync",
        start: "2026-04-07T10:00:00Z",
        end: "2026-04-07T11:00:00Z",
        location: null,
        description: null,
        attendees: [],
        html_link: null,
      },
    ]);
    createEventMock.mockResolvedValue({});
    deleteEventMock.mockResolvedValue(undefined);
  });

  it("useMail laedt Mails beim Mount", async () => {
    const { result } = renderHook(() => useMail());

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });
    expect(getGoogleStatusMock).toHaveBeenCalled();
    expect(listMailMock).toHaveBeenCalled();
  });

  it("useCalendar laedt Events beim Mount", async () => {
    const { result } = renderHook(() => useCalendar());

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });
    expect(getGoogleStatusMock).toHaveBeenCalled();
    expect(listEventsMock).toHaveBeenCalled();
  });

  it("useCalendar prevWeek/nextWeek aendern Zeitraum", async () => {
    const { result } = renderHook(() => useCalendar());
    const initialStart = result.current.currentWeek.start.getTime();

    act(() => {
      result.current.prevWeek();
    });
    const prevStart = result.current.currentWeek.start.getTime();

    act(() => {
      result.current.nextWeek();
    });
    const finalStart = result.current.currentWeek.start.getTime();

    expect(prevStart).toBeLessThan(initialStart);
    expect(finalStart).toBe(initialStart);
  });

  it("useGoogleStatus laedt Status beim Mount", async () => {
    const { result } = renderHook(() => useGoogleStatus());

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });
    expect(result.current.email).toBe("owner@example.com");
  });
});
