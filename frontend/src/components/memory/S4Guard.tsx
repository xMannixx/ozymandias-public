import { useState, type PropsWithChildren } from "react";
import { Eye, ShieldCheck } from "lucide-react";
import Button from "@/components/common/Button";

type S4GuardProps = PropsWithChildren<{
  isS4: boolean;
}>;

function S4Guard({ isS4, children }: S4GuardProps): JSX.Element {
  const [revealed, setRevealed] = useState(false);

  if (!isS4) {
    return <>{children}</>;
  }

  if (!revealed) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-4">
        <div className="flex gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm text-rose-100">
              This is intimate (S4) content. It is hidden by default and never leaves your local device.
            </p>
            <p className="text-xs text-rose-200/70">
              Nothing here is sent to a cloud provider, not even when you reveal it.
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => setRevealed(true)}>
          <Eye className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Show content
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/[0.08] px-2 py-0.5 text-xs text-rose-200">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        Intimate (S4) content visible
      </div>
      {children}
    </div>
  );
}

export default S4Guard;
