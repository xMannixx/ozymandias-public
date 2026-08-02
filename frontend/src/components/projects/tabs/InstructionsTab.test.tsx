import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstructionsTab from "@/components/projects/tabs/InstructionsTab";
import { mockProjectDetail } from "@/test/projects-fixtures";

describe("InstructionsTab", () => {
  it("shows the stored instructions", () => {
    render(
      <InstructionsTab
        project={mockProjectDetail}
        loading={false}
        onUpdateProject={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByLabelText("Instructions for this workspace")).toHaveValue(
      "Always answer in German and cite the paragraph.",
    );
  });

  it("promises local-only processing for sensitive workspaces", async () => {
    const user = userEvent.setup();
    render(
      <InstructionsTab
        project={mockProjectDetail}
        loading={false}
        onUpdateProject={vi.fn(async () => undefined)}
      />,
    );

    expect(
      screen.getByText(/Chats in this workspace may use cloud providers/),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Privacy level"), "S3");

    expect(screen.getByText(/run on local models only/)).toBeInTheDocument();
  });

  it("saves instructions and privacy level together", async () => {
    const user = userEvent.setup();
    const onUpdateProject = vi.fn(async () => undefined);
    render(
      <InstructionsTab
        project={mockProjectDetail}
        loading={false}
        onUpdateProject={onUpdateProject}
      />,
    );

    const instructions = screen.getByLabelText("Instructions for this workspace");
    await user.clear(instructions);
    await user.type(instructions, "Be brief.");
    await user.selectOptions(screen.getByLabelText("Privacy level"), "S4");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onUpdateProject).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: "Be brief.", sensitivity: "S4" }),
    );
  });

  it("drops emptied instructions instead of saving blanks", async () => {
    const user = userEvent.setup();
    const onUpdateProject = vi.fn(async () => undefined);
    render(
      <InstructionsTab
        project={mockProjectDetail}
        loading={false}
        onUpdateProject={onUpdateProject}
      />,
    );

    await user.clear(screen.getByLabelText("Instructions for this workspace"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onUpdateProject).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: undefined }),
    );
  });
});
