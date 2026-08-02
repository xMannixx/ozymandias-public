import { request } from "@/api/client";
import type {
  CreateLinkRequest,
  CreateNoteRequest,
  CreateProjectRequest,
  CreateTaskRequest,
  LinkResponse,
  NoteResponse,
  ProjectChatResponse,
  ProjectDetailResponse,
  ProjectResponse,
  TaskResponse,
  UpdateProjectRequest,
  UpdateTaskRequest,
} from "@/api/types";

function buildStatusQuery(status?: string): string {
  if (!status) {
    return "";
  }
  const searchParams = new URLSearchParams();
  searchParams.set("status", status);
  return `?${searchParams.toString()}`;
}

export function listProjects(status?: string): Promise<ProjectResponse[]> {
  return request<ProjectResponse[]>(`/projects${buildStatusQuery(status)}`);
}

export function getProject(id: string): Promise<ProjectDetailResponse> {
  return request<ProjectDetailResponse>(`/projects/${id}`);
}

export function createProject(data: CreateProjectRequest): Promise<ProjectResponse> {
  return request<ProjectResponse>("/projects", {
    method: "POST",
    body: data,
  });
}

export function updateProject(id: string, data: UpdateProjectRequest): Promise<ProjectResponse> {
  return request<ProjectResponse>(`/projects/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteProject(id: string): Promise<void> {
  return request<void>(`/projects/${id}`, {
    method: "DELETE",
  });
}

export function listProjectChats(projectId: string): Promise<ProjectChatResponse[]> {
  return request<ProjectChatResponse[]>(`/projects/${projectId}/chats`);
}

export function listTasks(projectId: string, status?: string): Promise<TaskResponse[]> {
  return request<TaskResponse[]>(`/projects/${projectId}/tasks${buildStatusQuery(status)}`);
}

export function createTask(projectId: string, data: CreateTaskRequest): Promise<TaskResponse> {
  return request<TaskResponse>(`/projects/${projectId}/tasks`, {
    method: "POST",
    body: data,
  });
}

export function updateTask(
  projectId: string,
  taskId: string,
  data: UpdateTaskRequest,
): Promise<TaskResponse> {
  return request<TaskResponse>(`/projects/${projectId}/tasks/${taskId}`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteTask(projectId: string, taskId: string): Promise<void> {
  return request<void>(`/projects/${projectId}/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export function listNotes(projectId: string): Promise<NoteResponse[]> {
  return request<NoteResponse[]>(`/projects/${projectId}/notes`);
}

export function createNote(projectId: string, data: CreateNoteRequest): Promise<NoteResponse> {
  return request<NoteResponse>(`/projects/${projectId}/notes`, {
    method: "POST",
    body: data,
  });
}

export function deleteNote(projectId: string, noteId: string): Promise<void> {
  return request<void>(`/projects/${projectId}/notes/${noteId}`, {
    method: "DELETE",
  });
}

export function listLinks(projectId: string): Promise<LinkResponse[]> {
  return request<LinkResponse[]>(`/projects/${projectId}/links`);
}

export function createLink(projectId: string, data: CreateLinkRequest): Promise<LinkResponse> {
  return request<LinkResponse>(`/projects/${projectId}/links`, {
    method: "POST",
    body: data,
  });
}

export function deleteLink(projectId: string, linkId: string): Promise<void> {
  return request<void>(`/projects/${projectId}/links/${linkId}`, {
    method: "DELETE",
  });
}
