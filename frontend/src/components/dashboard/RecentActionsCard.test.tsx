import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RecentActionsCard from "@/components/dashboard/RecentActionsCard";
import { mockAuditList } from "@/test/fixtures";

describe("RecentActionsCard", () => {
  it("shows maximum 10 entries", () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      ...mockAuditList[0],
      audit_id: `audit-${index}`,
      event_type: `event_${index}`,
    }));

    render(
      <MemoryRouter>
        <RecentActionsCard entries={entries} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });

  it("contains link to /audit", () => {
    render(
      <MemoryRouter>
        <RecentActionsCard entries={mockAuditList} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/audit");
  });
});
