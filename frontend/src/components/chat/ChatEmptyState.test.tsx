import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatEmptyState from "@/components/chat/ChatEmptyState";
import type { ChatStarter } from "@/api/types";

const useChatStartersMock = vi.fn();

vi.mock("@/hooks/useChatStarters", () => ({
  useChatStarters: () => useChatStartersMock(),
}));

const starters: ChatStarter[] = [
  {
    id: "proposals",
    icon: "proposals",
    title: "Review 3 proposals",
    prompt: "Which memory proposals are waiting for me?",
  },
  {
    id: "tasks",
    icon: "tasks",
    title: "2 tasks due",
    prompt: "Which of my project tasks are overdue?",
  },
];

function state(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { starters, loading: false, refetch: vi.fn(), ...overrides };
}

describe("ChatEmptyState", () => {
  beforeEach(() => {
    useChatStartersMock.mockReset();
  });

  it("shows the suggestions the server built", () => {
    useChatStartersMock.mockReturnValue(state());

    render(<ChatEmptyState onPromptClick={vi.fn()} />);

    expect(screen.getByText("Review 3 proposals")).toBeInTheDocument();
    expect(screen.getByText("2 tasks due")).toBeInTheDocument();
  });

  it("sends the prompt behind a suggestion", async () => {
    const onPromptClick = vi.fn();
    useChatStartersMock.mockReturnValue(state());

    render(<ChatEmptyState onPromptClick={onPromptClick} />);
    await userEvent.click(screen.getByText("Review 3 proposals"));

    expect(onPromptClick).toHaveBeenCalledWith("Which memory proposals are waiting for me?");
  });

  it("falls back to examples when the request came back empty", () => {
    useChatStartersMock.mockReturnValue(state({ starters: [] }));

    render(<ChatEmptyState onPromptClick={vi.fn()} />);

    expect(screen.getByText("Remember something")).toBeInTheDocument();
  });

  it("asks for a different set of suggestions", async () => {
    const refetch = vi.fn();
    useChatStartersMock.mockReturnValue(state({ refetch }));

    render(<ChatEmptyState onPromptClick={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Other suggestions/ }));

    expect(refetch).toHaveBeenCalled();
  });

  it("blocks a second reload while one is in flight", () => {
    useChatStartersMock.mockReturnValue(state({ loading: true }));

    render(<ChatEmptyState onPromptClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Other suggestions/ })).toBeDisabled();
  });
});
