import { request } from "@/api/client";
import type {
  CreateLinkRequest,
  CreateMilestoneRequest,
  CreateNoteRequest,
  CreateProjectRequest,
  CreateRiskRequest,
  CreateTaskRequest,
  LinkResponse,
  MilestoneResponse,
  NoteResponse,
  ProjectDetailResponse,
  ProjectResponse,
  RiskResponse,
  TaskResponse,
  UpdateMilestoneRequest,
  UpdateProjectRequest,
  UpdateRiskRequest,
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

export function listMilestones(projectId: string): Promise<MilestoneResponse[]> {
  return request<MilestoneResponse[]>(`/projects/${projectId}/milestones`);
}

export function createMilestone(
  projectId: string,
  data: CreateMilestoneRequest,
): Promise<MilestoneResponse> {
  return request<MilestoneResponse>(`/projects/${projectId}/milestones`, {
    method: "POST",
    body: data,
  });
}

export function updateMilestone(
  projectId: string,
  milestoneId: string,
  data: UpdateMilestoneRequest,
): Promise<MilestoneResponse> {
  return request<MilestoneResponse>(`/projects/${projectId}/milestones/${milestoneId}`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteMilestone(projectId: string, milestoneId: string): Promise<void> {
  return request<void>(`/projects/${projectId}/milestones/${milestoneId}`, {
    method: "DELETE",
  });
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

export function listRisks(projectId: string): Promise<RiskResponse[]> {
  return request<RiskResponse[]>(`/projects/${projectId}/risks`);
}

export function createRisk(projectId: string, data: CreateRiskRequest): Promise<RiskResponse> {
  return request<RiskResponse>(`/projects/${projectId}/risks`, {
    method: "POST",
    body: data,
  });
}

export function updateRisk(
  projectId: string,
  riskId: string,
  data: UpdateRiskRequest,
): Promise<RiskResponse> {
  return request<RiskResponse>(`/projects/${projectId}/risks/${riskId}`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteRisk(projectId: string, riskId: string): Promise<void> {
  return request<void>(`/projects/${projectId}/risks/${riskId}`, {
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
