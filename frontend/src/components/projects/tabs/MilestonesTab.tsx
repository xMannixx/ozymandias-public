import { FormEvent, useMemo, useState } from "react";
import Button from "@/components/common/Button";
import type { ProjectDetailResponse } from "@/api/types";

type MilestonesTabProps = {
  project: ProjectDetailResponse;
  loading: boolean;
  onCreateMilestone: (data: { name: string; due_date?: string; sort_order?: number }) => Promise<void>;
  onUpdateMilestone: (
    milestoneId: string,
    data: { name?: string; due_date?: string; completed?: boolean; sort_order?: number },
  ) => Promise<void>;
  onDeleteMilestone: (milestoneId: string) => Promise<void>;
};

function parseDateValue(value: string | null): number {
  if (!value) {
    return Number.MIN_SAFE_INTEGER;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.MIN_SAFE_INTEGER : parsed;
}

function MilestonesTab({
  project,
  loading,
  onCreateMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
}: MilestonesTabProps): JSX.Element {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");

  const milestones = useMemo(
    () => [...project.milestones].sort((left, right) => parseDateValue(right.due_date) - parseDateValue(left.due_date)),
    [project.milestones],
  );

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    await onCreateMilestone({
      name: name.trim(),
      due_date: dueDate || undefined,
      sort_order: project.milestones.length,
    });
    setName("");
    setDueDate("");
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {milestones.length === 0 ? (
          <p className="text-sm text-gray-400">Noch keine Meilensteine vorhanden.</p>
        ) : (
          milestones.map((milestone) => (
            <div
              key={milestone.milestone_id}
              className={`rounded-md border p-3 ${milestone.completed ? "border-gray-700 bg-gray-900/50 text-gray-500" : "border-blue-700/40 bg-blue-950/20 text-blue-100"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={milestone.completed}
                    aria-label={`milestone-completed-${milestone.milestone_id}`}
                    onChange={(event) =>
                      void onUpdateMilestone(milestone.milestone_id, { completed: event.target.checked })
                    }
                    className="mt-1 h-4 w-4 accent-blue-500"
                  />
                  <div>
                    <p className={`${milestone.completed ? "line-through" : ""}`}>{milestone.name}</p>
                    <p className="text-xs">
                      {milestone.due_date
                        ? new Date(milestone.due_date).toLocaleDateString("en-GB")
                        : "No date"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="h-8 px-2 py-0 text-xs"
                  onClick={() => void onDeleteMilestone(milestone.milestone_id)}
                  disabled={loading}
                >
                  Del
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <form className="grid gap-2 rounded-md border border-dashed border-gray-600 p-2 md:grid-cols-[1fr_auto_auto]" onSubmit={(event) => void submit(event)}>
        <input
          aria-label="new-milestone-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New milestone..."
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
        <input
          aria-label="new-milestone-date"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
        />
        <Button type="submit" disabled={loading}>
          Add
        </Button>
      </form>
    </div>
  );
}

export default MilestonesTab;
