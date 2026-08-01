import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkspaceChat from "@/components/projects/WorkspaceChat";

const useChatSessionMock = vi.fn();

vi.mock("@/hooks/useChatSession", () => ({
  useChatSession: (...args: unknown[]) => useChatSessionMock(...args),
}));

vi.mock("@/components/chat/MessageList", () => ({
  default: () => <div data-testid="message-list" />,
}));

vi.mock("@/components/chat/ChatInput", () => ({
  default: () => <div data-testid="chat-input" />,
}));

function sessionValue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    messages: [],
    isLoading: false,
    conversations: [],
    activeConversationId: null,
    isHistoryLoading: false,
    s3FallbackPrompt: null,
    s3LiveWebPrompt: null,
    sendMessage: vi.fn(async () => undefined),
    stopStreaming: vi.fn(),
    selectConversation: vi.fn(async () => undefined),
    startNewConversation: vi.fn(),
    removeConversation: vi.fn(async () => undefined),
    confirmS3Fallback: vi.fn(async () => undefined),
    cancelS3Fallback: vi.fn(),
    confirmS3LiveWeb: vi.fn(async () => undefined),
    cancelS3LiveWeb: vi.fn(),
    voice: {
      isVoiceEnabled: false,
      voiceMode: "push_to_talk",
      voiceState: "idle",
      error: null,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      toggleVoice: vi.fn(),
    },
    ...overrides,
  };
}

function renderWorkspaceChat(props: Partial<Record<string, unknown>> = {}): void {
  render(
    <WorkspaceChat
      projectId="project-1"
      projectName="Tax return 2026"
      hasInstructions
      knowledgeCount={2}
      {...props}
    />,
  );
}

describe("WorkspaceChat", () => {
  beforeEach(() => {
    useChatSessionMock.mockReset();
    useChatSessionMock.mockReturnValue(sessionValue());
  });

  it("scopes the session to the workspace", () => {
    renderWorkspaceChat();

    expect(useChatSessionMock).toHaveBeenCalledWith({ projectId: "project-1" });
  });

  it("names the context Ozy will use", () => {
    renderWorkspaceChat();

    expect(screen.getByText("Ask anything about Tax return 2026.")).toBeInTheDocument();
    expect(
      screen.getByText("Ozy answers with this workspace in mind: custom instructions and 2 knowledge files."),
    ).toBeInTheDocument();
  });

  it("asks for content when the workspace is still empty", () => {
    renderWorkspaceChat({ hasInstructions: false, knowledgeCount: 0 });

    expect(screen.getByText(/Add instructions or upload files/)).toBeInTheDocument();
  });

  it("lists the workspace's own chats", async () => {
    const user = userEvent.setup();
    const selectConversation = vi.fn(async () => undefined);
    useChatSessionMock.mockReturnValue(
      sessionValue({
        conversations: [
          {
            conversation_id: "c1",
            title: "Which receipts count?",
            project_id: "project-1",
            created_at: "2026-04-06T09:00:00Z",
            updated_at: "2026-04-06T09:30:00Z",
          },
        ],
        selectConversation,
      }),
    );
    renderWorkspaceChat();

    await user.click(screen.getByText("Which receipts count?"));

    expect(selectConversation).toHaveBeenCalledWith("c1");
  });

  it("explains that chats stay with the project", () => {
    renderWorkspaceChat();

    expect(screen.getByText(/No chats in this workspace yet/)).toBeInTheDocument();
  });
});
