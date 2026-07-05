import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProviderSelect from "@/components/settings/ProviderSelect";

const useHealthMock = vi.fn();
const listOllamaModelsMock = vi.fn();
const listLMStudioModelsMock = vi.fn();
const listDeepSeekModelsMock = vi.fn();

vi.mock("@/hooks/useHealth", () => ({
  useHealth: () => useHealthMock(),
}));

vi.mock("@/api/llm", () => ({
  listOllamaModels: (...args: unknown[]) => listOllamaModelsMock(...args),
  listLMStudioModels: (...args: unknown[]) => listLMStudioModelsMock(...args),
  listDeepSeekModels: (...args: unknown[]) => listDeepSeekModelsMock(...args),
}));

describe("ProviderSelect", () => {
  beforeEach(() => {
    useHealthMock.mockReset();
    listOllamaModelsMock.mockReset();
    listLMStudioModelsMock.mockReset();
    listDeepSeekModelsMock.mockReset();
    useHealthMock.mockReturnValue({
      health: {
        llm_providers: ["deepseek", "openai", "ollama", "lmstudio"],
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
    listOllamaModelsMock.mockResolvedValue(["llama3.1:8b"]);
    listLMStudioModelsMock.mockResolvedValue(["qwen-local"]);
    listDeepSeekModelsMock.mockResolvedValue(["deepseek-chat", "deepseek-reasoner"]);
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
    await userEvent.type(screen.getByLabelText("settings-model-input"), "gpt-4o");
    await userEvent.selectOptions(screen.getByLabelText("settings-local-provider-select"), "lmstudio");
    await screen.findByRole("option", { name: "qwen-local" });
    await userEvent.selectOptions(screen.getByLabelText("settings-local-model-select"), "qwen-local");
    await userEvent.click(screen.getByRole("button", { name: "Save provider" }));

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
        model={"deepseek-chat"}
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
    await userEvent.clear(screen.getByLabelText("settings-model-input"));
    await userEvent.selectOptions(screen.getByLabelText("settings-local-provider-select"), "auto");
    await userEvent.click(screen.getByRole("button", { name: "Save provider" }));

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

  it("shows DeepSeek model dropdown and saves selected model", async () => {
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
    expect(screen.queryByLabelText("settings-model-input")).not.toBeInTheDocument();
    await screen.findByRole("option", { name: "deepseek-reasoner" });
    await userEvent.selectOptions(screen.getByLabelText("settings-deepseek-model-select"), "deepseek-reasoner");
    await userEvent.click(screen.getByRole("button", { name: "Save provider" }));

    expect(listDeepSeekModelsMock).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(
      "deepseek",
      "deepseek-reasoner",
      null,
      null,
      false,
      "provider_native_first",
      false,
    );
  });

  it("shows lm studio unreachable hint for empty models", async () => {
    listLMStudioModelsMock.mockResolvedValueOnce([]);
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
