import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastProps = {
  message: string;
  type?: ToastType;
  timeoutMs?: number;
};

const toneClass: Record<ToastType, string> = {
  success: "bg-green-900/80 text-green-100 border-green-600",
  error: "bg-red-900/80 text-red-100 border-red-600",
  info: "bg-blue-900/80 text-blue-100 border-blue-600",
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

  return (
    <div role="status" className={`rounded-md border px-3 py-2 text-sm ${toneClass[type]}`}>
      {message}
    </div>
  );
}

export default Toast;
