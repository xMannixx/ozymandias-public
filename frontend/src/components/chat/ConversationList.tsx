import { useState } from "react";
import Modal from "@/components/common/Modal";
import { toRelativeTime } from "@/lib/relativeTime";
import type { ConversationResponse } from "@/api/types";

type ConversationListProps = {
  conversations: ConversationResponse[];
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onNew: () => void;
  onRename: (conversationId: string, title: string) => void;
  onDelete: (conversationId: string) => void;
};

function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: ConversationListProps): JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<ConversationResponse | null>(null);

  function submitRename(conversationId: string): void {
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (trimmed) {
      onRename(conversationId, trimmed);
    }
  }

  return (
    <aside className="glass-card flex h-full min-h-[420px] flex-col p-3" aria-label="chat-history">
      <button
        type="button"
        className="mb-3 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
        onClick={onNew}
      >
        New chat
      </button>
      {conversations.length === 0 ? (
        <p className="px-1 text-xs text-gray-400">
          No previous chats yet. Your conversations are saved automatically.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto">
          {conversations.map((conversation) => {
            const isActive = conversation.conversation_id === activeConversationId;
            const isEditing = conversation.conversation_id === editingId;
            return (
              <li key={conversation.conversation_id} className="group">
                {isEditing ? (
                  <input
                    aria-label="conversation-title-input"
                    className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100"
                    value={editingTitle}
                    autoFocus
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={() => submitRename(conversation.conversation_id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        submitRename(conversation.conversation_id);
                      }
                      if (event.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                  />
                ) : (
                  <div
                    className={`flex items-center gap-1 rounded px-2 py-1.5 ${
                      isActive ? "bg-blue-700/50" : "hover:bg-gray-800/60"
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelect(conversation.conversation_id)}
                    >
                      <span className="block truncate text-sm text-gray-100">
                        {conversation.title}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {toRelativeTime(conversation.updated_at)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`rename-conversation-${conversation.conversation_id}`}
                      className="hidden shrink-0 rounded p-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-100 group-hover:block"
                      title="Rename"
                      onClick={() => {
                        setEditingId(conversation.conversation_id);
                        setEditingTitle(conversation.title);
                      }}
                    >
                      &#9998;
                    </button>
                    <button
                      type="button"
                      aria-label={`delete-conversation-${conversation.conversation_id}`}
                      className="hidden shrink-0 rounded p-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-red-300 group-hover:block"
                      title="Delete"
                      onClick={() => setDeleteCandidate(conversation)}
                    >
                      &#10005;
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Modal
        open={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        title="Delete chat"
      >
        <p className="mb-3 text-sm text-gray-200">
          Delete &quot;{deleteCandidate?.title}&quot; and all its messages? This cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            onClick={() => setDeleteCandidate(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500"
            onClick={() => {
              if (deleteCandidate) {
                onDelete(deleteCandidate.conversation_id);
              }
              setDeleteCandidate(null);
            }}
          >
            Delete
          </button>
        </div>
      </Modal>
    </aside>
  );
}

export default ConversationList;
