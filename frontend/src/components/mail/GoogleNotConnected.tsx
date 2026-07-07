import { Link } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";

function GoogleNotConnected(): JSX.Element {
  return (
    <GlassCard className="mx-auto max-w-xl space-y-2 text-center">
      <h2 className="text-lg font-semibold text-orange-200">Google not connected</h2>
      <p className="text-sm text-gray-300">Please connect your Google account in Settings.</p>
      <Link
        to="/settings"
        className="inline-flex rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 hover:bg-gray-800"
      >
        Go to Settings
      </Link>
    </GlassCard>
  );
}

export default GoogleNotConnected;
