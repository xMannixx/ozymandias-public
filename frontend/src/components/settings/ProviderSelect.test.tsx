import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProviderSelect from "@/components/settings/ProviderSelect";

const useHealthMock = vi.fn();
const listModelsForProviderMock = vi.fn();

vi.mock("@/hooks/useHealth", () => ({
  useHealth: () => useHealthMock(),
}));

vi.mock("@/api/llm", () => ({
  listModelsForProvider: (...args: unknown[]) => listModelsForProviderMock(...args),
}));

/** Catalogues keyed by provider, mirroring what each backend endpoint returns. */
const catalogues: Record<string, string[]> = {
  ollama: ["llama3.1:8b"],
  lmstudio: ["qwen-local"],
  deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"],
  openai: [],
};

describe("ProviderSelect", () => {
  beforeEach(() => {
    useHealthMock.mockReset();
    listModelsForProviderMock.mockReset();
    listModelsForProviderMock.mockImplementation((provider: string) =>
      Promise.resolve(catalogues[provider] ?? []),
    );
    useHealthMock.mockReturnValue({
      health: {
        llm_providers: ["deepseek", "openai", "ollama", "lmstudio", "openrouter"],
        llm_provider_health: [
          {
            name: "deepseek",
            is_local: false,
            configured: true,
            status: "configured",
            model: "deepseek-chat",
            detail: null,
          },
          {
            name: "openai",
            is_local: false,
            configured: true,
            status: "configured",
            model: "gpt-4o",
            detail: null,
          },
          {
            name: "ollama",
            is_local: true,
            configured: true,
            status: "ok",
            model: "llama3.1:8b",
            detail: null,
          },
          {
            name: "lmstudio",
            is_local: true,
            configured: true,
            status: "ok",
            model: "qwen-local",
            detail: null,
          },
        ],
        status: "ok",
        database: "ok",
        redis: "ok",
        rust_bindings: "ok",
        live_web: {
          connector_status: "configured",
          connector_detail: null,
          native_provider_candidates: ["openai", "deepseek"],
        },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("saves cloud and local provider/model", async () => {
    const onSave = vi.fn(async () => undefined);
    render(
      <ProviderSelect
        provider={null}
        model={null}
        localProvider={null}
        localModel={null}
        liveWebEnabled={false}
        liveWebMode={"provider_native_first"}
        liveWebS3ConfirmedDefault={false}
        saving={false}
        onSave={onSave}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("settings-provider-select"), "openai");
    // OpenAI publishes no catalogue here, so the field falls back to free text.
    await userEvent.type(await screen.findByLabelText("settings-model-input"), "gpt-4o");
    await userEvent.selectOptions(screen.getByLabelText("settings-local-provider-select"), "lmstudio");
    await screen.findByRole("option", { name: "qwen-local" });
    await userEvent.selectOptions(screen.getByLabelText("settings-local-model-select"), "qwen-local");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(
      "openai",
      "gpt-4o",
      "lmstudio",
      "qwen-local",
      false,
      "provider_native_first",
      false,
    );
  });

  it("saves auto mode with null values", async () => {
    const onSave = vi.fn(async () => undefined);
    render(
      <ProviderSelect
        provider={"deepseek"}
        model={"deepseek-v4-flash"}
        localProvider={"ollama"}
        localModel={"llama3.1:8b"}
        liveWebEnabled={true}
        liveWebMode={"provider_native_first"}
        liveWebS3ConfirmedDefault={true}
        saving={false}
        onSave={onSave}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("settings-provider-select"), "auto");
    await userEvent.selectOptions(screen.getByLabelText("settings-local-provider-select"), "auto");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(
      null,
      null,
      null,
      null,
      true,
      "provider_native_first",
      true,
    );
  });

  it("shows a model dropdown for providers with a catalogue and saves the choice", async () => {
    const onSave = vi.fn(async () => undefined);
    render(
      <ProviderSelect
        provider={null}
        model={null}
        localProvider={null}
        localModel={null}
        liveWebEnabled={false}
        liveWebMode={"provider_native_first"}
        liveWebS3ConfirmedDefault={false}
        saving={false}
        onSave={onSave}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("settings-provider-select"), "deepseek");
    await screen.findByRole("option", { name: "deepseek-v4-pro" });
    expect(screen.queryByLabelText("settings-model-input")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("settings-model-select"), "deepseek-v4-pro");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(listModelsForProviderMock).toHaveBeenCalledWith("deepseek");
    expect(onSave).toHaveBeenCalledWith(
      "deepseek",
      "deepseek-v4-pro",
      null,
      null,
      false,
      "provider_native_first",
      false,
    );
  });

  it("offers OpenRouter with a filter box for its long catalogue", async () => {
    listModelsForProviderMock.mockImplementation((provider: string) =>
      Promise.resolve(
        provider === "openrouter"
          ? Array.from({ length: 40 }, (_, index) => `vendor/model-${index}`)
          : (catalogues[provider] ?? []),
      ),
    );
    const onSave = vi.fn(async () => undefined);
    render(
      <ProviderSelect
        provider={null}
        model={null}
        localProvider={null}
        localModel={null}
        liveWebEnabled={false}
        liveWebMode={"provider_native_first"}
        liveWebS3ConfirmedDefault={false}
        saving={false}
        onSave={onSave}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("settings-provider-select"), "openrouter");
    const search = await screen.findByLabelText("settings-model-select-search");
    await userEvent.type(search, "model-37");
    await userEvent.selectOptions(screen.getByLabelText("settings-model-select"), "vendor/model-37");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(
      "openrouter",
      "vendor/model-37",
      null,
      null,
      false,
      "provider_native_first",
      false,
    );
  });

  it("switching provider drops a model that belonged to the previous one", async () => {
    const onSave = vi.fn(async () => undefined);
    render(
      <ProviderSelect
        provider={"deepseek"}
        model={"deepseek-v4-pro"}
        localProvider={null}
        localModel={null}
        liveWebEnabled={false}
        liveWebMode={"provider_native_first"}
        liveWebS3ConfirmedDefault={false}
        saving={false}
        onSave={onSave}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("settings-provider-select"), "openai");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(
      "openai",
      null,
      null,
      null,
      false,
      "provider_native_first",
      false,
    );
  });

  it("shows lm studio unreachable hint for empty models", async () => {
    listModelsForProviderMock.mockImplementation((provider: string) =>
      Promise.resolve(provider === "lmstudio" ? [] : (catalogues[provider] ?? [])),
    );
    const onSave = vi.fn(async () => undefined);
    render(
      <ProviderSelect
        provider={null}
        model={null}
        localProvider={null}
        localModel={null}
        liveWebEnabled={false}
        liveWebMode={"provider_native_first"}
        liveWebS3ConfirmedDefault={false}
        saving={false}
        onSave={onSave}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("settings-local-provider-select"), "lmstudio");
    expect(await screen.findByText("LM Studio is unreachable or no model is loaded.")).toBeInTheDocument();
  });
});
