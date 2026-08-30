import { render, screen } from "@testing-library/react";
import BriefingCard from "@/components/dashboard/BriefingCard";
import { mockBriefing } from "@/test/fixtures";

const useBriefingMock = vi.fn();

vi.mock("@/hooks/useBriefing", () => ({
  useBriefing: () => useBriefingMock(),
}));

function state(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { briefing: null, loading: false, error: null, refetch: vi.fn(), ...overrides };
}

describe("BriefingCard", () => {
  beforeEach(() => {
    useBriefingMock.mockReset();
  });

  it("shows every section with its items", () => {
    useBriefingMock.mockReturnValue(state({ briefing: mockBriefing }));

    render(<BriefingCard />);

    expect(screen.getByText("Today's calendar")).toBeInTheDocument();
    expect(screen.getByText("09:00 Standup")).toBeInTheDocument();
    expect(screen.getByText("Invoice — billing@hetzner.com")).toBeInTheDocument();
  });

  it("says how many items were left out of a section", () => {
    useBriefingMock.mockReturnValue(state({ briefing: mockBriefing }));

    render(<BriefingCard />);

    expect(screen.getByText("and 2 more")).toBeInTheDocument();
  });

  it("explains the empty state instead of showing an error", () => {
    useBriefingMock.mockReturnValue(state());

    render(<BriefingCard />);

    expect(screen.getByText(/No briefing yet/)).toBeInTheDocument();
  });

  it("marks a briefing from an earlier day", () => {
    useBriefingMock.mockReturnValue(state({ briefing: mockBriefing }));

    render(<BriefingCard />);

    expect(screen.getByText(/^From Monday/)).toBeInTheDocument();
  });

  it("surfaces a failed request", () => {
    useBriefingMock.mockReturnValue(state({ error: "network down" }));

    render(<BriefingCard />);

    expect(screen.getByText(/Briefing unavailable. network down/)).toBeInTheDocument();
  });
});
