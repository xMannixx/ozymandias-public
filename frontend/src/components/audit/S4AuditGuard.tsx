import { useState } from "react";
import Button from "@/components/common/Button";

type S4AuditGuardProps = {
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
};

function S4AuditGuard({ enabled, onEnable, onDisable }: S4AuditGuardProps): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggle = (): void => {
    if (enabled) {
      onDisable();
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-gray-200">
        <input
          aria-label="s4-toggle"
          type="checkbox"
          checked={enabled}
          onChange={toggle}
          className="h-4 w-4 accent-purple-500"
        />
        Show S4 audit entries
      </label>

      {confirmOpen ? (
        <div role="dialog" aria-label="s4-confirm-dialog" className="glass-card space-y-2 p-3">
          <p className="text-sm text-purple-100">
            S4 audit entries contain sensitive actions. Show them?
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                onEnable();
                setConfirmOpen(false);
              }}
            >
              Show
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default S4AuditGuard;
