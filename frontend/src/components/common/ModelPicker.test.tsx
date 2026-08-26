import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModelPicker from "@/components/common/ModelPicker";

const labels = { select: "model-select", input: "model-input", auto: "Provider default" };

function manyModels(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `vendor/model-${index}`);
}

describe("ModelPicker", () => {
  it("lists the models it is given", () => {
    render(<ModelPicker models={["a-model", "b-model"]} value="" onChange={vi.fn()} labels={labels} />);
    expect(screen.getByRole("option", { name: "a-model" })).toBeInTheDocument();
    expect(screen.getByLabelText("model-select")).toHaveValue("__auto__");
  });

  it("reports an empty model when the default option is chosen", async () => {
    const onChange = vi.fn();
    render(<ModelPicker models={["a-model"]} value="a-model" onChange={onChange} labels={labels} />);
    await userEvent.selectOptions(screen.getByLabelText("model-select"), "__auto__");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("keeps the current model listed even when the catalogue does not have it", () => {
    render(<ModelPicker models={["a-model"]} value="retired-model" onChange={vi.fn()} labels={labels} />);
    expect(screen.getByLabelText("model-select")).toHaveValue("retired-model");
  });

  it("stays a plain dropdown for a short list", () => {
    render(<ModelPicker models={manyModels(5)} value="" onChange={vi.fn()} labels={labels} />);
    expect(screen.queryByLabelText("model-select-search")).not.toBeInTheDocument();
  });

  it("offers a filter box once the list is long", async () => {
    render(<ModelPicker models={manyModels(40)} value="" onChange={vi.fn()} labels={labels} />);
    await userEvent.type(screen.getByLabelText("model-select-search"), "model-31");
    expect(screen.getByRole("option", { name: "vendor/model-31" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "vendor/model-12" })).not.toBeInTheDocument();
  });

  it("says so when nothing matches instead of showing an empty list", async () => {
    render(<ModelPicker models={manyModels(40)} value="" onChange={vi.fn()} labels={labels} />);
    await userEvent.type(screen.getByLabelText("model-select-search"), "nothing-like-this");
    expect(screen.getByText(/No model matches/)).toBeInTheDocument();
  });

  it("filtering does not hide the model that is already selected", async () => {
    render(
      <ModelPicker models={manyModels(40)} value="vendor/model-3" onChange={vi.fn()} labels={labels} />,
    );
    await userEvent.type(screen.getByLabelText("model-select-search"), "model-21");
    expect(screen.getByLabelText("model-select")).toHaveValue("vendor/model-3");
  });

  it("falls back to a text field when the provider has no catalogue", async () => {
    const onChange = vi.fn();
    render(<ModelPicker models={[]} value="" onChange={onChange} unavailable labels={labels} />);
    await userEvent.type(screen.getByLabelText("model-input"), "x");
    expect(onChange).toHaveBeenCalledWith("x");
    expect(screen.queryByLabelText("model-select")).not.toBeInTheDocument();
  });

  it("is disabled while the catalogue loads", () => {
    render(<ModelPicker models={[]} value="" onChange={vi.fn()} loading labels={labels} />);
    expect(screen.getByLabelText("model-select")).toBeDisabled();
    expect(screen.getByText("Loading models…")).toBeInTheDocument();
  });
});
