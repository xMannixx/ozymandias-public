import { fireEvent, render, waitFor } from "@testing-library/react";
import ChatView from "@/components/chat/ChatView";

const useChatMock = vi.fn();
const useSettingsMock = vi.fn();
const useVoiceMock = vi.fn();
const playResponseMock = vi.fn();

vi.mock("@/hooks/useChat", () => ({
  useChat: () => useChatMock(),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => useSettingsMock(),
}));

vi.mock("@/hooks/useVoice", () => ({
  useVoice: (...args: unknown[]) => useVoiceMock(...args),
}));

vi.mock("@/components/chat/MessageList", () => ({
  default: () => <div data-testid="message-list" />,
}));

vi.mock("@/components/chat/ChatInput", () => ({
  default: () => <div data-testid="chat-input" />,
}));

describe("ChatView", () => {
  beforeEach(() => {
    useChatMock.mockReset();
    useSettingsMock.mockReset();
    useVoiceMock.mockReset();
    playResponseMock.mockReset();

    useChatMock.mockReturnValue({
      messages: [
        { id: "user-1", role: "user", text: "Hallo" },
        { id: "assistant-1", role: "assistant", text: "Hallo, ich bin Ozy." },
      ],
      isLoading: false,
      selectedProvider: null,
      selectedModel: "",
      s3FallbackPrompt: null,
      s3LiveWebPrompt: null,
      setSelectedProvider: vi.fn(),
      setSelectedModel: vi.fn(),
      sendMessage: vi.fn(async () => undefined),
      confirmS3Fallback: vi.fn(async () => undefined),
      cancelS3Fallback: vi.fn(),
      confirmS3LiveWeb: vi.fn(async () => undefined),
      cancelS3LiveWeb: vi.fn(),
    });

    useSettingsMock.mockReturnValue({
      settings: {
        tts_autoplay: true,
        tts_voice: "ash",
        tts_model: "tts-1",
      },
    });

    useVoiceMock.mockReturnValue({
      isVoiceEnabled: false,
      voiceMode: "push_to_talk",
      playResponse: playResponseMock,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      toggleVoice: vi.fn(),
      setVoiceMode: vi.fn(),
      voiceState: "idle",
      error: null,
    });
  });

  it("autoplays assistant response even when voice toggle is off", async () => {
    render(<ChatView />);

    await waitFor(() => {
      expect(playResponseMock).toHaveBeenCalledWith("Hallo, ich bin Ozy.");
    });
  });

  it("shows S3 fallback modal and confirms retry action", async () => {
    const confirmMock = vi.fn(async () => undefined);
    useChatMock.mockReturnValueOnce({
      messages: [{ id: "user-1", role: "user", text: "Hallo" }],
      isLoading: false,
      selectedProvider: null,
      selectedModel: "",
      s3FallbackPrompt: { text: "Hallo", message: "Lokaler Provider down." },
      s3LiveWebPrompt: null,
      setSelectedProvider: vi.fn(),
      setSelectedModel: vi.fn(),
      sendMessage: vi.fn(async () => undefined),
      confirmS3Fallback: confirmMock,
      cancelS3Fallback: vi.fn(),
      confirmS3LiveWeb: vi.fn(async () => undefined),
      cancelS3LiveWeb: vi.fn(),
    });

    const { getByText } = render(<ChatView />);
    fireEvent.click(getByText("Cloud-Fallback erlauben"));
    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled();
    });
  });
});
