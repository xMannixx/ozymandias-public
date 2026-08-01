import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateContactDialog from "@/components/contacts/CreateContactDialog";

describe("CreateContactDialog", () => {
  it("first name is required", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);

    render(<CreateContactDialog open creating={false} onClose={vi.fn()} onCreate={onCreate} />);

    await user.click(screen.getByText("Create"));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText("First name is required.")).toBeInTheDocument();
  });

  it("Create calls onCreate with tags", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);

    render(<CreateContactDialog open creating={false} onClose={vi.fn()} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("First name"), "Max");
    await user.type(screen.getByLabelText("Tags"), "A, B");
    await user.click(screen.getByText("Create"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: "Max", tags: ["A", "B"] }),
    );
  });

  it("Dialog schliesst nach Erfolg", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreate = vi.fn(async () => undefined);

    render(<CreateContactDialog open creating={false} onClose={onClose} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("First name"), "Max");
    await user.click(screen.getByText("Create"));

    expect(onClose).toHaveBeenCalled();
  });
});
