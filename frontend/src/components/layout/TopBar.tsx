import ModeIndicator from "@/components/layout/ModeIndicator";
import { useAuth } from "@/store/auth";

function TopBar(): JSX.Element {
  const { token } = useAuth();
  const shortToken = token ? `${token.slice(0, 6)}...` : "guest";

  return (
    <header className="glass-card mb-4 flex items-center justify-between px-4 py-3">
      <h1 className="text-lg font-semibold text-blue-300">Ozymandias</h1>
      <div className="flex items-center gap-3">
        <ModeIndicator />
        <span className="mono text-xs text-gray-300">{shortToken}</span>
      </div>
    </header>
  );
}

export default TopBar;
