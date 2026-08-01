import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MessageBubble from "@/components/chat/MessageBubble";
import type { ChatMessage } from "@/hooks/useChat";

function renderWithRouter(message: ChatMessage): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <MessageBubble message={message} />
    </MemoryRouter>,
  );
}

describe("MessageBubble", () => {
  it("aligns user messages to the right", () => {
    const message: ChatMessage = { id: "1", role: "user", text: "hello" };
    renderWithRouter(message);
    const bubbleWrapper = screen.getByText("hello").closest(".flex");
    expect(bubbleWrapper?.className).toContain("justify-end");
  });

  it("shows the Ozymandias avatar next to assistant messages", () => {
    const message: ChatMessage = { id: "2", role: "assistant", text: "hi" };
    renderWithRouter(message);
    expect(screen.getByText("hi")).toBeInTheDocument();
    expect(screen.getByText("O")).toBeInTheDocument();
  });

  it("renders assistant markdown as formatted content", () => {
    const message: ChatMessage = {
      id: "2b",
      role: "assistant",
      text: "**bold** and\n\n- item one\n- item two",
    };
    renderWithRouter(message);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("item one").tagName).toBe("LI");
  });

  it("shows a copy button for finished assistant messages", () => {
    const message: ChatMessage = { id: "2c", role: "assistant", text: "copy me" };
    renderWithRouter(message);
    expect(screen.getByRole("button", { name: "Copy message" })).toBeInTheDocument();
  });

  it("hides copy button and shows cursor while streaming", () => {
    const message: ChatMessage = {
      id: "2d",
      role: "assistant",
      text: "partial",
      isStreaming: true,
    };
    renderWithRouter(message);
    expect(screen.queryByRole("button", { name: "Copy message" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("streaming")).toBeInTheDocument();
  });

  it("shows a review notice with a link to Proposals when a proposal was created", () => {
    const message: ChatMessage = {
      id: "3",
      role: "assistant",
      text: "Noted.",
      results: [{ claim_ref: "r1", status: "proposal_created", reason: null, claim_id: null, proposal_id: "p1" }],
    };

    renderWithRouter(message);
    expect(screen.getByText(/1 memory proposal created/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review now" })).toHaveAttribute("href", "/proposals");
  });

  it("pluralizes the notice for multiple proposals", () => {
    const message: ChatMessage = {
      id: "3b",
      role: "assistant",
      text: "Noted.",
      results: [
        { claim_ref: "r1", status: "proposal_created", reason: null, claim_id: null, proposal_id: "p1" },
        { claim_ref: "r2", status: "proposal_created", reason: null, claim_id: null, proposal_id: "p2" },
      ],
    };

    renderWithRouter(message);
    expect(screen.getByText(/2 memory proposals created/)).toBeInTheDocument();
  });

  it("shows a saved-automatically notice with a link to Memory when a claim was created directly", () => {
    const message: ChatMessage = {
      id: "3c",
      role: "assistant",
      text: "Noted.",
      results: [{ claim_ref: "r1", status: "created", reason: null, claim_id: "c1", proposal_id: null }],
    };

    renderWithRouter(message);
    expect(screen.getByText(/1 memory saved automatically/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Memory" })).toHaveAttribute("href", "/memory");
  });

  it("shows no notice when there are no results", () => {
    const message: ChatMessage = { id: "3d", role: "assistant", text: "ok", results: [] };
    renderWithRouter(message);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows provider and model metadata for assistant messages", () => {
    const message: ChatMessage = {
      id: "4",
      role: "assistant",
      text: "ok",
      provider: "openai",
      model: "gpt-4o",
    };
    renderWithRouter(message);
    expect(screen.getByText(/via openai/)).toBeInTheDocument();
    expect(screen.getByText(/gpt-4o/)).toBeInTheDocument();
  });

  it("renders collapsible Reasoning section when reasoning_content is present", () => {
    const message: ChatMessage = {
      id: "5",
      role: "assistant",
      text: "Answer",
      reasoning_content: "Step A\nStep B",
    };
    renderWithRouter(message);
    expect(screen.getByText("Reasoning")).toBeInTheDocument();
    expect(screen.getByText(/Step A/)).toBeInTheDocument();
  });

  it("does not render Reasoning when reasoning_content is absent", () => {
    const message: ChatMessage = {
      id: "6",
      role: "assistant",
      text: "Just an answer",
    };
    renderWithRouter(message);
    expect(screen.queryByText("Reasoning")).not.toBeInTheDocument();
  });
});
