import { ReactNode, useEffect } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

function Modal({ open, onClose, title, children }: ModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      data-testid="modal-overlay"
    >
      <div
        className="glass-card max-h-[90vh] w-full max-w-xl overflow-y-auto border border-blue-500/30 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Dialog"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {title ? <h3 className="mb-3 text-lg font-semibold text-blue-200">{title}</h3> : null}
        {children}
      </div>
    </div>
  );
}

export default Modal;
