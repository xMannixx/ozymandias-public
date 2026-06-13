import FloatingWindow from "@/components/common/FloatingWindow";
import WindowTaskbar from "@/components/common/WindowTaskbar";
import ProjectList from "@/components/projects/ProjectList";
import ProjectWindow from "@/components/projects/ProjectWindow";
import { useProjects } from "@/hooks/useProjects";
import { useWindowManager } from "@/hooks/useWindowManager";

function ProjectsPage(): JSX.Element {
  const { projects, loading, error, statusFilter, toast, setStatusFilter, createProject, deleteProject, refetch, clearToast } =
    useProjects();
  const {
    windows,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    bringToFront,
    updateWindowGeometry,
    toggleMaximizeWindow,
  } = useWindowManager();

  return (
    <section className="relative space-y-4 pb-14">
      <ProjectList
        projects={projects}
        loading={loading}
        error={error}
        statusFilter={statusFilter}
        toast={toast}
        setStatusFilter={setStatusFilter}
        createProject={createProject}
        deleteProject={deleteProject}
        openProject={(projectId, projectName) => {
          const offset = windows.length * 24;
          openWindow(projectId, projectName, { x: 100 + offset, y: 110 + offset }, { width: 920, height: 640 });
        }}
        clearToast={clearToast}
        refetch={refetch}
      />

      {windows
        .filter((windowItem) => !windowItem.isMinimized)
        .map((windowItem) => (
          <FloatingWindow
            key={windowItem.id}
            title={windowItem.title}
            windowId={windowItem.id}
            position={windowItem.position}
            size={windowItem.size}
            zIndex={windowItem.zIndex}
            isMaximized={windowItem.isMaximized}
            onClose={() => closeWindow(windowItem.id)}
            onMinimize={() => minimizeWindow(windowItem.id)}
            onBringToFront={() => bringToFront(windowItem.id)}
            onToggleMaximize={() => toggleMaximizeWindow(windowItem.id)}
            onGeometryChange={(position, size) => updateWindowGeometry(windowItem.id, position, size)}
          >
            <ProjectWindow projectId={windowItem.id} />
          </FloatingWindow>
        ))}

      <WindowTaskbar windows={windows} onRestore={restoreWindow} />
    </section>
  );
}

export default ProjectsPage;
