import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsageView from "@/components/usage/UsageView";
import { mockUsageReport } from "@/test/fixtures";

const getUsageReportMock = vi.fn();

vi.mock("@/api/usage", () => ({
  getUsageReport: (...args: unknown[]) => getUsageReportMock(...args),
}));

describe("UsageView", () => {
  beforeEach(() => {
    getUsageReportMock.mockReset();
    getUsageReportMock.mockResolvedValue(mockUsageReport);
  });

  it("shows the report for the default range", async () => {
    render(<UsageView />);

    expect(await screen.findByText("20k in, 4.0k out")).toBeInTheDocument();
    expect(getUsageReportMock).toHaveBeenCalledWith("24h");
    expect(screen.getByText("deepseek-chat")).toBeInTheDocument();
    expect(screen.getByText("TimeoutError")).toBeInTheDocument();
  });

  it("reloads when the range changes", async () => {
    const user = userEvent.setup();
    render(<UsageView />);
    await screen.findByText("20k in, 4.0k out");

    await user.click(screen.getByRole("button", { name: "Last 7 days" }));

    await waitFor(() => {
      expect(getUsageReportMock).toHaveBeenCalledWith("7d");
    });
  });

  it("says recording starts now instead of showing bare zeros", async () => {
    getUsageReportMock.mockResolvedValue({
      ...mockUsageReport,
      totals: { ...mockUsageReport.totals, calls: 0 },
    });
    render(<UsageView />);

    expect(await screen.findByText("No calls recorded in this range")).toBeInTheDocument();
  });

  it("offers a retry when the request fails", async () => {
    getUsageReportMock.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(<UsageView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");

    getUsageReportMock.mockResolvedValue(mockUsageReport);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("20k in, 4.0k out")).toBeInTheDocument();
  });
});

