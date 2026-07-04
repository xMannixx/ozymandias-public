import { useState } from "react";
import Button from "@/components/common/Button";
import BehavioralRulesReview from "@/components/memory/BehavioralRulesReview";
import MemoryBrowser from "@/components/memory/MemoryBrowser";

type MemoryTab = "memories" | "rules";

function MemoryPage(): JSX.Element {
  const [tab, setTab] = useState<MemoryTab>("memories");

  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-wrap gap-2 p-2">
        <Button variant={tab === "memories" ? "primary" : "ghost"} onClick={() => setTab("memories")}>
          Memories
        </Button>
        <Button variant={tab === "rules" ? "primary" : "ghost"} onClick={() => setTab("rules")}>
          Behavior rules
        </Button>
      </div>

      {tab === "memories" ? <MemoryBrowser /> : <BehavioralRulesReview />}
    </div>
  );
}

export default MemoryPage;
