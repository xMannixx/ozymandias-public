import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateProjectDialog from "@/components/projects/CreateProjectDialog";

const CREATE_BUTTON = "Create workspace";

describe("CreateProjectDialog", () => {
  it("requires a name", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);

    render(<CreateProjectDialog open creating={false} onClose={vi.fn()} onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: CREATE_BUTTON }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText("Please give the workspace a name.")).toBeInTheDocument();
  });

  it("creates a workspace with instructions and privacy level", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);

    render(<CreateProjectDialog open creating={false} onClose={vi.fn()} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Name"), "Tax return");
    await user.type(screen.getByLabelText("Instructions (optional)"), "Answer in German.");
    await user.selectOptions(screen.getByLabelText("Privacy level"), "S3");
    await user.click(screen.getByRole("button", { name: CREATE_BUTTON }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Tax return",
        instructions: "Answer in German.",
        sensitivity: "S3",
      }),
    );
  });

  it("closes after a successful create", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreate = vi.fn(async () => undefined);

    render(<CreateProjectDialog open creating={false} onClose={onClose} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Name"), "Tax return");
    await user.click(screen.getByRole("button", { name: CREATE_BUTTON }));

    expect(onClose).toHaveBeenCalled();
  });
});
