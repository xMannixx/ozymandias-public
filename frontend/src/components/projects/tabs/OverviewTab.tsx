import { FormEvent, useEffect, useState } from "react";
import Button from "@/components/common/Button";
import type { ProjectDetailResponse, ProjectPriority, ProjectStatus, UpdateProjectRequest } from "@/api/types";

type OverviewTabProps = {
  project: ProjectDetailResponse;
  loading: boolean;
  onUpdateProject: (data: UpdateProjectRequest) => Promise<void>;
};

const statusOptions: ProjectStatus[] = ["active", "paused", "completed", "cancelled"];
const priorityOptions: ProjectPriority[] = ["low", "medium", "high", "critical"];

function formatSummary(project: ProjectDetailResponse): string {
  const milestone = project.next_milestone ? project.next_milestone : "keiner";
  return `${project.task_done_count} von ${project.task_count} Aufgaben erledigt, ${project.risk_open_count} offene Risiken, naechster Meilenstein: ${milestone}`;
}

function OverviewTab({ project, loading, onUpdateProject }: OverviewTabProps): JSX.Element {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [priority, setPriority] = useState<ProjectPriority>(project.priority);
  const [color, setColor] = useState(project.color ?? "#58a6ff");
  const [startDate, setStartDate] = useState(project.start_date ? project.start_date.slice(0, 10) : "");
  const [targetDate, setTargetDate] = useState(project.target_date ? project.target_date.slice(0, 10) : "");
  const [completedDate, setCompletedDate] = useState(
    project.completed_date ? project.completed_date.slice(0, 10) : "",
  );

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setStatus(project.status);
    setPriority(project.priority);
    setColor(project.color ?? "#58a6ff");
    setStartDate(project.start_date ? project.start_date.slice(0, 10) : "");
    setTargetDate(project.target_date ? project.target_date.slice(0, 10) : "");
    setCompletedDate(project.completed_date ? project.completed_date.slice(0, 10) : "");
  }, [project]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const payload: UpdateProjectRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      color: color || undefined,
      start_date: startDate || undefined,
      target_date: targetDate || undefined,
      completed_date: completedDate || undefined,
    };
    await onUpdateProject(payload);
  };

  return (
    <form className="space-y-3" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="overview-name">
            Name
          </label>
          <input
            id="overview-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="overview-color">
            Farbe
          </label>
          <input
            id="overview-color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-10 w-full rounded border border-gray-700 bg-gray-900 px-1 py-1"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-400" htmlFor="overview-description">
          Beschreibung
        </label>
        <textarea
          id="overview-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="h-24 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="overview-status">
            Status
          </label>
          <select
            id="overview-status"
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
          <label className="mb-1 block text-xs text-gray-400" htmlFor="overview-priority">
            Prioritaet
          </label>
          <select
            id="overview-priority"
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

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="overview-start">
            Start
          </label>
          <input
            id="overview-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="overview-target">
            Ziel
          </label>
          <input
            id="overview-target"
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="overview-completed">
            Abschluss
          </label>
          <input
            id="overview-completed"
            type="date"
            value={completedDate}
            onChange={(event) => setCompletedDate(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </div>
      </div>

      <p className="rounded-md border border-blue-500/25 bg-blue-950/20 p-2 text-xs text-blue-100">
        {formatSummary(project)}
      </p>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          Speichern
        </Button>
      </div>
    </form>
  );
}

export default OverviewTab;
