import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastProps = {
  message: string;
  type?: ToastType;
  timeoutMs?: number;
};

const toneClass: Record<ToastType, string> = {
  success: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
  error: "border-red-400/30 bg-red-500/15 text-red-100",
  info: "border-indigo-400/30 bg-indigo-500/15 text-indigo-100",
};

function Toast({ message, type = "info", timeoutMs = 3000 }: ToastProps): JSX.Element | null {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [timeoutMs]);

  if (!visible) {
    return null;
  }

  const role = type === "error" ? "alert" : "status";
  const ariaLive = type === "error" ? "assertive" : "polite";

  // Fixed to the viewport: views render the toast at the top of a long page,
  // so an inline toast stayed unseen whenever the action happened further down.
  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur ${toneClass[type]}`}
    >
      {message}
    </div>
  );
}

export default Toast;
