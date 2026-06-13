import { NavLink } from "react-router-dom";

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

function Sidebar(): JSX.Element {
  return (
    <aside className="glass-card h-full min-h-[calc(100vh-2rem)] w-full p-4 md:w-64">
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm transition ${
                isActive ? "bg-blue-700/50 text-blue-100" : "text-gray-200 hover:bg-gray-800/80"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
