import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { createProject as createProjectApi, deleteProject as deleteProjectApi, listProjects } from "@/api/projects";
import type { CreateProjectRequest, ProjectResponse } from "@/api/types";

type ToastMessage = {
  message: string;
  type: "success" | "error" | "info";
};

type UseProjectsResult = {
  projects: ProjectResponse[];
  loading: boolean;
  error: string | null;
  statusFilter: string | null;
  toast: ToastMessage | null;
  setStatusFilter: (value: string | null) => void;
  createProject: (data: CreateProjectRequest) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
  clearToast: () => void;
};

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Projektaktion fehlgeschlagen";
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listProjects(statusFilter ?? undefined);
      setProjects(response);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const createProject = useCallback(
    async (data: CreateProjectRequest) => {
      setLoading(true);
      setError(null);
      try {
        const created = await createProjectApi(data);
        if (statusFilter && created.status !== statusFilter) {
          setProjects((current) => current);
        } else {
          setProjects((current) => [created, ...current]);
        }
        setToast({ type: "success", message: "Projekt erstellt." });
        if (statusFilter && created.status !== statusFilter) {
          await refetch();
        }
      } catch (err) {
        const message = normalizeError(err);
        setError(message);
        setToast({ type: "error", message });
      } finally {
        setLoading(false);
      }
    },
    [refetch, statusFilter],
  );

  const deleteProject = useCallback(async (id: string) => {
    if (!window.confirm("Projekt wirklich loeschen?")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await deleteProjectApi(id);
      setProjects((current) => current.filter((item) => item.project_id !== id));
      setToast({ type: "success", message: "Projekt geloescht." });
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    projects,
    loading,
    error,
    statusFilter,
    toast,
    setStatusFilter,
    createProject,
    deleteProject,
    refetch,
    clearToast,
  };
}
