import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiKeysSettings from "@/components/settings/ApiKeysSettings";
import { mockSettings } from "@/test/fixtures";

const MASKED = "••••••••";

describe("ApiKeysSettings", () => {
  it("offers a field for every provider that takes a key", () => {
    render(<ApiKeysSettings settings={mockSettings} saving={false} onSave={vi.fn()} />);
    for (const label of ["OpenAI", "DeepSeek", "Google Gemini", "Mistral", "Anthropic Claude", "OpenRouter"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("sends the typed key for its own provider only", async () => {
    const onSave = vi.fn(async () => undefined);
    render(<ApiKeysSettings settings={mockSettings} saving={false} onSave={onSave} />);

    await userEvent.type(screen.getByLabelText("OpenRouter"), "sk-or-v1-secret");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith({
      openai: "",
      deepseek: "",
      gemini: "",
      mistral: "",
      anthropic: "",
      openrouter: "sk-or-v1-secret",
    });
  });

  it("passes the mask through unchanged so a stored key survives an unrelated edit", async () => {
    const onSave = vi.fn(async () => undefined);
    render(
      <ApiKeysSettings
        settings={{ ...mockSettings, deepseek_api_key: MASKED }}
        saving={false}
        onSave={onSave}
      />,
    );

    await userEvent.type(screen.getByLabelText("OpenRouter"), "sk-or-v1-new");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ deepseek: MASKED }));
  });

  it("clearing a field asks for the key to be deleted", async () => {
    const onSave = vi.fn(async () => undefined);
    render(
      <ApiKeysSettings
        settings={{ ...mockSettings, deepseek_api_key: MASKED }}
        saving={false}
        onSave={onSave}
      />,
    );

    await userEvent.click(screen.getByLabelText("Clear DeepSeek key"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ deepseek: "" }));
  });

  it("counts how many keys are stored on the server", () => {
    render(
      <ApiKeysSettings
        settings={{ ...mockSettings, deepseek_api_key: MASKED, openrouter_api_key: MASKED }}
        saving={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("2 of 6 set up")).toBeInTheDocument();
  });

  it("never shows a stored key in clear text", async () => {
    render(
      <ApiKeysSettings
        settings={{ ...mockSettings, openrouter_api_key: MASKED }}
        saving={false}
        onSave={vi.fn()}
      />,
    );
    const field = screen.getByLabelText("OpenRouter");
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveValue(MASKED);

    await userEvent.click(screen.getByLabelText("Show OpenRouter key"));
    // Revealing only ever shows the mask, because the server never sends the key back.
    expect(screen.getByLabelText("OpenRouter")).toHaveValue(MASKED);
  });

  it("trims stray whitespace around a pasted key", async () => {
    const onSave = vi.fn(async () => undefined);
    render(<ApiKeysSettings settings={mockSettings} saving={false} onSave={onSave} />);

    await userEvent.type(screen.getByLabelText("OpenRouter"), "  sk-or-v1-padded  ");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ openrouter: "sk-or-v1-padded" }));
  });
});
