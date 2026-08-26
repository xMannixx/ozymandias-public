import {
  ArrowUpRight,
  Brain,
  Calendar,
  CheckSquare,
  FolderOpen,
  Inbox,
  ListTodo,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  Sunrise,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChatStarter } from "@/api/types";
import { useChatStarters } from "@/hooks/useChatStarters";

const icons: Record<string, LucideIcon> = {
  briefing: Sunrise,
  calendar: Calendar,
  chat: MessageSquare,
  idea: Sparkles,
  mail: Mail,
  memory: Brain,
  plan: ListTodo,
  project: FolderOpen,
  proposals: Inbox,
  search: Search,
  tasks: CheckSquare,
};

/** Shown while the suggestions load, and if the request fails. */
const fallback: ChatStarter[] = [
  {
    id: "remember",
    icon: "memory",
    title: "Remember something",
    prompt: "Remember that I prefer coffee without sugar.",
  },
  {
    id: "brainstorm",
    icon: "idea",
    title: "Brainstorm an idea",
    prompt: "Give me three ideas to speed up my morning routine.",
  },
  {
    id: "plan",
    icon: "plan",
    title: "Plan a task",
    prompt: "Help me draft a plan for a two-day trip to Amsterdam.",
  },
  {
    id: "recall",
    icon: "search",
    title: "Recall context",
    prompt: "What do you remember about my current projects?",
  },
];

type ChatEmptyStateProps = {
  onPromptClick: (prompt: string) => void;
};

function ChatEmptyState({ onPromptClick }: ChatEmptyStateProps): JSX.Element {
  const { starters, loading, refetch } = useChatStarters();
  const shown = starters.length > 0 ? starters : fallback;

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] text-lg font-semibold tracking-tight text-white"
        >
          O
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">What can I help with?</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Ask a question, save a memory, or plan something. Ozymandias remembers what matters.
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {shown.map((starter) => {
          const Icon = icons[starter.icon] ?? Sparkles;
          return (
            <button
              key={starter.id}
              type="button"
              onClick={() => onPromptClick(starter.prompt)}
              className="group flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-zinc-400 group-hover:text-zinc-200">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium text-zinc-100">
                  {starter.title}
                  <ArrowUpRight
                    className="h-3 w-3 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">
                  {starter.prompt}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void refetch()}
        disabled={loading}
        className="mt-4 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
        Other suggestions
      </button>
    </div>
  );
}

export default ChatEmptyState;
