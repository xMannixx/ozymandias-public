import { useState } from "react";
import type { BehavioralRule, RuleConflict } from "@/api/memory";
import Button from "@/components/common/Button";
import GlassCard from "@/components/common/GlassCard";
import { useBehavioralRules } from "@/hooks/useBehavioralRules";

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
    <div className="rounded-md border border-gray-700 p-3" data-testid={`rule-${rule.rule_id}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-100">{rule.behavior_text}</p>
          <p className="mt-1 text-xs text-gray-400">
            Domain: {rule.domain} · Status: {rule.status} · Artefakt-Kosten: {rule.artifact_cost}
          </p>
        </div>
      </div>

      {ruleConflicts.length > 0 && (
        <ul className="mt-2 space-y-1">
          {ruleConflicts.map((conflict) => (
            <li
              key={conflict.conflict_id}
              className={`text-xs ${conflict.severity === "hard" ? "text-red-400" : "text-amber-400"}`}
            >
              [{conflict.severity.toUpperCase()} · {conflict.conflict_type}] {conflict.detail}
            </li>
          ))}
        </ul>
      )}

      {rule.status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={hasHard}
            title={hasHard ? "Harter Konflikt blockiert die Aktivierung" : undefined}
            onClick={() => onApprove(rule.rule_id, hasSoft)}
          >
            {hasSoft ? "Mit Override aktivieren" : "Aktivieren"}
          </Button>
          <Button variant="danger" onClick={() => onReject(rule.rule_id)}>
            Ablehnen
          </Button>
        </div>
      )}

      {rule.status === "active" && (
        <div className="mt-3">
          <Button variant="ghost" onClick={() => onRetire(rule.rule_id)}>
            Stilllegen
          </Button>
        </div>
      )}
    </div>
  );
}

function BehavioralRulesReview(): JSX.Element {
  const { rules, conflicts, loading, error, toast, approve, reject, retire, clearToast } =
    useBehavioralRules();
  const [tab, setTab] = useState<"pending" | "active">("pending");

  const visible = rules.filter((rule) => rule.status === tab);

  return (
    <GlassCard className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-100">Verhaltensregeln (Procedural Lane)</h2>
        <div className="flex gap-2">
          <Button variant={tab === "pending" ? "primary" : "ghost"} onClick={() => setTab("pending")}>
            Review
          </Button>
          <Button variant={tab === "active" ? "primary" : "ghost"} onClick={() => setTab("active")}>
            Aktiv
          </Button>
        </div>
      </header>

      <p className="text-xs text-gray-400">
        Selbstgeschriebene Regeln werden nie automatisch aktiviert. Harte Konflikte blockieren die
        Freigabe, weiche Konflikte erfordern eine bewusste Override-Entscheidung.
      </p>

      {toast && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${toast.type === "error" ? "bg-red-900/40 text-red-200" : "bg-emerald-900/40 text-emerald-200"}`}
          role="status"
          onClick={clearToast}
        >
          {toast.message}
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Lade Regeln…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && visible.length === 0 && (
        <p className="text-sm text-gray-500">
          {tab === "pending" ? "Keine Regeln zur Freigabe." : "Keine aktiven Regeln."}
        </p>
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
    </GlassCard>
  );
}

export default BehavioralRulesReview;
