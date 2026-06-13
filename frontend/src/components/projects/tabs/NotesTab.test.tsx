import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotesTab from "@/components/projects/tabs/NotesTab";
import { mockProjectDetail } from "@/test/projects-fixtures";

describe("NotesTab", () => {
  it("rendert notizen", () => {
    render(
      <NotesTab
        project={mockProjectDetail}
        loading={false}
        onCreateNote={vi.fn(async () => undefined)}
        onDeleteNote={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByText("Notiz 1")).toBeInTheDocument();
  });

  it("textarea submit erstellt notiz", async () => {
    const user = userEvent.setup();
    const onCreateNote = vi.fn(async () => undefined);
    render(
      <NotesTab
        project={mockProjectDetail}
        loading={false}
        onCreateNote={onCreateNote}
        onDeleteNote={vi.fn(async () => undefined)}
      />,
    );

    await user.type(screen.getByLabelText("new-note-content"), "Neue Notiz");
    await user.click(screen.getByText("Notiz speichern"));

    expect(onCreateNote).toHaveBeenCalledWith({ content: "Neue Notiz", source: "user" });
  });
});
