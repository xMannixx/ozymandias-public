import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";

const usePendingProposalsCountMock = vi.fn();

vi.mock("@/hooks/usePendingProposalsCount", () => ({
  usePendingProposalsCount: () => usePendingProposalsCountMock(),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    usePendingProposalsCountMock.mockReset();
    usePendingProposalsCountMock.mockReturnValue(0);
  });

  it("renders all main nav links", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    ["Chat", "Memory", "Proposals", "Audit", "Dashboard", "Calendar", "Mail", "Projects", "Contacts", "Settings"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("highlights active route", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard").closest("a")).toHaveClass("bg-blue-700/50");
  });

  it("does not show a proposals badge when there are no pending proposals", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText(/pending proposals/)).not.toBeInTheDocument();
  });

  it("shows a badge with the pending proposal count", () => {
    usePendingProposalsCountMock.mockReturnValue(3);
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("3 pending proposals")).toHaveTextContent("3");
  });
});
