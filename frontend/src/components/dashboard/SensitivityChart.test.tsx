import { render, screen } from "@testing-library/react";
import SensitivityChart from "@/components/dashboard/SensitivityChart";

describe("SensitivityChart", () => {
  it("renders donut chart with five segments", () => {
    const { container } = render(<SensitivityChart values={{ S0: 1, S1: 2, S2: 3, S3: 4, S4: 5 }} />);
    expect(container.querySelectorAll(".recharts-sector").length).toBe(5);
  });

  it("legend shows all sensitivity levels", () => {
    render(<SensitivityChart values={{ S0: 1, S1: 2, S2: 3, S3: 4, S4: 5 }} />);
    expect(screen.getByText("S0")).toBeInTheDocument();
    expect(screen.getByText("S1")).toBeInTheDocument();
    expect(screen.getByText("S2")).toBeInTheDocument();
    expect(screen.getByText("S3")).toBeInTheDocument();
    expect(screen.getByText("S4")).toBeInTheDocument();
  });
});
