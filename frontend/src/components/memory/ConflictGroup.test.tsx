import { render, screen } from "@testing-library/react";
import ConflictGroup from "@/components/memory/ConflictGroup";

describe("ConflictGroup", () => {
  it("renders nothing without conflict group id", () => {
    const { container } = render(<ConflictGroup />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders warning badge with conflict id", () => {
    render(<ConflictGroup conflictGroupId="cg-42" />);
    expect(screen.getByText("Konfliktgruppe aktiv: cg-42")).toBeInTheDocument();
  });

  it("renders tooltip title for badge", () => {
    render(<ConflictGroup conflictGroupId="cg-99" />);
    expect(screen.getByTitle("Dieser Claim ist Teil einer Konfliktgruppe.")).toBeInTheDocument();
  });
});
