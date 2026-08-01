import { NavLink } from "react-router-dom";
import { usePendingProposalsCount } from "@/hooks/usePendingProposalsCount";

const navItems = [
  { to: "/", label: "Chat" },
  { to: "/memory", label: "Memory" },
  { to: "/proposals", label: "Proposals" },
  { to: "/audit", label: "Audit" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/calendar", label: "Calendar" },
  { to: "/mail", label: "Mail" },
  { to: "/projects", label: "Projects" },
  { to: "/contacts", label: "Contacts" },
  { to: "/settings", label: "Settings" },
];

type SidebarProps = {
  onNavigate?: () => void;
};

function Sidebar({ onNavigate }: SidebarProps): JSX.Element {
  const pendingProposals = usePendingProposalsCount();

  return (
    <div className="glass-card flex h-full w-full flex-col gap-2 p-4 md:min-h-[calc(100vh-2rem)] md:w-64">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
              isActive ? "bg-blue-700/50 text-blue-100" : "text-gray-200 hover:bg-gray-800/80"
            }`
          }
        >
          <span>{item.label}</span>
          {item.to === "/proposals" && pendingProposals > 0 ? (
            <span
              aria-label={`${pendingProposals} pending proposals`}
              className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white"
            >
              {pendingProposals}
            </span>
          ) : null}
        </NavLink>
      ))}
    </div>
  );
}

export default Sidebar;
