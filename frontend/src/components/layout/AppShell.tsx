import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

function AppShell(): JSX.Element {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen md:flex">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] text-[13px] font-semibold text-white">
            O
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">Ozymandias</span>
        </div>
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          aria-controls="primary-navigation"
          onClick={() => setNavOpen((open) => !open)}
          className="inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] p-2 text-zinc-300 hover:bg-white/[0.05]"
        >
          {navOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <nav
        id="primary-navigation"
        aria-label="Primary"
        className={`${
          navOpen ? "block" : "hidden"
        } border-b border-white/[0.06] md:block md:shrink-0 md:border-b-0 md:border-r`}
      >
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </nav>

      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 px-4 py-4 focus:outline-none md:px-6 md:py-5"
      >
        <TopBar />
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default AppShell;
