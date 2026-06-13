import { render, screen } from "@testing-library/react";
import Badge from "@/components/common/Badge";

describe("Badge", () => {
  it("renders S0-S4 labels", () => {
    ["S0", "S1", "S2", "S3", "S4"].forEach((value) => {
      render(<Badge sensitivity={value} />);
      expect(screen.getByText(value)).toBeInTheDocument();
    });
  });

  it("highlights S4 with purple ring", () => {
    render(<Badge sensitivity="S4" />);
    expect(screen.getByText("S4")).toHaveClass("ring-1");
  });

  it("falls back to default style for unknown values", () => {
    render(<Badge sensitivity="UNKNOWN" />);
    expect(screen.getByText("UNKNOWN")).toHaveClass("bg-green-700");
  });
});
