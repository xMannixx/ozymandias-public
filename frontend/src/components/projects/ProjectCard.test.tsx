import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProjectCard from "@/components/projects/ProjectCard";
import { mockProject } from "@/test/projects-fixtures";
import type { ProjectResponse } from "@/api/types";

function renderCard(
  project: ProjectResponse = mockProject,
  onDelete: () => void = vi.fn(),
): void {
  render(
    <MemoryRouter>
      <ProjectCard project={project} onDelete={onDelete} />
    </MemoryRouter>,
  );
}

describe("ProjectCard", () => {
  it("shows the name and status", () => {
    renderCard();

    expect(screen.getByText("Tax return 2026")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("summarizes what the workspace holds", () => {
    renderCard();

    expect(screen.getByText("Holds instructions, 1 file, 2 chats.")).toBeInTheDocument();
  });

  it("shows task progress and the next deadline", () => {
    renderCard();

    expect(screen.getByText("1 of 3 tasks done")).toBeInTheDocument();
    expect(screen.getByLabelText("progress-project-1")).toHaveStyle({ width: "33%" });
    expect(screen.getByText("Next up: File the return (2026-05-31)")).toBeInTheDocument();
  });

  it("marks workspaces that never leave the machine", () => {
    renderCard({ ...mockProject, sensitivity: "S4" });

    expect(screen.getByText("Local only")).toBeInTheDocument();
  });

  it("links to the workspace page", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /Open workspace/ })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );
  });

  it("deletes on request", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderCard(mockProject, onDelete);

    await user.click(screen.getByRole("button", { name: "Delete Tax return 2026" }));

    expect(onDelete).toHaveBeenCalledWith(mockProject.project_id);
  });
});
