import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MailCompose from "@/components/mail/MailCompose";

describe("MailCompose", () => {
  it("Senden ruft sendMail API auf", async () => {
    const onSend = vi.fn(async () => undefined);
    render(<MailCompose onSend={onSend} />);

    await userEvent.type(screen.getByLabelText("mail-compose-to"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("mail-compose-subject"), "Test");
    await userEvent.type(screen.getByLabelText("mail-compose-body"), "Hallo");
    await userEvent.click(screen.getByRole("button", { name: "Senden" }));

    expect(onSend).toHaveBeenCalledWith("alice@example.com", "Test", "Hallo");
  });

  it("Leere Felder: Button disabled", () => {
    render(<MailCompose onSend={vi.fn(async () => undefined)} />);
    expect(screen.getByRole("button", { name: "Senden" })).toBeDisabled();
  });

  it("setzt initiale Felder fuer Antworten", () => {
    render(
      <MailCompose
        initialTo="reply@example.com"
        initialSubject="Re: Thema"
        onSend={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByLabelText("mail-compose-to")).toHaveValue("reply@example.com");
    expect(screen.getByLabelText("mail-compose-subject")).toHaveValue("Re: Thema");
  });
});
