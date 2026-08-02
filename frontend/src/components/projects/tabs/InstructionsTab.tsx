import { FormEvent, useEffect, useState } from "react";
import Button from "@/components/common/Button";
import type {
  ProjectDetailResponse,
  ProjectPriority,
  ProjectStatus,
  Sensitivity,
  UpdateProjectRequest,
} from "@/api/types";

type InstructionsTabProps = {
  project: ProjectDetailResponse;
  loading: boolean;
  onUpdateProject: (data: UpdateProjectRequest) => Promise<void>;
};

const statusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const priorityOptions: Array<{ value: ProjectPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

/** S3 and S4 never leave the machine, so they are offered with that promise spelled out. */
const sensitivityOptions: Array<{ value: Sensitivity; label: string }> = [
  { value: "S0", label: "S0 — public, nothing to protect" },
  { value: "S1", label: "S1 — normal, may use cloud models" },
  { value: "S2", label: "S2 — personal, may use cloud models" },
  { value: "S3", label: "S3 — sensitive, stays on local models" },
  { value: "S4", label: "S4 — secret, stays on local models" },
];

const INSTRUCTIONS_PLACEHOLDER =
  "Example: Always answer in German. This project follows the 2026 tax rules. Prefer the terminology from the uploaded glossary.";

function InstructionsTab({
  project,
  loading,
  onUpdateProject,
}: InstructionsTabProps): JSX.Element {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [instructions, setInstructions] = useState(project.instructions ?? "");
  const [sensitivity, setSensitivity] = useState<Sensitivity>(project.sensitivity);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [priority, setPriority] = useState<ProjectPriority>(project.priority);
  const [targetDate, setTargetDate] = useState(project.target_date?.slice(0, 10) ?? "");

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setInstructions(project.instructions ?? "");
    setSensitivity(project.sensitivity);
    setStatus(project.status);
    setPriority(project.priority);
    setTargetDate(project.target_date?.slice(0, 10) ?? "");
  }, [project]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await onUpdateProject({
      name: name.trim(),
      description: description.trim() || undefined,
      instructions: instructions.trim() || undefined,
      sensitivity,
      status,
      priority,
      target_date: targetDate || undefined,
    });
  };

  const keepsLocal = sensitivity === "S3" || sensitivity === "S4";

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <section className="space-y-2">
        <label className="block text-sm font-medium text-zinc-100" htmlFor="workspace-instructions">
          Instructions for this workspace
        </label>
        <p className="text-xs text-zinc-500">
          Ozy reads these before every answer in this project. Use them for tone, rules and
          vocabulary that should always apply here.
        </p>
        <textarea
          id="workspace-instructions"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder={INSTRUCTIONS_PLACEHOLDER}
          className="h-40 w-full"
        />
      </section>

      <section className="space-y-2">
        <label className="block text-sm font-medium text-zinc-100" htmlFor="workspace-sensitivity">
          Privacy level
        </label>
        <select
          id="workspace-sensitivity"
          value={sensitivity}
          onChange={(event) => setSensitivity(event.target.value as Sensitivity)}
          className="w-full"
        >
          {sensitivityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
          {keepsLocal
            ? "Chats in this workspace run on local models only. No content reaches a cloud provider."
            : "Chats in this workspace may use cloud providers, depending on your settings."}
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-400" htmlFor="workspace-name">
            Name
          </label>
          <input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400" htmlFor="workspace-target">
            Target date
          </label>
          <input
            id="workspace-target"
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="w-full"
          />
        </div>
      </section>

      <section>
        <label className="mb-1 block text-xs text-zinc-400" htmlFor="workspace-description">
          What is this project about?
        </label>
        <textarea
          id="workspace-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="h-24 w-full"
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-400" htmlFor="workspace-status">
            Status
          </label>
          <select
            id="workspace-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ProjectStatus)}
            className="w-full"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400" htmlFor="workspace-priority">
            Priority
          </label>
          <select
            id="workspace-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as ProjectPriority)}
            className="w-full"
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export default InstructionsTab;
