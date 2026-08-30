import { request } from "@/api/client";
import type { ChatStarter, ConversationMessageResponse, ConversationResponse } from "@/api/types";

/** Lists chats, narrowed to one workspace when a project id is given. */
export async function listConversations(projectId?: string): Promise<ConversationResponse[]> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return request<ConversationResponse[]>(`/conversations${query}`);
}

/** Suggestions for the empty chat screen, built from the account's open items. */
export async function listChatStarters(): Promise<ChatStarter[]> {
  return request<ChatStarter[]>("/conversations/starters");
}

export async function getConversationMessages(
  conversationId: string,
): Promise<ConversationMessageResponse[]> {
  return request<ConversationMessageResponse[]>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
}

export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<ConversationResponse> {
  return request<ConversationResponse>(`/conversations/${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    body: { title },
  });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await request<void>(`/conversations/${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
  });
}
