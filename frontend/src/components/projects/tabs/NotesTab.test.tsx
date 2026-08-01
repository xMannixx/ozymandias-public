import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotesTab from "@/components/projects/tabs/NotesTab";
import { mockProjectDetail } from "@/test/projects-fixtures";

describe("NotesTab", () => {
  it("shows notes with where they came from", () => {
    render(
      <NotesTab
        project={mockProjectDetail}
        loading={false}
        onCreateNote={vi.fn(async () => undefined)}
        onDeleteNote={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText("The deadline moved to the end of May.")).toBeInTheDocument();
    expect(screen.getByText(/Written by you/)).toBeInTheDocument();
  });

  it("adds a note", async () => {
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

    await user.type(screen.getByLabelText("new-note-content"), "Deadline is end of May");
    await user.click(screen.getByRole("button", { name: "Add note" }));

    expect(onCreateNote).toHaveBeenCalledWith({
      content: "Deadline is end of May",
      source: "user",
    });
  });

  it("deletes a note", async () => {
    const user = userEvent.setup();
    const onDeleteNote = vi.fn(async () => undefined);
    render(
      <NotesTab
        project={mockProjectDetail}
        loading={false}
        onCreateNote={vi.fn(async () => undefined)}
        onDeleteNote={onDeleteNote}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete note" }));

    expect(onDeleteNote).toHaveBeenCalledWith("n1");
  });
});
