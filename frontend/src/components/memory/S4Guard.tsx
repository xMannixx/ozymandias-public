import { useState, type PropsWithChildren } from "react";
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
      <div className="rounded border border-purple-600 bg-purple-950/40 p-3">
        <p className="mb-2 text-sm text-purple-100">
          This is intimate (S4) content. It is hidden by default and never leaves your local device.
        </p>
        <Button variant="ghost" onClick={() => setRevealed(true)}>
          Show content
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded border border-purple-600 bg-purple-950/30 px-2 py-1 text-xs text-purple-100">
        Intimate (S4) content visible
      </div>
      {children}
    </div>
  );
}

export default S4Guard;
