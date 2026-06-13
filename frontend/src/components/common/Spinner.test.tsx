import { render, screen } from "@testing-library/react";
import Spinner from "@/components/common/Spinner";

describe("Spinner", () => {
  it("renders loading indicator", () => {
    render(<Spinner />);
    expect(screen.getByLabelText("loading")).toBeInTheDocument();
  });
});
