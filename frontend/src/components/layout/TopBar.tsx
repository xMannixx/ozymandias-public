import ModeIndicator from "@/components/layout/ModeIndicator";
import { useAuth } from "@/store/auth";

function TopBar(): JSX.Element {
  const { isAuthenticated } = useAuth();

  return (
    <header className="glass-card mb-4 flex items-center justify-between px-4 py-3">
      <h1 className="text-lg font-semibold text-blue-300">Ozymandias</h1>
      <div className="flex items-center gap-3">
        <ModeIndicator />
        <span className="flex items-center gap-1.5 text-xs text-gray-300">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${isAuthenticated ? "bg-emerald-400" : "bg-gray-500"}`}
          />
          {isAuthenticated ? "Signed in" : "Guest"}
        </span>
      </div>
    </header>
  );
}

export default TopBar;
