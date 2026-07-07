import { render, screen } from "@testing-library/react";
import ProviderUsageChart from "@/components/dashboard/ProviderUsageChart";

describe("ProviderUsageChart", () => {
  it("renders one bar per provider", () => {
    const { container } = render(
      <ProviderUsageChart usage={{ deepseek: 5, gemini: 3, openai: 2, ollama: 1 }} />,
    );
    expect(container.querySelectorAll(".recharts-bar-rectangle").length).toBe(4);
  });

  it("shows empty text when usage is empty", () => {
    render(<ProviderUsageChart usage={{}} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });
});
