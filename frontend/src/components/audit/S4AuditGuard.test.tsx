import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import S4AuditGuard from "@/components/audit/S4AuditGuard";

describe("S4AuditGuard", () => {
  it("toggle is off by default", () => {
    render(<S4AuditGuard enabled={false} onEnable={vi.fn()} onDisable={vi.fn()} />);
    expect(screen.getByLabelText("s4-toggle")).not.toBeChecked();
  });

  it("turning on opens confirmation dialog", async () => {
    render(<S4AuditGuard enabled={false} onEnable={vi.fn()} onDisable={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("s4-toggle"));
    expect(screen.getByRole("dialog", { name: "s4-confirm-dialog" })).toBeInTheDocument();
  });

  it("confirming calls onEnable", async () => {
    const onEnable = vi.fn();
    render(<S4AuditGuard enabled={false} onEnable={onEnable} onDisable={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("s4-toggle"));
    await userEvent.click(screen.getByRole("button", { name: "Anzeigen" }));
    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it("cancel keeps hidden state", async () => {
    const onEnable = vi.fn();
    render(<S4AuditGuard enabled={false} onEnable={onEnable} onDisable={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("s4-toggle"));
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(screen.queryByRole("dialog", { name: "s4-confirm-dialog" })).not.toBeInTheDocument();
    expect(onEnable).not.toHaveBeenCalled();
  });
});
