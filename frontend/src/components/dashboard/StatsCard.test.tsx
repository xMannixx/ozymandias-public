import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatsCard from "@/components/dashboard/StatsCard";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("StatsCard", () => {
  it("renders number and label", () => {
    render(<StatsCard value={42} label="Total claims" to="/memory" />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Total claims")).toBeInTheDocument();
  });

  it("click navigates to target url", async () => {
    navigateMock.mockClear();
    render(<StatsCard value={1} label="Proposals" to="/proposals" />);
    await userEvent.click(screen.getByText("Proposals"));
    expect(navigateMock).toHaveBeenCalledWith("/proposals");
  });

  it("null value renders 0", () => {
    render(<StatsCard value={null} label="Null Test" />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
