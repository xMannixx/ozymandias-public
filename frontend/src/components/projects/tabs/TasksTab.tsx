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
    sort_order?: number;
  }) => Promise<void>;
  onUpdateTask: (
    taskId: string,
    data: { status?: TaskStatus; priority?: ProjectPriority; name?: string; description?: string },
  ) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
};

const taskStatusOrder: Record<TaskStatus, number> = {
  open: 0,
  in_progress: 1,
  done: 2,
};

const priorityOptions: ProjectPriority[] = ["low", "medium", "high", "critical"];
const statusOptions: TaskStatus[] = ["open", "in_progress", "done"];

function TasksTab({ project, loading, onCreateTask, onUpdateTask, onDeleteTask }: TasksTabProps): JSX.Element {
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<ProjectPriority>("medium");

  const sortedTasks = useMemo(
    () =>
      [...project.tasks].sort((left, right) => {
        const statusDiff = taskStatusOrder[left.status] - taskStatusOrder[right.status];
        if (statusDiff !== 0) {
          return statusDiff;
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
      sort_order: project.tasks.length,
    });
    setNewTaskName("");
    setNewTaskPriority("medium");
  };

  return (
    <div className="space-y-3">
      {sortedTasks.length === 0 ? (
        <p className="text-sm text-gray-400">No tasks yet.</p>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <div
              key={task.task_id}
              className="grid gap-2 rounded-md border border-gray-700 bg-gray-900/70 p-3 md:grid-cols-[auto_1fr_auto_auto_auto]"
            >
              <input
                type="checkbox"
                checked={task.status === "done"}
                aria-label={`task-done-${task.task_id}`}
                onChange={(event) =>
                  void onUpdateTask(task.task_id, {
                    status: event.target.checked ? "done" : "open",
                  })
                }
                className="mt-1 h-4 w-4 accent-blue-500"
              />
              <div>
                <p className={`text-sm ${task.status === "done" ? "text-gray-500 line-through" : "text-gray-100"}`}>
                  {task.name}
                </p>
                {task.description ? <p className="text-xs text-gray-400">{task.description}</p> : null}
                {task.due_date ? (
                  <p className="text-xs text-gray-500">
                    Due: {new Date(task.due_date).toLocaleDateString("en-GB")}
                  </p>
                ) : null}
              </div>
              <select
                value={task.priority}
                onChange={(event) =>
                  void onUpdateTask(task.task_id, { priority: event.target.value as ProjectPriority })
                }
                className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100"
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={task.status}
                onChange={(event) => void onUpdateTask(task.task_id, { status: event.target.value as TaskStatus })}
                className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="danger"
                className="h-8 px-2 py-0 text-xs"
                onClick={() => void onDeleteTask(task.task_id)}
                disabled={loading}
              >
                Del
              </Button>
            </div>
          ))}
        </div>
      )}

      <form className="grid gap-2 rounded-md border border-dashed border-gray-600 p-2 md:grid-cols-[1fr_auto_auto]" onSubmit={(event) => void submitTask(event)}>
        <input
          aria-label="new-task-input"
          value={newTaskName}
          onChange={(event) => setNewTaskName(event.target.value)}
          placeholder="New task..."
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
        <select
          aria-label="new-task-priority"
          value={newTaskPriority}
          onChange={(event) => setNewTaskPriority(event.target.value as ProjectPriority)}
          className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
        >
          {priorityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={loading}>
          Add
        </Button>
      </form>
    </div>
  );
}

export default TasksTab;
