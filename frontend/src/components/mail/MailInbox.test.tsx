import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import MailInbox from "@/components/mail/MailInbox";

const hookState = {
  messages: [
    {
      id: "m1",
      subject: "Subject 1",
      sender: "alice@example.com",
      snippet: "Snippet 1",
      date: "2026-04-05T10:00:00Z",
      is_read: false,
    },
    {
      id: "m2",
      subject: "Subject 2",
      sender: "bob@example.com",
      snippet: "Snippet 2",
      date: "2026-04-05T09:00:00Z",
      is_read: true,
    },
  ],
  selectedMessage: null,
  googleConnected: true,
  loading: false,
  error: null as string | null,
  query: "",
  toast: null as { message: string; type: "success" | "error" | "info" } | null,
  search: vi.fn(async () => undefined),
  selectMessage: vi.fn(async () => undefined),
  sendMail: vi.fn(async () => undefined),
  refetch: vi.fn(async () => undefined),
  clearToast: vi.fn(),
};

vi.mock("@/hooks/useMail", () => ({
  useMail: () => hookState,
}));

describe("MailInbox", () => {
  beforeEach(() => {
    hookState.search.mockClear();
    hookState.selectMessage.mockClear();
    hookState.messages = [
      {
        id: "m1",
        subject: "Subject 1",
        sender: "alice@example.com",
        snippet: "Snippet 1",
        date: "2026-04-05T10:00:00Z",
        is_read: false,
      },
      {
        id: "m2",
        subject: "Subject 2",
        sender: "bob@example.com",
        snippet: "Snippet 2",
        date: "2026-04-05T09:00:00Z",
        is_read: true,
      },
    ];
  });

  function renderInbox(): void {
    render(
      <MemoryRouter>
        <MailInbox />
      </MemoryRouter>,
    );
  }

  it("rendert Liste von Mails", () => {
    renderInbox();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("Suchfeld filtert (query Parameter)", async () => {
    renderInbox();
    await userEvent.type(screen.getByLabelText("mail-search"), "alice");
    await userEvent.click(screen.getByRole("button", { name: "Suchen" }));
    expect(hookState.search).toHaveBeenCalledWith("alice");
  });

  it("Ungelesene Mails haben Badge", () => {
    renderInbox();
    expect(screen.getByText("Neu")).toBeInTheDocument();
  });

  it("Klick auf Mail laedt Detail", async () => {
    renderInbox();
    await userEvent.click(screen.getByRole("button", { name: /alice@example.com/i }));
    expect(hookState.selectMessage).toHaveBeenCalledWith("m1");
  });

  it('Leere Liste zeigt "Keine Mails"', () => {
    hookState.messages = [];
    renderInbox();
    expect(screen.getByText("Keine Mails")).toBeInTheDocument();
  });
});
