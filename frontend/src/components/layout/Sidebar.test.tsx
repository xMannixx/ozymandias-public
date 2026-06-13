import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";

describe("Sidebar", () => {
  it("renders all main nav links", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    ["Chat", "Memory", "Proposals", "Audit", "Dashboard", "Calendar", "Mail", "Projects", "Contacts", "Settings"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("highlights active route", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard")).toHaveClass("bg-blue-700/50");
  });
});
