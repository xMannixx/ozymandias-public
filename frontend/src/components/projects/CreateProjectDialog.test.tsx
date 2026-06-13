import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateProjectDialog from "@/components/projects/CreateProjectDialog";

describe("CreateProjectDialog", () => {
  it("name ist pflichtfeld", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);

    render(
      <CreateProjectDialog open creating={false} onClose={vi.fn()} onCreate={onCreate} />,
    );

    await user.click(screen.getByText("Erstellen"));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText("Name ist Pflicht.")).toBeInTheDocument();
  });

  it("erstellen ruft createProject callback auf", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);

    render(
      <CreateProjectDialog open creating={false} onClose={vi.fn()} onCreate={onCreate} />,
    );

    await user.type(screen.getByLabelText("Name"), "Projekt Z");
    await user.click(screen.getByText("Erstellen"));

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Projekt Z" }));
  });

  it("dialog schliesst nach erfolg", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreate = vi.fn(async () => undefined);

    render(
      <CreateProjectDialog open creating={false} onClose={onClose} onCreate={onCreate} />,
    );

    await user.type(screen.getByLabelText("Name"), "Projekt Z");
    await user.click(screen.getByText("Erstellen"));

    expect(onClose).toHaveBeenCalled();
  });
});
