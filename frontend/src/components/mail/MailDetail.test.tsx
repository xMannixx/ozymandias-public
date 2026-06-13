import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MailDetail from "@/components/mail/MailDetail";
import type { MailDetail as MailDetailType } from "@/api/types";

const detail: MailDetailType = {
  id: "m1",
  sender: "alice@example.com",
  to: ["bob@example.com"],
  subject: "Hallo",
  date: "2026-04-05T10:00:00Z",
  body: "<b>Test Body</b>",
  attachments: [{ name: "file.txt", size: 128 }],
};

describe("MailDetail", () => {
  it("zeigt alle Felder", () => {
    render(<MailDetail message={detail} onReply={vi.fn()} />);
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("Hallo")).toBeInTheDocument();
    expect(screen.getByLabelText("mail-html-body")).toBeInTheDocument();
  });

  it("zeigt Attachments", () => {
    render(<MailDetail message={detail} onReply={vi.fn()} />);
    expect(screen.getByText("file.txt (128 bytes)")).toBeInTheDocument();
  });

  it("Antworten Button oeffnet Compose", async () => {
    const onReply = vi.fn();
    render(<MailDetail message={detail} onReply={onReply} />);
    await userEvent.click(screen.getByRole("button", { name: "Antworten" }));
    expect(onReply).toHaveBeenCalledTimes(1);
  });
});
