import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import MemoryBrowser from "@/components/memory/MemoryBrowser";
import { mockClaimTentative, mockClaimVersions } from "@/test/fixtures";

function renderWithRouter(initialEntries: string[] = ["/memory"]): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MemoryBrowser />
    </MemoryRouter>,
  );
}

const hookState = {
  claims: [mockClaimTentative],
  filteredClaims: [mockClaimTentative],
  loading: false,
  error: null as string | null,
  filters: {
    sensitivities: [],
    memoryType: "",
    lifecycle: "",
    verificationState: "",
    trustLevel: "",
  },
  searchQuery: "",
  selectedClaim: mockClaimTentative,
  versions: mockClaimVersions,
  toast: null as { message: string; type: "success" | "error" | "info" } | null,
  setFilters: vi.fn(),
  resetFilters: vi.fn(),
  setSearchQuery: vi.fn(),
  selectClaim: vi.fn(async () => undefined),
  confirmClaim: vi.fn(async () => undefined),
  retractClaim: vi.fn(async () => undefined),
  archiveClaim: vi.fn(async () => undefined),
  lockClaim: vi.fn(async () => undefined),
  unlockClaim: vi.fn(async () => undefined),
  updateSensitivity: vi.fn(async () => undefined),
  clearToast: vi.fn(),
  refetch: vi.fn(async () => undefined),
};

vi.mock("@/hooks/useClaims", () => ({
  useClaims: () => hookState,
}));

describe("MemoryBrowser", () => {
  it("renders search input", () => {
    renderWithRouter();
    expect(screen.getByLabelText("memory-search")).toBeInTheDocument();
  });

  it("renders loading spinner on initial load (no claims yet)", () => {
    hookState.loading = true;
    hookState.claims = [];
    hookState.filteredClaims = [];
    renderWithRouter();
    expect(screen.getByLabelText("loading")).toBeInTheDocument();
    hookState.loading = false;
    hookState.claims = [mockClaimTentative];
    hookState.filteredClaims = [mockClaimTentative];
  });

  it("renders empty state when no claims match filters", () => {
    hookState.filteredClaims = [];
    renderWithRouter();
    expect(screen.getByText(/No memories match these filters yet\./)).toBeInTheDocument();
    hookState.filteredClaims = [mockClaimTentative];
  });

  it("calls selectClaim when card is clicked", async () => {
    hookState.selectClaim.mockClear();
    renderWithRouter();
    const claimButton = screen.getAllByRole("button").find((button) =>
      button.textContent?.includes("Preference: dark mode"),
    );
    expect(claimButton).toBeDefined();
    await userEvent.click(claimButton as HTMLButtonElement);
    expect(hookState.selectClaim).toHaveBeenCalledWith(mockClaimTentative);
  });

  it("renders toast message when present", () => {
    hookState.toast = { message: "Conflict", type: "error" };
    renderWithRouter();
    expect(screen.getByText("Conflict")).toBeInTheDocument();
    hookState.toast = null;
  });

  it("applies a search term from the URL (cross-link from a confirmed proposal)", () => {
    renderWithRouter(["/memory?search=dark%20mode"]);
    expect(hookState.setSearchQuery).toHaveBeenCalledWith("dark mode");
  });
});
