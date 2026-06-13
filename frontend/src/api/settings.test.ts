import { getSettings, toggleKillSwitch, updateSettings } from "@/api/settings";
import { mockSettings } from "@/test/fixtures";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api/settings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getSettings sends GET /settings", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(makeJsonResponse(mockSettings));

    await getSettings();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/settings");
    expect(options?.method).toBeUndefined();
  });

  it("updateSettings sends PATCH /settings payload", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(makeJsonResponse(mockSettings));

    await updateSettings({ mode: "autopilot" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/settings");
    expect(options?.method).toBe("PATCH");
    expect(options?.body).toBe(JSON.stringify({ mode: "autopilot" }));
  });

  it("updateSettings can send preferred provider and model", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(makeJsonResponse(mockSettings));

    await updateSettings({ preferred_provider: "openai", preferred_model: "gpt-4o" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/settings");
    expect(options?.method).toBe("PATCH");
    expect(options?.body).toBe(
      JSON.stringify({ preferred_provider: "openai", preferred_model: "gpt-4o" }),
    );
  });

  it("updateSettings can send local provider and local model", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(makeJsonResponse(mockSettings));

    await updateSettings({ preferred_local_provider: "lmstudio", preferred_local_model: "qwen-local" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/settings");
    expect(options?.method).toBe("PATCH");
    expect(options?.body).toBe(
      JSON.stringify({ preferred_local_provider: "lmstudio", preferred_local_model: "qwen-local" }),
    );
  });

  it("toggleKillSwitch sends POST /settings/kill-switch payload", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(makeJsonResponse(mockSettings));

    await toggleKillSwitch(true);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/settings/kill-switch");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify({ active: true }));
  });
});
