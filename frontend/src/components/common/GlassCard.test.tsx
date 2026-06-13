import { render, screen } from "@testing-library/react";
import GlassCard from "@/components/common/GlassCard";

describe("GlassCard", () => {
  it("applies glassmorphism classes", () => {
    render(<GlassCard>content</GlassCard>);
    const card = screen.getByText("content").closest("section");
    expect(card).toHaveClass("glass-card");
  });

  it("renders children", () => {
    render(
      <GlassCard>
        <p>child-text</p>
      </GlassCard>,
    );
    expect(screen.getByText("child-text")).toBeInTheDocument();
  });
});
