import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectCard from "@/components/projects/ProjectCard";
import { mockProject } from "@/test/projects-fixtures";

describe("ProjectCard", () => {
  it("rendert Name, Status und Prioritaet", () => {
    render(<ProjectCard project={mockProject} onOpen={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("Projekt Alpha")).toBeInTheDocument();
    expect(screen.getByText("Aktiv")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("zeigt progress korrekt", () => {
    render(<ProjectCard project={mockProject} onOpen={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("1/3 Aufgaben erledigt")).toBeInTheDocument();
    expect(screen.getByLabelText("progress-project-1")).toHaveStyle({ width: "33%" });
  });

  it("zeigt Risiko-Warnung", () => {
    render(<ProjectCard project={mockProject} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("2 offene Risiken")).toBeInTheDocument();
  });

  it("klick auf karte ruft onOpen auf", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<ProjectCard project={mockProject} onOpen={onOpen} onDelete={vi.fn()} />);

    await user.click(screen.getByText("Projekt Alpha"));

    expect(onOpen).toHaveBeenCalledWith(mockProject.project_id, mockProject.name);
  });
});
