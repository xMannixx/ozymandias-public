import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/api/client";
import ChatInput from "@/components/chat/ChatInput";

const extractAttachmentMock = vi.fn();

vi.mock("@/api/turns", () => ({
  extractAttachment: (...args: unknown[]) => extractAttachmentMock(...args),
}));

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

  beforeEach(() => {
    extractAttachmentMock.mockReset();
  });

  it("fires send event with text", async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} {...baseVoiceProps} />);

    await userEvent.type(screen.getByLabelText("chat-input"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledWith("hello", undefined);
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
      expect(onSend).toHaveBeenCalledWith("enter message", undefined);
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

  it("shows a Stop button while streaming and triggers onStop", async () => {
    const onSend = vi.fn();
    const onStop = vi.fn();
    render(<ChatInput onSend={onSend} onStop={onStop} isStreaming {...baseVoiceProps} />);

    const stopButton = screen.getByRole("button", { name: "Stop" });
    await userEvent.click(stopButton);
    expect(onStop).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("attaches an extracted file and sends it with the message", async () => {
    extractAttachmentMock.mockResolvedValue({
      filename: "notes.txt",
      content: "meeting notes",
      truncated: false,
      char_count: 13,
      sensitivity: "S1",
    });
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} {...baseVoiceProps} />);

    const file = new File(["meeting notes"], "notes.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("chat-attachment-input"), file);

    await waitFor(() => {
      expect(screen.getByText("notes.txt")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText("chat-input"), "summarize");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledWith("summarize", [
      { filename: "notes.txt", content: "meeting notes" },
    ]);
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  });

  it("marks S3 attachments with a sensitivity badge", async () => {
    extractAttachmentMock.mockResolvedValue({
      filename: "salary.txt",
      content: "salary details",
      truncated: false,
      char_count: 14,
      sensitivity: "S3",
    });
    render(<ChatInput onSend={vi.fn()} {...baseVoiceProps} />);

    const file = new File(["salary details"], "salary.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("chat-attachment-input"), file);

    await waitFor(() => {
      expect(screen.getByText("S3")).toBeInTheDocument();
    });
  });

  it("removes an attachment via its remove button", async () => {
    extractAttachmentMock.mockResolvedValue({
      filename: "notes.txt",
      content: "meeting notes",
      truncated: false,
      char_count: 13,
      sensitivity: "S1",
    });
    render(<ChatInput onSend={vi.fn()} {...baseVoiceProps} />);

    const file = new File(["meeting notes"], "notes.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("chat-attachment-input"), file);
    await waitFor(() => {
      expect(screen.getByText("notes.txt")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Remove attachment notes.txt" }));
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  });

  it("shows extraction errors from the API", async () => {
    extractAttachmentMock.mockRejectedValue(
      new ApiError("Unsupported file type. Supported: .txt, .md, .csv, .pdf", 400, null),
    );
    render(<ChatInput onSend={vi.fn()} {...baseVoiceProps} />);

    const file = new File(["binary"], "image.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("chat-attachment-input"), file, {
      applyAccept: false,
    });

    await waitFor(() => {
      expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument();
    });
  });
});
