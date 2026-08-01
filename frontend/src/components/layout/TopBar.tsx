import { UserCircle2 } from "lucide-react";
import ModeIndicator from "@/components/layout/ModeIndicator";
import { useAuth } from "@/store/auth";

function TopBar(): JSX.Element {
  const { isAuthenticated } = useAuth();

  return (
    <header className="mb-6 flex items-center justify-end gap-3 border-b border-white/[0.06] pb-3">
      <ModeIndicator />
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-xs text-zinc-300"
        title={isAuthenticated ? "Signed in" : "Guest"}
      >
        <UserCircle2 className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
        {isAuthenticated ? "Signed in" : "Guest"}
      </span>
    </header>
  );
}

export default TopBar;
