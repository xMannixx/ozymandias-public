import { useState } from "react";
import { Outlet } from "react-router-dom";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

function AppShell(): JSX.Element {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen p-4 md:flex md:gap-4">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="mb-4 flex items-center justify-between md:hidden">
        <h1 className="text-lg font-semibold text-blue-300">Ozymandias</h1>
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          aria-controls="primary-navigation"
          onClick={() => setNavOpen((open) => !open)}
          className="glass-card rounded-md px-3 py-2 text-sm text-gray-200"
        >
          {navOpen ? "Close" : "Menu"}
        </button>
      </div>
      <nav
        id="primary-navigation"
        aria-label="Primary"
        className={`${navOpen ? "block" : "hidden"} mb-4 md:mb-0 md:block md:shrink-0`}
      >
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </nav>
      <main id="main-content" tabIndex={-1} className="w-full focus:outline-none">
        <TopBar />
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default AppShell;
