import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuditEntry from "@/components/audit/AuditEntry";
import { mockAuditMemoryConfirmed, mockAuditTurnProcessed } from "@/test/fixtures";

describe("AuditEntry", () => {
  it("renders timestamp text", () => {
    render(<AuditEntry entry={mockAuditTurnProcessed} />);
    expect(screen.getByTitle(mockAuditTurnProcessed.created_at)).toBeInTheDocument();
  });

  it("shows event icon mapping for turn_processed and memory_confirmed", () => {
    const { rerender } = render(<AuditEntry entry={mockAuditTurnProcessed} />);
    expect(screen.getByTestId("event-icon")).toHaveTextContent("chat");

    rerender(<AuditEntry entry={mockAuditMemoryConfirmed} />);
    expect(screen.getByTestId("event-icon")).toHaveTextContent("brain");
  });

  it("shows result badge tone for success and blocked", () => {
    const blocked = { ...mockAuditTurnProcessed, result: "blocked" };
    const { rerender } = render(<AuditEntry entry={mockAuditTurnProcessed} />);
    expect(screen.getByText("success")).toHaveClass("bg-green-700");

    rerender(<AuditEntry entry={blocked} />);
    expect(screen.getByText("blocked")).toHaveClass("bg-orange-700");
  });

  it("shows sensitivity badge", () => {
    render(<AuditEntry entry={mockAuditTurnProcessed} />);
    expect(screen.getByText("S0")).toBeInTheDocument();
  });

  it("is expandable and renders formatted payload json", async () => {
    render(<AuditEntry entry={mockAuditTurnProcessed} />);
    await userEvent.click(screen.getByRole("button", { name: "Payload anzeigen" }));
    expect(screen.getByText(/"provider": "deepseek"/)).toBeInTheDocument();
  });

  it("is not expandable when payload is null", () => {
    const withoutPayload = { ...mockAuditTurnProcessed, payload: null };
    render(<AuditEntry entry={withoutPayload} />);
    expect(screen.queryByRole("button", { name: "Payload anzeigen" })).not.toBeInTheDocument();
  });

  it("shows channel badge", () => {
    render(<AuditEntry entry={mockAuditTurnProcessed} />);
    expect(screen.getByText("web")).toBeInTheDocument();
  });
});
