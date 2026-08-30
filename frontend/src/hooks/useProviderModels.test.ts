import { renderHook, waitFor } from "@testing-library/react";
import { useProviderModels } from "@/hooks/useProviderModels";

const listModelsForProviderMock = vi.fn();

vi.mock("@/api/llm", () => ({
  listModelsForProvider: (...args: unknown[]) => listModelsForProviderMock(...args),
}));

describe("useProviderModels", () => {
  beforeEach(() => {
    listModelsForProviderMock.mockReset();
  });

  it("asks nothing while no provider is chosen", () => {
    const { result } = renderHook(() => useProviderModels(null));
    expect(result.current.models).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(listModelsForProviderMock).not.toHaveBeenCalled();
  });

  it("loads the catalogue of the chosen provider", async () => {
    listModelsForProviderMock.mockResolvedValue(["a", "b"]);
    const { result } = renderHook(() => useProviderModels("openrouter"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.models).toEqual(["a", "b"]);
    expect(result.current.unavailable).toBe(false);
    expect(listModelsForProviderMock).toHaveBeenCalledWith("openrouter");
  });

  it("treats an empty catalogue as unavailable, so callers can offer free text", async () => {
    listModelsForProviderMock.mockResolvedValue([]);
    const { result } = renderHook(() => useProviderModels("anthropic"));

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.models).toEqual([]);
  });

  it("survives a failed request", async () => {
    listModelsForProviderMock.mockRejectedValue(new Error("unreachable"));
    const { result } = renderHook(() => useProviderModels("ollama"));

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.loading).toBe(false);
  });

  it("reloads when the provider changes", async () => {
    listModelsForProviderMock.mockResolvedValue(["a"]);
    const { result, rerender } = renderHook(({ provider }) => useProviderModels(provider), {
      initialProps: { provider: "deepseek" as string | null },
    });
    await waitFor(() => expect(result.current.models).toEqual(["a"]));

    listModelsForProviderMock.mockResolvedValue(["x", "y"]);
    rerender({ provider: "openrouter" });
    await waitFor(() => expect(result.current.models).toEqual(["x", "y"]));
    expect(listModelsForProviderMock).toHaveBeenLastCalledWith("openrouter");
  });
});
