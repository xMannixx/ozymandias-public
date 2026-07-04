import { render, screen } from "@testing-library/react";
import SensitivityChip from "@/components/common/SensitivityChip";

describe("SensitivityChip", () => {
  it("renders the code and the human label", () => {
    render(<SensitivityChip sensitivity="S3" />);
    expect(screen.getAllByText(/S3/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Confidential/).length).toBeGreaterThan(0);
  });

  it("exposes the full explanation via the tooltip", () => {
    render(<SensitivityChip sensitivity="S4" />);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/never sent to the cloud/i);
  });

  it("falls back gracefully for an unknown sensitivity value", () => {
    render(<SensitivityChip sensitivity="S9" />);
    expect(screen.getByText(/S9/)).toBeInTheDocument();
  });
});
