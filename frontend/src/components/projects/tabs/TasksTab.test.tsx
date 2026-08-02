import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TasksTab from "@/components/projects/tabs/TasksTab";
import { mockProjectDetail } from "@/test/projects-fixtures";

function renderTasks(
  overrides: Partial<ComponentProps<typeof TasksTab>> = {},
): { container: HTMLElement } {
  const props: ComponentProps<typeof TasksTab> = {
    project: mockProjectDetail,
    loading: false,
    onCreateTask: vi.fn(async () => undefined),
    onUpdateTask: vi.fn(async () => undefined),
    onDeleteTask: vi.fn(async () => undefined),
    ...overrides,
  };
  return render(<TasksTab {...props} />);
}

describe("TasksTab", () => {
  it("lists the tasks", () => {
    renderTasks();

    expect(screen.getByText("Collect receipts")).toBeInTheDocument();
    expect(screen.getByText("Open an account")).toBeInTheDocument();
  });

  it("completes a task from the checkbox", async () => {
    const user = userEvent.setup();
    const onUpdateTask = vi.fn(async () => undefined);
    renderTasks({ onUpdateTask });

    await user.click(screen.getByLabelText("Mark Collect receipts as done"));

    expect(onUpdateTask).toHaveBeenCalledWith("t1", { status: "done" });
  });

  it("creates a task with a deadline", async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn(async () => undefined);
    renderTasks({ onCreateTask });

    await user.type(screen.getByLabelText("new-task-input"), "File the return");
    await user.type(screen.getByLabelText("new-task-due-date"), "2026-05-31");
    await user.click(screen.getByRole("button", { name: "Add task" }));

    expect(onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "File the return",
        status: "open",
        due_date: "2026-05-31",
      }),
    );
  });

  it("sorts open work before finished work", () => {
    const { container } = renderTasks();

    const html = container.innerHTML;
    expect(html.indexOf("Collect receipts")).toBeLessThan(html.indexOf("Open an account"));
  });

  it("flags overdue tasks", () => {
    renderTasks({
      project: {
        ...mockProjectDetail,
        tasks: [{ ...mockProjectDetail.tasks[0], due_date: "2020-01-02" }],
      },
    });

    expect(screen.getByText("Overdue since 02/01/2020")).toBeInTheDocument();
  });
});
