import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import S4Guard from "@/components/memory/S4Guard";

describe("S4Guard", () => {
  it("renders children immediately for non-S4 content", () => {
    render(
      <S4Guard isS4={false}>
        <p>visible-content</p>
      </S4Guard>,
    );
    expect(screen.getByText("visible-content")).toBeInTheDocument();
  });

  it("hides children for S4 by default", () => {
    render(
      <S4Guard isS4>
        <p>hidden-content</p>
      </S4Guard>,
    );
    expect(screen.queryByText("hidden-content")).not.toBeInTheDocument();
    expect(screen.getByText(/hidden by default/)).toBeInTheDocument();
  });

  it("shows reveal button for S4", () => {
    render(
      <S4Guard isS4>
        <p>hidden-content</p>
      </S4Guard>,
    );
    expect(screen.getByRole("button", { name: "Show content" })).toBeInTheDocument();
  });

  it("reveals content after confirmation click", async () => {
    render(
      <S4Guard isS4>
        <p>hidden-content</p>
      </S4Guard>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show content" }));
    expect(screen.getByText("hidden-content")).toBeInTheDocument();
  });

  it("renders visible indicator after reveal", async () => {
    render(
      <S4Guard isS4>
        <p>hidden-content</p>
      </S4Guard>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show content" }));
    expect(screen.getByText("Intimate (S4) content visible")).toBeInTheDocument();
  });
});
