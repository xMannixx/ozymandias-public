import { listDeepSeekModels, listLMStudioModels, listOllamaModels, listProviders } from "@/api/llm";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api/llm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listProviders sends GET /llm/providers", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse([{ name: "deepseek", is_local: false, current_model: "deepseek-chat" }]),
    );

    const payload = await listProviders();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/llm/providers");
    expect(options?.method).toBeUndefined();
    expect(payload).toEqual([{ name: "deepseek", is_local: false, current_model: "deepseek-chat" }]);
  });

  it("listOllamaModels sends GET /llm/ollama/models", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(makeJsonResponse(["llama3.1:8b"]));

    const payload = await listOllamaModels();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/llm/ollama/models");
    expect(payload).toEqual(["llama3.1:8b"]);
  });

  it("listLMStudioModels sends GET /llm/lmstudio/models", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(makeJsonResponse(["qwen-local"]));

    const payload = await listLMStudioModels();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/llm/lmstudio/models");
    expect(payload).toEqual(["qwen-local"]);
  });

  it("listDeepSeekModels sends GET /llm/deepseek/models", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      makeJsonResponse(["deepseek-chat", "deepseek-reasoner"]),
    );

    const payload = await listDeepSeekModels();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/llm/deepseek/models");
    expect(payload).toEqual(["deepseek-chat", "deepseek-reasoner"]);
  });
});
