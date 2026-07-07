import { useMemo, useState } from "react";
import Spinner from "@/components/common/Spinner";
import Toast from "@/components/common/Toast";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import FilesTab from "@/components/projects/tabs/FilesTab";
import LinksTab from "@/components/projects/tabs/LinksTab";
import MilestonesTab from "@/components/projects/tabs/MilestonesTab";
import NotesTab from "@/components/projects/tabs/NotesTab";
import OverviewTab from "@/components/projects/tabs/OverviewTab";
import RisksTab from "@/components/projects/tabs/RisksTab";
import TasksTab from "@/components/projects/tabs/TasksTab";

type ProjectWindowProps = {
  projectId: string;
};

type WindowTabId = "overview" | "tasks" | "milestones" | "risks" | "notes" | "files" | "links";

const tabs: Array<{ id: WindowTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "milestones", label: "Milestones" },
  { id: "risks", label: "Risks" },
  { id: "notes", label: "Notes" },
  { id: "files", label: "Files" },
  { id: "links", label: "Links" },
];

function ProjectWindow({ projectId }: ProjectWindowProps): JSX.Element {
  const {
    selectedProject,
    loading,
    error,
    toast,
    updateProject,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    createTask,
    updateTask,
    deleteTask,
    createRisk,
    updateRisk,
    deleteRisk,
    createNote,
    deleteNote,
    createLink,
    deleteLink,
    uploadFile,
    deleteFile,
    downloadFile,
    clearToast,
  } = useProjectDetail(projectId);
  const [activeTab, setActiveTab] = useState<WindowTabId>("overview");

  const tabContent = useMemo(() => {
    if (!selectedProject) {
      return null;
    }
    if (activeTab === "overview") {
      return <OverviewTab project={selectedProject} loading={loading} onUpdateProject={updateProject} />;
    }
    if (activeTab === "tasks") {
      return (
        <TasksTab
          project={selectedProject}
          loading={loading}
          onCreateTask={createTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
        />
      );
    }
    if (activeTab === "milestones") {
      return (
        <MilestonesTab
          project={selectedProject}
          loading={loading}
          onCreateMilestone={createMilestone}
          onUpdateMilestone={updateMilestone}
          onDeleteMilestone={deleteMilestone}
        />
      );
    }
    if (activeTab === "risks") {
      return (
        <RisksTab
          project={selectedProject}
          loading={loading}
          onCreateRisk={createRisk}
          onUpdateRisk={updateRisk}
          onDeleteRisk={deleteRisk}
        />
      );
    }
    if (activeTab === "notes") {
      return (
        <NotesTab
          project={selectedProject}
          loading={loading}
          onCreateNote={createNote}
          onDeleteNote={deleteNote}
        />
      );
    }
    if (activeTab === "files") {
      return (
        <FilesTab
          project={selectedProject}
          loading={loading}
          onUploadFile={uploadFile}
          onDeleteFile={deleteFile}
          onDownloadFile={downloadFile}
        />
      );
    }
    return (
      <LinksTab
        project={selectedProject}
        loading={loading}
        onCreateLink={createLink}
        onDeleteLink={deleteLink}
      />
    );
  }, [
    activeTab,
    clearToast,
    createLink,
    createMilestone,
    createNote,
    createRisk,
    createTask,
    deleteFile,
    deleteLink,
    deleteMilestone,
    deleteNote,
    deleteRisk,
    deleteTask,
    downloadFile,
    loading,
    selectedProject,
    updateMilestone,
    updateProject,
    updateRisk,
    updateTask,
    uploadFile,
  ]);

  if (loading && !selectedProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="rounded-md border border-red-700/40 bg-red-900/20 p-3 text-sm text-red-100">
        {error ?? "Failed to load project."}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} timeoutMs={3200} />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <nav className="flex flex-wrap gap-2 border-b border-gray-700 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`rounded px-3 py-1 text-sm ${
              activeTab === tab.id
                ? "border border-blue-500/40 bg-blue-900/35 text-blue-100"
                : "text-gray-300 hover:bg-gray-800"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {tabContent}
    </section>
  );
}

export default ProjectWindow;
