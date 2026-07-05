import { FormEvent, useMemo, useState } from "react";
import Button from "@/components/common/Button";
import type { ProjectDetailResponse, RiskSeverity, RiskStatus } from "@/api/types";

type RisksTabProps = {
  project: ProjectDetailResponse;
  loading: boolean;
  onCreateRisk: (data: {
    name: string;
    description?: string;
    severity?: RiskSeverity;
    status?: RiskStatus;
  }) => Promise<void>;
  onUpdateRisk: (
    riskId: string,
    data: { name?: string; description?: string; severity?: RiskSeverity; status?: RiskStatus },
  ) => Promise<void>;
  onDeleteRisk: (riskId: string) => Promise<void>;
};

const severityRank: Record<RiskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const severityBadgeClass: Record<RiskSeverity, string> = {
  low: "bg-green-700/40 text-green-100",
  medium: "bg-yellow-700/40 text-yellow-100",
  high: "bg-orange-700/40 text-orange-100",
  critical: "bg-red-700/60 text-red-100",
};

const severityOptions: RiskSeverity[] = ["low", "medium", "high", "critical"];
const statusOptions: RiskStatus[] = ["open", "watching", "occurred", "resolved"];

function RisksTab({ project, loading, onCreateRisk, onUpdateRisk, onDeleteRisk }: RisksTabProps): JSX.Element {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<RiskSeverity>("medium");

  const sortedRisks = useMemo(
    () =>
      [...project.risks].sort((left, right) => {
        const severityDiff = severityRank[left.severity] - severityRank[right.severity];
        if (severityDiff !== 0) {
          return severityDiff;
        }
        return left.name.localeCompare(right.name, "en-GB");
      }),
    [project.risks],
  );

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    await onCreateRisk({
      name: name.trim(),
      description: description.trim() || undefined,
      severity,
      status: "open",
    });
    setName("");
    setDescription("");
    setSeverity("medium");
    setCreateOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={() => setCreateOpen((open) => !open)}>
          {createOpen ? "Close form" : "New risk"}
        </Button>
      </div>

      {createOpen ? (
        <form className="space-y-2 rounded-md border border-dashed border-gray-600 p-3" onSubmit={(event) => void submit(event)}>
          <input
            aria-label="new-risk-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Risikotitel..."
            className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
          <textarea
            aria-label="new-risk-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description..."
            className="h-20 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
          <div className="flex items-center gap-2">
            <select
              aria-label="new-risk-severity"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as RiskSeverity)}
              className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            >
              {severityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={loading}>
              Anlegen
            </Button>
          </div>
        </form>
      ) : null}

      {sortedRisks.length === 0 ? (
        <p className="text-sm text-gray-400">No risks yet.</p>
      ) : (
        <div className="space-y-2">
          {sortedRisks.map((risk) => (
            <div key={risk.risk_id} className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-100">{risk.name}</p>
                  {risk.description ? <p className="text-xs text-gray-400">{risk.description}</p> : null}
                  <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${severityBadgeClass[risk.severity]}`}>
                    {risk.severity}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={risk.status}
                    onChange={(event) =>
                      void onUpdateRisk(risk.risk_id, { status: event.target.value as RiskStatus })
                    }
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
                    onClick={() => void onDeleteRisk(risk.risk_id)}
                    disabled={loading}
                  >
                    Del
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RisksTab;
