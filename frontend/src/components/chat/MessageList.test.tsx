import { render, screen } from "@testing-library/react";
import MessageList from "@/components/chat/MessageList";
import type { ChatMessage } from "@/hooks/useChat";

describe("MessageList", () => {
  it("renders messages in list", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", text: "first" },
      { id: "2", role: "assistant", text: "second" },
    ];
    render(<MessageList messages={messages} />);
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("shows placeholder when empty", () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText("No messages yet. Ask Ozy anything to get started.")).toBeInTheDocument();
  });
});
