import { FormEvent, useMemo, useState } from "react";
import Button from "@/components/common/Button";
import type { ProjectDetailResponse, ProjectPriority, TaskStatus } from "@/api/types";

type TasksTabProps = {
  project: ProjectDetailResponse;
  loading: boolean;
  onCreateTask: (data: {
    name: string;
    description?: string;
    status?: TaskStatus;
    priority?: ProjectPriority;
    due_date?: string;
    sort_order?: number;
  }) => Promise<void>;
  onUpdateTask: (
    taskId: string,
    data: {
      status?: TaskStatus;
      priority?: ProjectPriority;
      name?: string;
      description?: string;
      due_date?: string;
    },
  ) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
};

const taskStatusOrder: Record<TaskStatus, number> = {
  open: 0,
  in_progress: 1,
  done: 2,
};

const priorityOptions: Array<{ value: ProjectPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

function describeDueDate(dueDate: string): { label: string; className: string } {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const formatted = due.toLocaleDateString("en-GB");
  if (days < 0) {
    return { label: `Overdue since ${formatted}`, className: "text-red-300" };
  }
  if (days === 0) {
    return { label: "Due today", className: "text-amber-200" };
  }
  if (days === 1) {
    return { label: "Due tomorrow", className: "text-amber-200" };
  }
  return { label: `Due ${formatted}`, className: "text-zinc-500" };
}

function TasksTab({
  project,
  loading,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: TasksTabProps): JSX.Element {
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<ProjectPriority>("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  const sortedTasks = useMemo(
    () =>
      [...project.tasks].sort((left, right) => {
        const statusDiff = taskStatusOrder[left.status] - taskStatusOrder[right.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }
        // Dated work first, earliest deadline on top.
        if (left.due_date !== right.due_date) {
          if (!left.due_date) {
            return 1;
          }
          if (!right.due_date) {
            return -1;
          }
          return Date.parse(left.due_date) - Date.parse(right.due_date);
        }
        if (left.sort_order !== right.sort_order) {
          return left.sort_order - right.sort_order;
        }
        return left.name.localeCompare(right.name, "en-GB");
      }),
    [project.tasks],
  );

  const submitTask = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!newTaskName.trim()) {
      return;
    }
    await onCreateTask({
      name: newTaskName.trim(),
      priority: newTaskPriority,
      status: "open",
      due_date: newTaskDueDate || undefined,
      sort_order: project.tasks.length,
    });
    setNewTaskName("");
    setNewTaskPriority("medium");
    setNewTaskDueDate("");
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Open tasks travel into every chat in this workspace, so Ozy knows what is still pending.
      </p>

      {sortedTasks.length === 0 ? (
        <p className="text-sm text-zinc-500">No tasks yet.</p>
      ) : (
        <ul className="space-y-2">
          {sortedTasks.map((task) => {
            const due = task.due_date ? describeDueDate(task.due_date) : null;
            return (
              <li
                key={task.task_id}
                className="grid gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 md:grid-cols-[auto_1fr_auto_auto_auto]"
              >
                <input
                  type="checkbox"
                  checked={task.status === "done"}
                  aria-label={`Mark ${task.name} as done`}
                  onChange={(event) =>
                    void onUpdateTask(task.task_id, {
                      status: event.target.checked ? "done" : "open",
                    })
                  }
                  className="mt-1 h-4 w-4 accent-indigo-500"
                />
                <div className="min-w-0">
                  <p
                    className={`text-sm ${
                      task.status === "done" ? "text-zinc-500 line-through" : "text-zinc-100"
                    }`}
                  >
                    {task.name}
                  </p>
                  {task.description ? (
                    <p className="text-xs text-zinc-400">{task.description}</p>
                  ) : null}
                  {due && task.status !== "done" ? (
                    <p className={`text-xs ${due.className}`}>{due.label}</p>
                  ) : null}
                </div>
                <select
                  value={task.priority}
                  aria-label={`Priority of ${task.name}`}
                  onChange={(event) =>
                    void onUpdateTask(task.task_id, {
                      priority: event.target.value as ProjectPriority,
                    })
                  }
                  className="text-xs"
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={task.status}
                  aria-label={`Status of ${task.name}`}
                  onChange={(event) =>
                    void onUpdateTask(task.task_id, { status: event.target.value as TaskStatus })
                  }
                  className="text-xs"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 py-0 text-xs text-red-200 hover:text-red-100"
                  onClick={() => void onDeleteTask(task.task_id)}
                  disabled={loading}
                  aria-label={`Delete ${task.name}`}
                >
                  Delete
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="grid gap-2 rounded-lg border border-dashed border-white/[0.12] p-3 md:grid-cols-[1fr_auto_auto_auto]"
        onSubmit={(event) => void submitTask(event)}
      >
        <input
          aria-label="new-task-input"
          value={newTaskName}
          onChange={(event) => setNewTaskName(event.target.value)}
          placeholder="What needs to happen?"
        />
        <input
          aria-label="new-task-due-date"
          type="date"
          value={newTaskDueDate}
          onChange={(event) => setNewTaskDueDate(event.target.value)}
        />
        <select
          aria-label="new-task-priority"
          value={newTaskPriority}
          onChange={(event) => setNewTaskPriority(event.target.value as ProjectPriority)}
        >
          {priorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={loading}>
          Add task
        </Button>
      </form>
    </div>
  );
}

export default TasksTab;
