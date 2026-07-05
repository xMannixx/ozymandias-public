import { render, screen } from "@testing-library/react";
import ClaimsSummary from "@/components/dashboard/ClaimsSummary";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe("ClaimsSummary", () => {
  it("shows claims_total", () => {
    render(<ClaimsSummary claimsTotal={12} verification={{ tentative: 4, confirmed: 6 }} sensitivity={{ S0: 2 }} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders verification distribution bars", () => {
    render(<ClaimsSummary claimsTotal={12} verification={{ tentative: 4, confirmed: 6, superseded: 1, retracted: 1 }} sensitivity={{ S0: 2, S1: 2 }} />);
    expect(screen.getByText("Tentative")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });
});
