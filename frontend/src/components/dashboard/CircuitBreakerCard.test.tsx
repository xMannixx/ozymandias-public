import { render, screen } from "@testing-library/react";
import CircuitBreakerCard from "@/components/dashboard/CircuitBreakerCard";
import { mockDashboardStats } from "@/test/fixtures";

describe("CircuitBreakerCard", () => {
  it("shows green OK status when not tripped", () => {
    render(<CircuitBreakerCard status={{ ...mockDashboardStats.circuit_breaker, is_tripped: false }} />);
    expect(screen.getByText("OK")).toHaveClass("bg-green-700");
  });

  it("shows red TRIPPED status when tripped", () => {
    render(<CircuitBreakerCard status={{ ...mockDashboardStats.circuit_breaker, is_tripped: true }} />);
    expect(screen.getByText("TRIPPED")).toHaveClass("bg-red-700");
  });

  it("shows progress count current/max", () => {
    render(<CircuitBreakerCard status={{ ...mockDashboardStats.circuit_breaker, current_count: 3, max_actions: 10 }} />);
    expect(screen.getByText("3/10")).toBeInTheDocument();
  });
});
