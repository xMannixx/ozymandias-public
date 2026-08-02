import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ChatView from "@/components/chat/ChatView";
import { mockProject } from "@/test/projects-fixtures";

const useChatMock = vi.fn();
const useSettingsMock = vi.fn();
const useVoiceMock = vi.fn();
const playResponseMock = vi.fn();
const listProjectsMock = vi.fn();

vi.mock("@/hooks/useChat", () => ({
  useChat: (...args: unknown[]) => useChatMock(...args),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => useSettingsMock(),
}));

vi.mock("@/hooks/useVoice", () => ({
  useVoice: (...args: unknown[]) => useVoiceMock(...args),
}));

vi.mock("@/api/projects", () => ({
  listProjects: (...args: unknown[]) => listProjectsMock(...args),
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
    stopStreaming: vi.fn(),
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

function renderChatView(): void {
  render(
    <MemoryRouter>
      <ChatView />
    </MemoryRouter>,
  );
}

describe("ChatView", () => {
  beforeEach(() => {
    useChatMock.mockReset();
    useSettingsMock.mockReset();
    useVoiceMock.mockReset();
    playResponseMock.mockReset();
    listProjectsMock.mockReset();
    localStorage.clear();

    useChatMock.mockReturnValue(baseChatMockValue());
    listProjectsMock.mockResolvedValue([mockProject]);

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
    renderChatView();

    await waitFor(() => {
      expect(playResponseMock).toHaveBeenCalledWith("Hallo, ich bin Ozy.");
    });
  });

  it("shows S3 fallback modal and confirms retry action", async () => {
    const confirmMock = vi.fn(async () => undefined);
    useChatMock.mockReturnValueOnce({
      ...baseChatMockValue(),
      messages: [{ id: "user-1", role: "user", text: "Hallo" }],
      s3FallbackPrompt: { text: "Hallo", message: "The local model is down." },
      confirmS3Fallback: confirmMock,
    });

    renderChatView();
    fireEvent.click(screen.getByRole("button", { name: "Allow once" }));

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled();
    });
  });

  it("renders conversation history sidebar with new chat button", () => {
    renderChatView();
    expect(screen.getByText("New chat")).toBeInTheDocument();
  });

  it("selects a conversation from the sidebar", async () => {
    const selectMock = vi.fn(async () => undefined);
    useChatMock.mockReturnValueOnce({
      ...baseChatMockValue(),
      conversations: [
        {
          conversation_id: "c1",
          title: "Trip planning",
          project_id: null,
          created_at: "2026-07-01T10:00:00Z",
          updated_at: "2026-07-01T10:05:00Z",
        },
      ],
      selectConversation: selectMock,
    });

    renderChatView();
    fireEvent.click(screen.getByText("Trip planning"));

    await waitFor(() => {
      expect(selectMock).toHaveBeenCalledWith("c1");
    });
  });

  it("chats outside a workspace by default", () => {
    renderChatView();

    expect(useChatMock).toHaveBeenCalledWith({ projectId: undefined });
    expect(screen.queryByText(/In workspace/)).not.toBeInTheDocument();
  });

  it("scopes the chat to the remembered workspace", async () => {
    localStorage.setItem("ozy-chat-project", "project-1");

    renderChatView();

    expect(useChatMock).toHaveBeenCalledWith({ projectId: "project-1" });
    expect(await screen.findByText("In workspace: Tax return 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open workspace" })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );
  });

  it("leaves the workspace on request", async () => {
    localStorage.setItem("ozy-chat-project", "project-1");

    renderChatView();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));

    await waitFor(() => {
      expect(localStorage.getItem("ozy-chat-project")).toBeNull();
    });
    expect(screen.queryByText(/In workspace/)).not.toBeInTheDocument();
  });
});
