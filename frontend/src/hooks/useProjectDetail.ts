import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  createLink,
  createNote,
  createTask,
  getProject,
  updateProject as updateProjectApi,
  updateTask,
  deleteLink,
  deleteNote,
  deleteTask,
} from "@/api/projects";
import {
  deleteFile as deleteFileApi,
  downloadFile as downloadFileApi,
  uploadFile as uploadFileApi,
} from "@/api/files";
import type {
  CreateLinkRequest,
  CreateNoteRequest,
  CreateTaskRequest,
  ProjectDetailResponse,
  UpdateProjectRequest,
  UpdateTaskRequest,
} from "@/api/types";

type ToastMessage = {
  message: string;
  type: "success" | "error" | "info";
};

type UseProjectDetailResult = {
  selectedProject: ProjectDetailResponse | null;
  loading: boolean;
  error: string | null;
  toast: ToastMessage | null;
  refetch: () => Promise<void>;
  updateProject: (data: UpdateProjectRequest) => Promise<void>;
  createTask: (data: CreateTaskRequest) => Promise<void>;
  updateTask: (taskId: string, data: UpdateTaskRequest) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  createNote: (data: CreateNoteRequest) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  createLink: (data: CreateLinkRequest) => Promise<void>;
  deleteLink: (linkId: string) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  downloadFile: (fileId: string) => Promise<void>;
  clearToast: () => void;
};

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Project action failed";
}

function getActiveProjectId(projectId: string | null): string {
  if (!projectId) {
    throw new Error("No project selected");
  }
  return projectId;
}

export function useProjectDetail(projectId: string | null): UseProjectDetailResult {
  const [selectedProject, setSelectedProject] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const refetch = useCallback(async () => {
    if (!projectId) {
      setSelectedProject(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getProject(projectId);
      setSelectedProject(response);
    } catch (err) {
      setError(normalizeError(err));
      setSelectedProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const runMutation = useCallback(
    async (runner: (activeProjectId: string) => Promise<void>, successMessage: string) => {
      setLoading(true);
      setError(null);
      try {
        const activeProjectId = getActiveProjectId(projectId);
        await runner(activeProjectId);
        await refetch();
        setToast({ type: "success", message: successMessage });
      } catch (err) {
        const message = normalizeError(err);
        setError(message);
        setToast({ type: "error", message });
      } finally {
        setLoading(false);
      }
    },
    [projectId, refetch],
  );

  const updateProject = useCallback(
    async (data: UpdateProjectRequest) => {
      await runMutation(
        async (activeProjectId) => {
          await updateProjectApi(activeProjectId, data);
        },
        "Project updated.",
      );
    },
    [runMutation],
  );

  const createTaskAction = useCallback(
    async (data: CreateTaskRequest) => {
      await runMutation(
        async (activeProjectId) => {
          await createTask(activeProjectId, data);
        },
        "Task created.",
      );
    },
    [runMutation],
  );

  const updateTaskAction = useCallback(
    async (taskId: string, data: UpdateTaskRequest) => {
      await runMutation(
        async (activeProjectId) => {
          await updateTask(activeProjectId, taskId, data);
        },
        "Task updated.",
      );
    },
    [runMutation],
  );

  const deleteTaskAction = useCallback(
    async (taskId: string) => {
      await runMutation(
        async (activeProjectId) => {
          await deleteTask(activeProjectId, taskId);
        },
        "Task deleted.",
      );
    },
    [runMutation],
  );

  const createNoteAction = useCallback(
    async (data: CreateNoteRequest) => {
      await runMutation(
        async (activeProjectId) => {
          await createNote(activeProjectId, data);
        },
        "Note created.",
      );
    },
    [runMutation],
  );

  const deleteNoteAction = useCallback(
    async (noteId: string) => {
      await runMutation(
        async (activeProjectId) => {
          await deleteNote(activeProjectId, noteId);
        },
        "Note deleted.",
      );
    },
    [runMutation],
  );

  const createLinkAction = useCallback(
    async (data: CreateLinkRequest) => {
      await runMutation(
        async (activeProjectId) => {
          await createLink(activeProjectId, data);
        },
        "Link created.",
      );
    },
    [runMutation],
  );

  const deleteLinkAction = useCallback(
    async (linkId: string) => {
      await runMutation(
        async (activeProjectId) => {
          await deleteLink(activeProjectId, linkId);
        },
        "Link deleted.",
      );
    },
    [runMutation],
  );

  const uploadFileAction = useCallback(
    async (file: File) => {
      await runMutation(
        async (activeProjectId) => {
          await uploadFileApi(activeProjectId, file);
        },
        "File uploaded.",
      );
    },
    [runMutation],
  );

  const deleteFileAction = useCallback(
    async (fileId: string) => {
      await runMutation(
        async (activeProjectId) => {
          await deleteFileApi(activeProjectId, fileId);
        },
        "File deleted.",
      );
    },
    [runMutation],
  );

  const downloadFileAction = useCallback(async (fileId: string) => {
    setLoading(true);
    setError(null);
    try {
      const activeProjectId = getActiveProjectId(projectId);
      const blob = await downloadFileApi(activeProjectId, fileId);
      const row = selectedProject?.files.find((file) => file.file_id === fileId);
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = row?.original_name ?? row?.filename ?? "download";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      setToast({ type: "success", message: "Download started." });
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedProject]);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    selectedProject,
    loading,
    error,
    toast,
    refetch,
    updateProject,
    createTask: createTaskAction,
    updateTask: updateTaskAction,
    deleteTask: deleteTaskAction,
    createNote: createNoteAction,
    deleteNote: deleteNoteAction,
    createLink: createLinkAction,
    deleteLink: deleteLinkAction,
    uploadFile: uploadFileAction,
    deleteFile: deleteFileAction,
    downloadFile: downloadFileAction,
    clearToast,
  };
}
