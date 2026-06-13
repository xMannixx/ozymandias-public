import { getDashboardStats } from "@/api/stats";
import { mockDashboardStats } from "@/test/fixtures";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api/stats", () => {
  it("getDashboardStats sends GET /stats and returns data", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(makeJsonResponse(mockDashboardStats));

    const result = await getDashboardStats();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/stats");
    expect(result.claims_total).toBe(mockDashboardStats.claims_total);
  });
});
