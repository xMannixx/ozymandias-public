import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BehavioralRule, RuleConflict } from "@/api/memory";
import BehavioralRulesReview from "@/components/memory/BehavioralRulesReview";

const pendingRule: BehavioralRule = {
  rule_id: "rule-1",
  domain: "format",
  behavior_text: "Antworte immer in Markdown",
  trigger: { keywords: ["markdown"] },
  effect: { action: "use_markdown", polarity: "affirm" },
  artifact_cost: 1,
  status: "pending",
  source_type: "user_explicit",
  previous_rule_id: null,
  created_at: "2026-06-01T10:00:00Z",
  activated_at: null,
  expires_at: null,
};

const hardConflict: RuleConflict = {
  conflict_id: "c1",
  rule_id: "rule-1",
  other_rule_id: "rule-9",
  conflict_type: "direct",
  severity: "hard",
  detail: "widerspricht Regel rule-9",
  resolved: false,
};

const hookState = {
  rules: [pendingRule] as BehavioralRule[],
  conflicts: [] as RuleConflict[],
  loading: false,
  error: null as string | null,
  toast: null as { message: string; type: "success" | "error" } | null,
  approve: vi.fn(async () => undefined),
  reject: vi.fn(async () => undefined),
  retire: vi.fn(async () => undefined),
  clearToast: vi.fn(),
  refetch: vi.fn(async () => undefined),
};

vi.mock("@/hooks/useBehavioralRules", () => ({
  useBehavioralRules: () => hookState,
}));

describe("BehavioralRulesReview", () => {
  beforeEach(() => {
    hookState.conflicts = [];
    hookState.approve.mockClear();
    hookState.reject.mockClear();
  });

  it("renders a pending rule with activate action", () => {
    render(<BehavioralRulesReview />);
    expect(screen.getByText("Antworte immer in Markdown")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled();
  });

  it("disables activation when a hard conflict exists", () => {
    hookState.conflicts = [hardConflict];
    render(<BehavioralRulesReview />);
    expect(screen.getByRole("button", { name: "Activate" })).toBeDisabled();
    expect(screen.getByText(/HARD/)).toBeInTheDocument();
  });

  it("calls approve when activated", async () => {
    render(<BehavioralRulesReview />);
    await userEvent.click(screen.getByRole("button", { name: "Activate" }));
    expect(hookState.approve).toHaveBeenCalledWith("rule-1", false);
  });
});
