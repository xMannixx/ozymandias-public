import { listAuditEntries } from "@/api/audit";
import { mockAuditList } from "@/test/fixtures";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api/audit", () => {
  it("listAuditEntries sends GET /audit", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse({
        entries: mockAuditList,
        total: 10,
        limit: 50,
        offset: 0,
      }),
    );

    await listAuditEntries();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/audit");
  });

  it("sends event_type query parameter", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse({
        entries: [],
        total: 0,
        limit: 50,
        offset: 0,
      }),
    );

    await listAuditEntries({ event_type: "memory_confirmed" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/audit?event_type=memory_confirmed");
  });

  it("sends sensitivity=S4 when requested", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse({
        entries: [],
        total: 0,
        limit: 50,
        offset: 0,
      }),
    );

    await listAuditEntries({ sensitivity: "S4" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/audit?sensitivity=S4");
  });
});
