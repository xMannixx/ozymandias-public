import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AuditFeed from "@/components/audit/AuditFeed";
import { mockAuditList } from "@/test/fixtures";

function renderWithRouter(initialEntries: string[] = ["/audit"]): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuditFeed />
    </MemoryRouter>,
  );
}

const defaultAuditFilters = {
  event_type: "",
  sensitivity: "",
  result: "",
  after: "",
  before: "",
} as const;

const hookState = {
  entries: mockAuditList,
  total: 120,
  loading: false,
  error: null as string | null,
  filters: defaultAuditFilters,
  page: 1,
  limit: 50,
  showS4: false,
  setFilters: vi.fn(),
  resetFilters: vi.fn(),
  setPage: vi.fn(),
  setLimit: vi.fn(),
  setShowS4: vi.fn(),
  refetch: vi.fn(async () => undefined),
};

vi.mock("@/hooks/useAudit", () => ({
  useAudit: () => hookState,
}));

describe("AuditFeed", () => {
  it("renders list entries", () => {
    renderWithRouter();
    expect(
      screen.getAllByText(/Chat message processed|Memory confirmed|Sensitivity violation/).length,
    ).toBeGreaterThan(0);
  });

  it("shows empty state when list is empty", () => {
    hookState.entries = [];
    renderWithRouter();
    expect(screen.getByText("No audit entries match these filters.")).toBeInTheDocument();
    hookState.entries = mockAuditList;
  });

  it("groups entries by day with a day header", () => {
    renderWithRouter();
    expect(screen.getAllByText(/Today|Yesterday|\d{4}/).length).toBeGreaterThan(0);
  });

  it("filtering by category only shows matching entries", async () => {
    renderWithRouter();
    await userEvent.click(screen.getByRole("button", { name: "Security" }));
    expect(
      screen.queryByText("Chat message processed via deepseek", { selector: "p" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Sensitivity violation|Security event|Taint escalation/i).length,
    ).toBeGreaterThan(0);
  });

  it("shows loading spinner on initial load (no entries yet)", () => {
    hookState.loading = true;
    const previousEntries = hookState.entries;
    hookState.entries = [];
    renderWithRouter();
    expect(screen.getByLabelText("loading")).toBeInTheDocument();
    hookState.loading = false;
    hookState.entries = previousEntries;
  });

  it("pagination previous and next call setPage", async () => {
    hookState.setPage.mockClear();
    renderWithRouter();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(hookState.setPage).toHaveBeenCalledWith(2);
  });

  it("S4 toggle is disabled by default", () => {
    renderWithRouter();
    expect(screen.getByLabelText("s4-toggle")).not.toBeChecked();
  });

  it("applies a source_ref filter from the URL with a clearable chip", async () => {
    renderWithRouter(["/audit?source_ref=turn-99"]);
    expect(screen.getByText(/Filtered by source:/)).toBeInTheDocument();
    expect(screen.getByText("turn-99")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Chat message processed|Memory confirmed|Sensitivity violation/).length,
    ).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText(/Filtered by source:/)).not.toBeInTheDocument();
  });
});
