import { approveProposal, listProposals, rejectProposal } from "@/api/proposals";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api/proposals", () => {
  it("lists proposals without params", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse([]));

    await listProposals();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/proposals");
  });

  it("sends status filter and pagination params", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse([]));

    await listProposals({ status: "pending", limit: 10, offset: 30 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/proposals?status=pending&limit=10&offset=30");
  });

  it("returns ProposalResponse for approve/reject", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockImplementation(async () => makeJsonResponse({ proposal_id: "p1", status: "confirmed" }));

    await approveProposal("p1");
    await rejectProposal("p1", "reason");

    expect(fetchMock.mock.calls[0][0]).toBe("/proposals/p1/approve");
    expect(fetchMock.mock.calls[1][0]).toBe("/proposals/p1/reject");
  });
});
