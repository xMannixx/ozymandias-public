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

function baseChatMockValue(): Record<string, unknown> {
  return {
    messages: [
      { id: "user-1", role: "user", text: "Hallo" },
      { id: "assistant-1", role: "assistant", text: "Hallo, ich bin Ozy." },
    ],
    isLoading: false,
    conversations: [],
    activeConversationId: null,
    isHistoryLoading: false,
    selectedProvider: null,
    selectedModel: "",
    s3FallbackPrompt: null,
    s3LiveWebPrompt: null,
    setSelectedProvider: vi.fn(),
    setSelectedModel: vi.fn(),
    sendMessage: vi.fn(async () => undefined),
    selectConversation: vi.fn(async () => undefined),
    startNewConversation: vi.fn(),
    removeConversation: vi.fn(async () => undefined),
    renameConversationTitle: vi.fn(async () => undefined),
    confirmS3Fallback: vi.fn(async () => undefined),
    cancelS3Fallback: vi.fn(),
    confirmS3LiveWeb: vi.fn(async () => undefined),
    cancelS3LiveWeb: vi.fn(),
  };
}

describe("ChatView", () => {
  beforeEach(() => {
    useChatMock.mockReset();
    useSettingsMock.mockReset();
    useVoiceMock.mockReset();
    playResponseMock.mockReset();

    useChatMock.mockReturnValue(baseChatMockValue());

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
      ...baseChatMockValue(),
      messages: [{ id: "user-1", role: "user", text: "Hallo" }],
      s3FallbackPrompt: { text: "Hallo", message: "Lokaler Provider down." },
      confirmS3Fallback: confirmMock,
    });

    const { getByText } = render(<ChatView />);
    fireEvent.click(getByText("Allow cloud fallback"));
    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled();
    });
  });

  it("renders conversation history sidebar with new chat button", () => {
    const { getByText } = render(<ChatView />);
    expect(getByText("New chat")).toBeInTheDocument();
  });

  it("selects a conversation from the sidebar", async () => {
    const selectMock = vi.fn(async () => undefined);
    useChatMock.mockReturnValueOnce({
      ...baseChatMockValue(),
      conversations: [
        {
          conversation_id: "c1",
          title: "Trip planning",
          created_at: "2026-07-01T10:00:00Z",
          updated_at: "2026-07-01T10:05:00Z",
        },
      ],
      selectConversation: selectMock,
    });

    const { getByText } = render(<ChatView />);
    fireEvent.click(getByText("Trip planning"));
    await waitFor(() => {
      expect(selectMock).toHaveBeenCalledWith("c1");
    });
  });
});
