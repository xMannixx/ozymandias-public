import { render, screen } from "@testing-library/react";
import MessageBubble from "@/components/chat/MessageBubble";
import type { ChatMessage } from "@/hooks/useChat";
import { mockClaimS4 } from "@/test/fixtures";

describe("MessageBubble", () => {
  it("renders user message with blue style", () => {
    const message: ChatMessage = { id: "1", role: "user", text: "hello" };
    render(<MessageBubble message={message} />);
    expect(screen.getByText("hello").closest("div")).toHaveClass("bg-blue-700");
  });

  it("renders assistant message with glass style", () => {
    const message: ChatMessage = { id: "2", role: "assistant", text: "hi" };
    render(<MessageBubble message={message} />);
    expect(screen.getByText("hi").closest("div")).toHaveClass("glass-card");
  });

  it("shows sensitivity badges for claims", () => {
    const message: ChatMessage = {
      id: "3",
      role: "assistant",
      text: "claims",
      claims: [
        {
          ...mockClaimS4,
          claim_id: "c1",
          sensitivity: "S3",
          attribute: "mood",
          value: "good",
        },
      ],
    };

    render(<MessageBubble message={message} />);
    expect(screen.getByText("S3")).toBeInTheDocument();
  });

  it("shows provider and model metadata for assistant messages", () => {
    const message: ChatMessage = {
      id: "4",
      role: "assistant",
      text: "ok",
      provider: "openai",
      model: "gpt-4o",
    };
    render(<MessageBubble message={message} />);
    expect(screen.getByText("via openai / gpt-4o")).toBeInTheDocument();
  });

  it("renders collapsible Denkprozess when reasoning_content is present", () => {
    const message: ChatMessage = {
      id: "5",
      role: "assistant",
      text: "Antwort",
      reasoning_content: "Schritt A\nSchritt B",
    };
    render(<MessageBubble message={message} />);
    expect(screen.getByText("Denkprozess")).toBeInTheDocument();
    expect(screen.getByText(/Schritt A/)).toBeInTheDocument();
  });

  it("does not render Denkprozess when reasoning_content is absent", () => {
    const message: ChatMessage = {
      id: "6",
      role: "assistant",
      text: "Nur Antwort",
    };
    render(<MessageBubble message={message} />);
    expect(screen.queryByText("Denkprozess")).not.toBeInTheDocument();
  });
});
