import type { ComponentType, SVGProps } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Bell,
  Brain,
  Calendar,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { usePendingProposalsCount } from "@/hooks/usePendingProposalsCount";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type NavGroup = {
  label: string;
  items: Array<{ to: string; label: string; icon: IconComponent }>;
};

const navGroups: NavGroup[] = [
  {
    label: "Talk",
    items: [{ to: "/", label: "Chat", icon: MessageSquare }],
  },
  {
    label: "Knowledge",
    items: [
      { to: "/memory", label: "Memory", icon: Brain },
      { to: "/proposals", label: "Proposals", icon: Sparkles },
      { to: "/audit", label: "Audit", icon: Activity },
    ],
  },
  {
    label: "Life",
    items: [
      { to: "/calendar", label: "Calendar", icon: Calendar },
      { to: "/mail", label: "Mail", icon: Inbox },
      { to: "/projects", label: "Projects", icon: FolderKanban },
      { to: "/contacts", label: "Contacts", icon: Users },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

type SidebarProps = {
  onNavigate?: () => void;
};

function Sidebar({ onNavigate }: SidebarProps): JSX.Element {
  const pendingProposals = usePendingProposalsCount();

  return (
    <div className="flex h-full w-full flex-col gap-6 px-2 py-3 md:min-h-[calc(100vh-2rem)] md:w-56">
      <div className="hidden items-center gap-2 px-3 md:flex">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] text-[13px] font-semibold text-white">
          O
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">Ozymandias</span>
      </div>

      <nav className="flex flex-col gap-5">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isProposals = item.to === "/proposals";
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-white/[0.06] text-white"
                        : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                          }`}
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </span>
                      {isProposals && pendingProposals > 0 ? (
                        <span
                          aria-label={`${pendingProposals} pending proposals`}
                          className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-500/20 px-1.5 text-[11px] font-medium text-indigo-200"
                        >
                          {pendingProposals}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto hidden px-3 md:block">
        <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-400">
          <Bell className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
          <span>All quiet</span>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
