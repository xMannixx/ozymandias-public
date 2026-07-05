import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TasksTab from "@/components/projects/tabs/TasksTab";
import { mockProjectDetail } from "@/test/projects-fixtures";

describe("TasksTab", () => {
  it("rendert aufgaben liste", () => {
    render(
      <TasksTab
        project={mockProjectDetail}
        loading={false}
        onCreateTask={vi.fn(async () => undefined)}
        onUpdateTask={vi.fn(async () => undefined)}
        onDeleteTask={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByText("Task offen")).toBeInTheDocument();
    expect(screen.getByText("Task erledigt")).toBeInTheDocument();
  });

  it("checkbox klick ruft updateTask status=done", async () => {
    const user = userEvent.setup();
    const onUpdateTask = vi.fn(async () => undefined);
    render(
      <TasksTab
        project={mockProjectDetail}
        loading={false}
        onCreateTask={vi.fn(async () => undefined)}
        onUpdateTask={onUpdateTask}
        onDeleteTask={vi.fn(async () => undefined)}
      />,
    );

    await user.click(screen.getByLabelText("task-done-t1"));

    expect(onUpdateTask).toHaveBeenCalledWith("t1", { status: "done" });
  });

  it("neue aufgabe erstellt task", async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn(async () => undefined);
    render(
      <TasksTab
        project={mockProjectDetail}
        loading={false}
        onCreateTask={onCreateTask}
        onUpdateTask={vi.fn(async () => undefined)}
        onDeleteTask={vi.fn(async () => undefined)}
      />,
    );

    await user.type(screen.getByLabelText("new-task-input"), "Neue Aufgabe");
    await user.click(screen.getByText("Add"));

    expect(onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Neue Aufgabe", status: "open" }),
    );
  });

  it("sortiert offen vor erledigt", () => {
    const { container } = render(
      <TasksTab
        project={mockProjectDetail}
        loading={false}
        onCreateTask={vi.fn(async () => undefined)}
        onUpdateTask={vi.fn(async () => undefined)}
        onDeleteTask={vi.fn(async () => undefined)}
      />,
    );

    const html = container.innerHTML;
    expect(html.indexOf("Task offen")).toBeLessThan(html.indexOf("Task erledigt"));
  });
});
