import BehavioralRulesReview from "@/components/memory/BehavioralRulesReview";
import MemoryBrowser from "@/components/memory/MemoryBrowser";

function MemoryPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <MemoryBrowser />
      <BehavioralRulesReview />
    </div>
  );
}

export default MemoryPage;
