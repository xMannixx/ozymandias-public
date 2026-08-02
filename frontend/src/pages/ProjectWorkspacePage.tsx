import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Spinner from "@/components/common/Spinner";
import Toast from "@/components/common/Toast";
import WorkspaceChat from "@/components/projects/WorkspaceChat";
import InstructionsTab from "@/components/projects/tabs/InstructionsTab";
import KnowledgeTab from "@/components/projects/tabs/KnowledgeTab";
import NotesTab from "@/components/projects/tabs/NotesTab";
import TasksTab from "@/components/projects/tabs/TasksTab";
import { useProjectDetail } from "@/hooks/useProjectDetail";

type WorkspaceTabId = "chat" | "knowledge" | "instructions" | "tasks" | "notes";

function ProjectWorkspacePage(): JSX.Element {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const {
    selectedProject,
    loading,
    error,
    toast,
    refetch,
    updateProject,
    createTask,
    updateTask,
    deleteTask,
    createNote,
    deleteNote,
    createLink,
    deleteLink,
    uploadFile,
    deleteFile,
    downloadFile,
    clearToast,
  } = useProjectDetail(projectId);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>("chat");

  if (loading && !selectedProject) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <section className="glass-card space-y-3 p-6">
        <h1 className="text-lg font-medium text-zinc-100">Workspace not found</h1>
        <p className="text-sm text-zinc-400">{error ?? "This project could not be loaded."}</p>
        <Link to="/projects" className="text-sm text-indigo-300 hover:underline">
          Back to all projects
        </Link>
      </section>
    );
  }

  const openTasks = selectedProject.tasks.filter((task) => task.status !== "done").length;
  const tabs: Array<{ id: WorkspaceTabId; label: string; hint: string | null }> = [
    { id: "chat", label: "Chat", hint: null },
    {
      id: "knowledge",
      label: "Knowledge",
      hint: selectedProject.knowledge_count > 0 ? selectedProject.knowledge_count.toString() : null,
    },
    {
      id: "instructions",
      label: "Instructions",
      hint: selectedProject.instructions ? "set" : null,
    },
    { id: "tasks", label: "Tasks", hint: openTasks > 0 ? openTasks.toString() : null },
    {
      id: "notes",
      label: "Notes",
      hint: selectedProject.notes.length > 0 ? selectedProject.notes.length.toString() : null,
    },
  ];
  const keepsLocal = selectedProject.sensitivity === "S3" || selectedProject.sensitivity === "S4";

  return (
    <section className="space-y-4">
      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} timeoutMs={3200} />
        </div>
      ) : null}

      <header className="space-y-3">
        <Link to="/projects" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← All projects
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-medium text-zinc-100">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selectedProject.color ?? "#7c8cff" }}
              />
              {selectedProject.name}
            </h1>
            {selectedProject.description ? (
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">{selectedProject.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-white/[0.09] bg-white/[0.03] px-2 py-0.5 text-zinc-300">
              {selectedProject.status}
            </span>
            {keepsLocal ? (
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
                Local models only
              </span>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Everything here travels into this workspace&apos;s chats:{" "}
          {selectedProject.instructions ? "your instructions, " : ""}
          {selectedProject.knowledge_count.toString()} readable{" "}
          {selectedProject.knowledge_count === 1 ? "file" : "files"}, {openTasks.toString()} open{" "}
          {openTasks === 1 ? "task" : "tasks"} and {selectedProject.notes.length.toString()}{" "}
          {selectedProject.notes.length === 1 ? "note" : "notes"}.
        </p>
      </header>

      <div
        className="flex flex-wrap gap-1 border-b border-white/[0.06] pb-2"
        role="tablist"
        aria-label="Workspace sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-white/[0.06] text-zinc-100"
                : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.hint ? <span className="ml-1.5 text-xs text-zinc-500">{tab.hint}</span> : null}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {activeTab === "chat" ? (
        <WorkspaceChat
          projectId={projectId}
          projectName={selectedProject.name}
          hasInstructions={Boolean(selectedProject.instructions)}
          knowledgeCount={selectedProject.knowledge_count}
          onConversationChange={() => {
            void refetch();
          }}
        />
      ) : null}
      {activeTab === "knowledge" ? (
        <KnowledgeTab
          project={selectedProject}
          loading={loading}
          onUploadFile={uploadFile}
          onDeleteFile={deleteFile}
          onDownloadFile={downloadFile}
          onCreateLink={createLink}
          onDeleteLink={deleteLink}
        />
      ) : null}
      {activeTab === "instructions" ? (
        <InstructionsTab
          project={selectedProject}
          loading={loading}
          onUpdateProject={updateProject}
        />
      ) : null}
      {activeTab === "tasks" ? (
        <TasksTab
          project={selectedProject}
          loading={loading}
          onCreateTask={createTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
        />
      ) : null}
      {activeTab === "notes" ? (
        <NotesTab
          project={selectedProject}
          loading={loading}
          onCreateNote={createNote}
          onDeleteNote={deleteNote}
        />
      ) : null}
    </section>
  );
}

export default ProjectWorkspacePage;
