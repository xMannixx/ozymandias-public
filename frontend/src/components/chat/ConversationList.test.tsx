import { fireEvent, render, screen } from "@testing-library/react";
import ConversationList from "@/components/chat/ConversationList";
import type { ConversationResponse } from "@/api/types";

const conversations: ConversationResponse[] = [
  {
    conversation_id: "c1",
    title: "Trip planning",
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:05:00Z",
  },
  {
    conversation_id: "c2",
    title: "Groceries",
    created_at: "2026-07-02T09:00:00Z",
    updated_at: "2026-07-02T09:10:00Z",
  },
];

describe("ConversationList", () => {
  it("renders empty state when there are no conversations", () => {
    render(
      <ConversationList
        conversations={[]}
        activeConversationId={null}
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/No previous chats yet/)).toBeInTheDocument();
  });

  it("calls onNew when clicking new chat", () => {
    const onNew = vi.fn();
    render(
      <ConversationList
        conversations={conversations}
        activeConversationId={null}
        onSelect={vi.fn()}
        onNew={onNew}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("New chat"));
    expect(onNew).toHaveBeenCalled();
  });

  it("calls onSelect with the conversation id", () => {
    const onSelect = vi.fn();
    render(
      <ConversationList
        conversations={conversations}
        activeConversationId={null}
        onSelect={onSelect}
        onNew={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Groceries"));
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("renames a conversation via inline input", () => {
    const onRename = vi.fn();
    render(
      <ConversationList
        conversations={conversations}
        activeConversationId={null}
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("rename-conversation-c1"));
    const input = screen.getByLabelText("conversation-title-input");
    fireEvent.change(input, { target: { value: "Updated title" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("c1", "Updated title");
  });

  it("asks for confirmation before deleting", () => {
    const onDelete = vi.fn();
    render(
      <ConversationList
        conversations={conversations}
        activeConversationId={null}
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByLabelText("delete-conversation-c1"));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Delete", { selector: "button.bg-red-600" }));
    expect(onDelete).toHaveBeenCalledWith("c1");
  });
});
