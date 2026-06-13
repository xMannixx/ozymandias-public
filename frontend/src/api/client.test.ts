import { ApiError, authRedirect, request } from "@/api/client";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api/client", () => {
  it("sets JWT header when token exists", async () => {
    window.localStorage.setItem("ozy.jwt", "token-abc");
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse({ ok: true }));

    await request<{ ok: boolean }>("/health");

    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("does not set authorization without token", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse({ ok: true }));

    await request<{ ok: boolean }>("/health");

    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });

  it("handles 401 by clearing token and redirecting", async () => {
    window.localStorage.setItem("ozy.jwt", "expired-token");
    const redirectSpy = vi.spyOn(authRedirect, "toLogin").mockImplementation(() => undefined);
    vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse({ detail: "bad token" }, 401),
    );

    await expect(request("/claims")).rejects.toBeInstanceOf(ApiError);
    expect(window.localStorage.getItem("ozy.jwt")).toBeNull();
    expect(redirectSpy).toHaveBeenCalled();
  });

  it("throws typed error for 5xx responses", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse({ detail: "db down" }, 500),
    );

    await expect(request("/turns")).rejects.toMatchObject({ status: 500, message: "db down" });
  });

  it("returns backend detail on 4xx responses", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse({ detail: "validation failed" }, 422),
    );

    await expect(request("/turns")).rejects.toMatchObject({
      status: 422,
      message: "validation failed",
    });
  });

  it("formats pydantic 422 detail arrays for users", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse(
        {
          detail: [
            {
              type: "less_than_equal",
              loc: ["body", "cb_max_actions_override"],
              msg: "Input should be less than or equal to 1000",
              input: 2000,
            },
          ],
        },
        422,
      ),
    );

    await expect(request("/settings")).rejects.toMatchObject({
      status: 422,
      message: "body.cb_max_actions_override: Input should be less than or equal to 1000",
    });
  });

  it("sends multipart without forcing JSON content-type", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse({ text: "ok" }));
    const formData = new FormData();
    formData.append("file", new Blob(["audio"], { type: "audio/webm" }), "voice.webm");

    await request("/voice/transcribe", { method: "POST", body: formData });

    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Headers;
    expect(headers.get("Content-Type")).toBeNull();
    expect(options?.body).toBe(formData);
  });
});
