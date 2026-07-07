import { render, screen } from "@testing-library/react";
import ConflictGroup from "@/components/memory/ConflictGroup";

describe("ConflictGroup", () => {
  it("renders nothing without a conflict group id", () => {
    const { container } = render(<ConflictGroup />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a plain-language warning with a resolve hint", () => {
    render(<ConflictGroup conflictGroupId="cg-42" relatedCount={2} />);
    expect(screen.getByText("2 memories look like they conflict or duplicate each other.")).toBeInTheDocument();
    expect(screen.getByText(/To resolve:/)).toBeInTheDocument();
  });

  it("falls back to singular wording when related count is not provided", () => {
    render(<ConflictGroup conflictGroupId="cg-99" />);
    expect(screen.getByText("This memory may conflict with another one.")).toBeInTheDocument();
  });
});
