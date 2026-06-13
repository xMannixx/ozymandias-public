import { Outlet } from "react-router-dom";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

function AppShell(): JSX.Element {
  return (
    <div className="min-h-screen p-4 md:flex md:gap-4">
      <div className="mb-4 md:mb-0 md:shrink-0">
        <Sidebar />
      </div>
      <main className="w-full">
        <TopBar />
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default AppShell;
