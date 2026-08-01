import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsageSummary from "@/components/dashboard/UsageSummary";
import { mockUsageReport } from "@/test/fixtures";

const navigateMock = vi.fn();
const getUsageReportMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/api/usage", () => ({
  getUsageReport: (...args: unknown[]) => getUsageReportMock(...args),
}));

describe("UsageSummary", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    getUsageReportMock.mockReset();
    getUsageReportMock.mockResolvedValue(mockUsageReport);
  });

  it("shows what the last 24 hours cost", async () => {
    render(<UsageSummary />);

    expect(await screen.findByText("$1.50")).toBeInTheDocument();
    expect(screen.getByText("24k tokens")).toBeInTheDocument();
    expect(screen.getByText("10.0% of 10 calls failed")).toBeInTheDocument();
    expect(getUsageReportMock).toHaveBeenCalledWith("24h");
  });

  it("opens the usage page", async () => {
    const user = userEvent.setup();
    render(<UsageSummary />);
    await screen.findByText("$1.50");

    await user.click(screen.getByTestId("usage-summary-card"));
    expect(navigateMock).toHaveBeenCalledWith("/usage");
  });

  it("says so when usage cannot be loaded", async () => {
    getUsageReportMock.mockRejectedValue(new Error("offline"));
    render(<UsageSummary />);

    expect(await screen.findByText("Usage unavailable. offline")).toBeInTheDocument();
  });
});
