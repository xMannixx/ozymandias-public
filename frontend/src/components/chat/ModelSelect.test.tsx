import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ModelSelect from "@/components/chat/ModelSelect";

const listModelsForProviderMock = vi.fn();

vi.mock("@/api/llm", () => ({
  listModelsForProvider: (...args: unknown[]) => listModelsForProviderMock(...args),
}));

describe("ModelSelect", () => {
  beforeEach(() => {
    listModelsForProviderMock.mockReset();
  });

  it("renders disabled select when provider is auto", () => {
    render(<ModelSelect provider={null} model="" onChange={vi.fn()} />);
    const select = screen.getByLabelText("chat-model-select");
    expect(select).toBeDisabled();
    expect(screen.getByText("Automatic (picked by router)")).toBeInTheDocument();
    expect(listModelsForProviderMock).not.toHaveBeenCalled();
  });

  it("loads models for the selected provider and calls onChange", async () => {
    listModelsForProviderMock.mockResolvedValueOnce(["llama3.2", "qwen2.5"]);
    const onChange = vi.fn();
    render(<ModelSelect provider="ollama" model="" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText("llama3.2")).toBeInTheDocument();
    });
    expect(listModelsForProviderMock).toHaveBeenCalledWith("ollama");

    fireEvent.change(screen.getByLabelText("chat-model-select"), {
      target: { value: "qwen2.5" },
    });
    expect(onChange).toHaveBeenCalledWith("qwen2.5");
  });

  it("maps default option back to empty model", async () => {
    listModelsForProviderMock.mockResolvedValueOnce(["deepseek-chat"]);
    const onChange = vi.fn();
    render(<ModelSelect provider="deepseek" model="deepseek-chat" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText("deepseek-chat")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("chat-model-select"), {
      target: { value: "__auto__" },
    });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("falls back to free-text input when the model list is unavailable", async () => {
    listModelsForProviderMock.mockRejectedValueOnce(new Error("unreachable"));
    render(<ModelSelect provider="ollama" model="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText("chat-model-input")).toBeInTheDocument();
    });
  });

  it("keeps the current model selectable even when missing from the list", async () => {
    listModelsForProviderMock.mockResolvedValueOnce(["a-model"]);
    render(<ModelSelect provider="ollama" model="custom-model" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("custom-model")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("chat-model-select")).toHaveValue("custom-model");
  });
});
