import { request } from "@/api/client";
import type { ConversationMessageResponse, ConversationResponse } from "@/api/types";

export async function listConversations(): Promise<ConversationResponse[]> {
  return request<ConversationResponse[]>("/conversations");
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
