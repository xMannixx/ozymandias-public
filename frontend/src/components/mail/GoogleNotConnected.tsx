import { Link } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";

function GoogleNotConnected(): JSX.Element {
  return (
    <GlassCard className="mx-auto max-w-2xl space-y-3 p-6">
      <h2 className="text-lg font-semibold text-orange-200">Google is not connected yet</h2>
      <p className="text-sm text-gray-300">
        This view uses Gmail and Google Calendar. Connect a Google account once and Ozymandias will
        show your emails, events, and let you draft replies without leaving the app.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-300">
        <li>Open Settings.</li>
        <li>Scroll to <span className="font-medium text-gray-100">Voice &amp; Google</span>.</li>
        <li>
          Choose <span className="font-medium text-gray-100">Sign in with Google</span> and pick the
          account you want to link.
        </li>
      </ol>
      <p className="text-xs text-gray-400">
        Nothing is sent to third parties. Ozymandias stores only what you approve as a memory.
      </p>
      <Link
        to="/settings#settings-integrations"
        className="inline-flex rounded-md border border-cyan-500/30 bg-slate-900/60 px-3 py-2 text-sm font-medium text-gray-100 hover:border-cyan-400/60 hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
      >
        Open Settings to connect Google
      </Link>
    </GlassCard>
  );
}

export default GoogleNotConnected;
