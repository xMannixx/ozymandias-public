import { request } from "@/api/client";
import type {
  ContactDetailResponse,
  ContactLinkedProject,
  ContactResponse,
  CreateContactRequest,
  LinkProjectRequest,
  UpdateContactRequest,
} from "@/api/types";

function buildListQuery(search?: string, tag?: string): string {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  if (tag?.trim()) {
    params.set("tag", tag.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listContacts(search?: string, tag?: string): Promise<ContactResponse[]> {
  return request<ContactResponse[]>(`/contacts${buildListQuery(search, tag)}`);
}

export function getContact(contactId: string): Promise<ContactDetailResponse> {
  return request<ContactDetailResponse>(`/contacts/${contactId}`);
}

export function createContact(data: CreateContactRequest): Promise<ContactResponse> {
  return request<ContactResponse>("/contacts", {
    method: "POST",
    body: data as unknown as Record<string, unknown>,
  });
}

export function updateContact(contactId: string, data: UpdateContactRequest): Promise<ContactResponse> {
  return request<ContactResponse>(`/contacts/${contactId}`, {
    method: "PATCH",
    body: data as unknown as Record<string, unknown>,
  });
}

export function deleteContact(contactId: string): Promise<void> {
  return request<void>(`/contacts/${contactId}`, {
    method: "DELETE",
  });
}

export function uploadAvatar(contactId: string, file: File): Promise<ContactResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<ContactResponse>(`/contacts/${contactId}/avatar`, {
    method: "POST",
    body: form,
  });
}

export function deleteAvatar(contactId: string): Promise<void> {
  return request<void>(`/contacts/${contactId}/avatar`, {
    method: "DELETE",
  });
}

export function listLinkedProjects(contactId: string): Promise<ContactLinkedProject[]> {
  return request<ContactLinkedProject[]>(`/contacts/${contactId}/projects`);
}

export function linkProject(contactId: string, data: LinkProjectRequest): Promise<void> {
  return request<void>(`/contacts/${contactId}/projects`, {
    method: "POST",
    body: data as unknown as Record<string, unknown>,
  });
}

export function unlinkProject(contactId: string, projectId: string): Promise<void> {
  return request<void>(`/contacts/${contactId}/projects/${projectId}`, {
    method: "DELETE",
  });
}
