import { getGoogleAuthUrl, loginWithToken } from "@/api/auth";

describe("api/auth", () => {
  it("calls /auth/token for token login", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "jwt-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await loginWithToken("dev-token");
    const [url] = fetchMock.mock.calls[0];

    expect(url).toBe("/auth/token");
    expect(result.access_token).toBe("jwt-1");
  });

  it("calls /auth/google/url", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ url: "https://accounts.google.com/o/oauth2/auth" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getGoogleAuthUrl();
    const [url] = fetchMock.mock.calls[0];

    expect(url).toBe("/auth/google/url");
    expect(result.url).toContain("google");
  });
});
