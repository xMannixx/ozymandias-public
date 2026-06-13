import { ApiError, authRedirect, request } from "@/api/client";
import type { ProjectFileResponse } from "@/api/types";
import { forceLogout, getToken } from "@/store/auth";

const baseUrl = (import.meta.env.VITE_API_URL ?? "").trim();

function buildUrl(path: string): string {
  if (!baseUrl) {
    return path;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function parseErrorPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function getErrorMessage(payload: unknown, defaultMessage: string): string {
  if (typeof payload !== "object" || payload === null || !("detail" in payload)) {
    return defaultMessage;
  }
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  return defaultMessage;
}

export function listFiles(projectId: string): Promise<ProjectFileResponse[]> {
  return request<ProjectFileResponse[]>(`/files/${projectId}/files`);
}

export function uploadFile(projectId: string, file: File): Promise<ProjectFileResponse> {
  const formData = new FormData();
  formData.set("file", file);
  return request<ProjectFileResponse>(`/files/${projectId}/upload`, {
    method: "POST",
    body: formData,
  });
}

export async function downloadFile(projectId: string, fileId: string): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(`/files/${projectId}/files/${fileId}/download`), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    if (response.status === 401) {
      forceLogout();
      if (window.location.pathname !== "/login") {
        authRedirect.toLogin();
      }
      throw new ApiError("Unauthorized", 401, payload);
    }
    const defaultMessage = response.status >= 500 ? "Server-Fehler" : "Download fehlgeschlagen";
    throw new ApiError(getErrorMessage(payload, defaultMessage), response.status, payload);
  }

  return response.blob();
}

export function deleteFile(projectId: string, fileId: string): Promise<void> {
  return request<void>(`/files/${projectId}/files/${fileId}`, {
    method: "DELETE",
  });
}
