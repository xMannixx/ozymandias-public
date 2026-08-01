import { useState } from "react";
import { AlertTriangle, Info, ScrollText } from "lucide-react";
import type { BehavioralRule, RuleConflict } from "@/api/memory";
import Button from "@/components/common/Button";
import InfoHint from "@/components/common/InfoHint";
import { humanizeSnakeCase, labelFor } from "@/lib/labels";
import { toRelativeTime } from "@/lib/relativeTime";
import { useBehavioralRules } from "@/hooks/useBehavioralRules";

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  direct: "Contradicts another rule",
  interaction: "Overlaps another rule",
  cap: "Too many rules already",
  budget: "Topic is getting crowded",
};

const SEVERITY_LABELS: Record<string, string> = {
  hard: "Blocking",
  soft: "Worth a look",
};

const ARTIFACT_COST_HINT =
  "Each rule takes up part of a budget per topic, so Ozymandias cannot pile up endless rules for one area.";

function conflictsFor(conflicts: RuleConflict[], ruleId: string): RuleConflict[] {
  return conflicts.filter((conflict) => conflict.rule_id === ruleId && !conflict.resolved);
}

function RuleRow({
  rule,
  conflicts,
  onApprove,
  onReject,
  onRetire,
}: {
  rule: BehavioralRule;
  conflicts: RuleConflict[];
  onApprove: (id: string, overrideSoft: boolean) => void;
  onReject: (id: string) => void;
  onRetire: (id: string) => void;
}): JSX.Element {
  const ruleConflicts = conflictsFor(conflicts, rule.rule_id);
  const hasHard = ruleConflicts.some((conflict) => conflict.severity === "hard");
  const hasSoft = ruleConflicts.some((conflict) => conflict.severity === "soft");

  return (
    <div
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5"
      data-testid={`rule-${rule.rule_id}`}
    >
      <p className="text-sm leading-snug text-white">{rule.behavior_text}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
        <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-zinc-400">
          {humanizeSnakeCase(rule.domain)}
        </span>
        <span className="flex items-center gap-1">
          {`Weight ${rule.artifact_cost}`}
          <InfoHint text={ARTIFACT_COST_HINT} label="What does the weight mean?" />
        </span>
        <span aria-hidden="true" className="text-zinc-700">
          ·
        </span>
        <span>Suggested {toRelativeTime(rule.created_at)}</span>
      </div>

      {ruleConflicts.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {ruleConflicts.map((conflict) => {
            const isHard = conflict.severity === "hard";
            return (
              <li
                key={conflict.conflict_id}
                className={`flex gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                  isHard
                    ? "border-rose-500/25 bg-rose-500/[0.06] text-rose-100"
                    : "border-amber-500/25 bg-amber-500/[0.06] text-amber-100"
                }`}
              >
                {isHard ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>
                  <span className="font-medium">
                    {`${labelFor(SEVERITY_LABELS, conflict.severity)}: ${labelFor(
                      CONFLICT_TYPE_LABELS,
                      conflict.conflict_type,
                    )}`}
                  </span>
                  <span className="block text-[11px] opacity-80">{conflict.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {rule.status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={hasHard}
            title={hasHard ? "A hard conflict blocks activation" : undefined}
            onClick={() => onApprove(rule.rule_id, hasSoft)}
          >
            {hasSoft ? "Activate with override" : "Activate"}
          </Button>
          <Button variant="danger" onClick={() => onReject(rule.rule_id)}>
            Reject
          </Button>
          {hasHard ? (
            <p className="w-full text-xs text-zinc-500">
              This rule cannot be activated while it contradicts an active rule. Retire the other rule first.
            </p>
          ) : null}
        </div>
      )}

      {rule.status === "active" && (
        <div className="mt-3">
          <Button variant="ghost" onClick={() => onRetire(rule.rule_id)}>
            Retire
          </Button>
        </div>
      )}
    </div>
  );
}

function BehavioralRulesReview(): JSX.Element {
  const { rules, conflicts, loading, error, toast, approve, reject, retire, clearToast } = useBehavioralRules();
  const [tab, setTab] = useState<"pending" | "active">("pending");

  const visible = rules.filter((rule) => rule.status === tab);
  const pendingCount = rules.filter((rule) => rule.status === "pending").length;
  const activeCount = rules.filter((rule) => rule.status === "active").length;

  return (
    <section className="space-y-4">
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-[color:var(--accent)]"
        >
          <ScrollText className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-medium tracking-tight text-white">Behaviour rules</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-zinc-500">
            Standing instructions for how Ozymandias should act, like &quot;always answer in Markdown&quot;. It may
            suggest rules for itself, but never switches one on without you.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
        <button
          type="button"
          aria-pressed={tab === "pending"}
          onClick={() => setTab("pending")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            tab === "pending" ? "bg-white/[0.07] text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Waiting for you
          <span className="text-[11px] tabular-nums text-zinc-500">{pendingCount}</span>
        </button>
        <button
          type="button"
          aria-pressed={tab === "active"}
          onClick={() => setTab("active")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            tab === "active" ? "bg-white/[0.07] text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          In effect
          <span className="text-[11px] tabular-nums text-zinc-500">{activeCount}</span>
        </button>
      </div>

      {toast && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            toast.type === "error"
              ? "border-rose-500/25 bg-rose-500/[0.07] text-rose-100"
              : "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-100"
          }`}
          role="status"
          onClick={clearToast}
        >
          {toast.message}
        </div>
      )}

      {loading && <p className="text-sm text-zinc-500">Loading rules…</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && visible.length === 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[color:var(--surface)] p-8 text-center">
          <p className="text-sm text-zinc-300">
            {tab === "pending" ? "Nothing waiting for review" : "No rules in effect"}
          </p>
          <p className="mt-1.5 text-sm text-zinc-500">
            {tab === "pending"
              ? "When Ozymandias notices a pattern in how you want it to behave, its suggestion appears here."
              : "Activate a suggested rule and it will apply to every answer from then on."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((rule) => (
          <RuleRow
            key={rule.rule_id}
            rule={rule}
            conflicts={conflicts}
            onApprove={approve}
            onReject={reject}
            onRetire={retire}
          />
        ))}
      </div>
    </section>
  );
}

export default BehavioralRulesReview;
