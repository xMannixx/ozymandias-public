import {
  archiveClaim,
  confirmClaim,
  getClaimVersions,
  listClaims,
  lockClaim,
  retractClaim,
  unlockClaim,
  updateClaimSensitivity,
} from "@/api/claims";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api/claims", () => {
  it("lists claims without query params by default", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse([]));

    await listClaims();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/claims");
  });

  it("sends subject and sensitivity query params", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse([]));

    await listClaims({ subject: "alice", sensitivity: "S3" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/claims?subject=alice&sensitivity=S3");
  });

  it("sends pagination params when provided", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse([]));

    await listClaims({ limit: 20, offset: 40 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/claims?limit=20&offset=40");
  });

  it("calls retract endpoint with PATCH", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse({ claim_id: "c1", status: "retracted" }));

    await retractClaim("c1");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/claims/c1/retract");
    expect(options?.method).toBe("PATCH");
  });

  it("calls archive endpoint with PATCH", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse({ claim_id: "c1", status: "archived" }));

    await archiveClaim("c1");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/claims/c1/archive");
    expect(options?.method).toBe("PATCH");
  });

  it("loads claim versions endpoint", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse([]));

    await getClaimVersions("c9");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/claims/c9/versions");
  });

  it("calls confirm, lock, unlock and sensitivity endpoints", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockImplementation(async () => makeJsonResponse({ claim_id: "c1" }));

    await confirmClaim("c1");
    await lockClaim("c1");
    await unlockClaim("c1");
    await updateClaimSensitivity("c1", "S4");

    expect(fetchMock.mock.calls[0][0]).toBe("/claims/c1/confirm");
    expect(fetchMock.mock.calls[1][0]).toBe("/claims/c1/lock");
    expect(fetchMock.mock.calls[2][0]).toBe("/claims/c1/unlock");
    expect(fetchMock.mock.calls[3][0]).toBe("/claims/c1/sensitivity");
  });
});
