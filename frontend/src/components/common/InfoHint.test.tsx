import { render, screen } from "@testing-library/react";
import InfoHint from "@/components/common/InfoHint";

describe("InfoHint", () => {
  it("renders a labelled affordance with the explanation as tooltip content", () => {
    render(<InfoHint text="Explains the term." />);
    expect(screen.getByRole("button", { name: "More information" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Explains the term.");
  });

  it("supports a custom accessible label", () => {
    render(<InfoHint text="Details." label="Explain sensitivity" />);
    expect(screen.getByRole("button", { name: "Explain sensitivity" })).toBeInTheDocument();
  });
});
