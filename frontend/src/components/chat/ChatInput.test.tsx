import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatInput from "@/components/chat/ChatInput";

vi.mock("@/components/chat/VoiceButton", () => ({
  default: () => (
    <button type="button">
      VoiceMock
    </button>
  ),
}));

describe("ChatInput", () => {
  const baseVoiceProps = {
    voiceState: "idle" as const,
    voiceMode: "push_to_talk" as const,
    isVoiceEnabled: false,
    voiceError: null as string | null,
    onStartRecording: vi.fn(),
    onStopRecording: vi.fn(),
    onToggleVoice: vi.fn(),
  };

  it("fires send event with text", async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} {...baseVoiceProps} />);

    await userEvent.type(screen.getByLabelText("chat-input"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledWith("hello");
  });

  it("blocks empty message submit", async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} {...baseVoiceProps} />);
    const sendButton = screen.getByRole("button", { name: "Send" });

    expect(sendButton).toBeDisabled();
    await userEvent.click(sendButton);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends message on Enter key", async () => {
    const onSend = vi.fn(async () => undefined);
    render(<ChatInput onSend={onSend} {...baseVoiceProps} />);
    const input = screen.getByLabelText("chat-input");

    await userEvent.type(input, "enter message");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith("enter message");
    });
  });

  it("clears input after send", async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} {...baseVoiceProps} />);
    const input = screen.getByLabelText("chat-input") as HTMLInputElement;

    await userEvent.type(input, "to clear");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(input.value).toBe("");
  });
});
