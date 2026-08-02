import { useState } from "react";
import { Brain, ScrollText } from "lucide-react";
import BehavioralRulesReview from "@/components/memory/BehavioralRulesReview";
import MemoryBrowser from "@/components/memory/MemoryBrowser";

type MemoryTab = "memories" | "rules";

const tabs: { id: MemoryTab; label: string; icon: typeof Brain }[] = [
  { id: "memories", label: "What it knows", icon: Brain },
  { id: "rules", label: "How it behaves", icon: ScrollText },
];

function MemoryPage(): JSX.Element {
  const [tab, setTab] = useState<MemoryTab>("memories");

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Memory sections"
        className="flex flex-wrap gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1"
      >
        {tabs.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`memory-tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`memory-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive ? "bg-white/[0.07] text-white" : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`memory-panel-${tab}`} aria-labelledby={`memory-tab-${tab}`}>
        {tab === "memories" ? <MemoryBrowser /> : <BehavioralRulesReview />}
      </div>
    </div>
  );
}

export default MemoryPage;
