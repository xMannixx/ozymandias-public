import { FormEvent, useState } from "react";
import Button from "@/components/common/Button";
import type { CreateProjectRequest, ProjectPriority, ProjectStatus } from "@/api/types";

type CreateProjectDialogProps = {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (payload: CreateProjectRequest) => Promise<void>;
};

const statusOptions: ProjectStatus[] = ["active", "paused", "completed", "cancelled"];
const priorityOptions: ProjectPriority[] = ["low", "medium", "high", "critical"];

function toNullableDate(value: string): string | undefined {
  return value.trim() ? value : undefined;
}

function CreateProjectDialog({ open, creating, onClose, onCreate }: CreateProjectDialogProps): JSX.Element | null {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [priority, setPriority] = useState<ProjectPriority>("medium");
  const [color, setColor] = useState("#58a6ff");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    await onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      color: color || undefined,
      start_date: toNullableDate(startDate),
      target_date: toNullableDate(targetDate),
    });
    setName("");
    setDescription("");
    setStatus("active");
    setPriority("medium");
    setColor("#58a6ff");
    setStartDate("");
    setTargetDate("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 p-4 backdrop-blur-sm">
      <div className="mx-auto max-w-xl rounded-xl border border-blue-500/30 bg-[#0d1117]/95 p-4">
        <h3 className="mb-3 text-lg font-semibold text-blue-200">New project</h3>
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <div>
            <label className="mb-1 block text-sm text-gray-300" htmlFor="create-project-name">
              Name
            </label>
            <input
              id="create-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-300" htmlFor="create-project-description">
              Description
            </label>
            <textarea
              id="create-project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="h-24 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-300" htmlFor="create-project-status">
                Status
              </label>
              <select
                id="create-project-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as ProjectStatus)}
                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300" htmlFor="create-project-priority">
                Prioritaet
              </label>
              <select
                id="create-project-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as ProjectPriority)}
                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-gray-300" htmlFor="create-project-color">
                Farbe
              </label>
              <input
                id="create-project-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-10 w-full rounded border border-gray-700 bg-gray-900 px-1 py-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300" htmlFor="create-project-start">
                Start
              </label>
              <input
                id="create-project-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-300" htmlFor="create-project-target">
                Ziel
              </label>
              <input
                id="create-project-target"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateProjectDialog;
