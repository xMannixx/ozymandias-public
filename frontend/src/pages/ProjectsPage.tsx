import ProjectList from "@/components/projects/ProjectList";
import { useProjects } from "@/hooks/useProjects";

function ProjectsPage(): JSX.Element {
  const {
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
  } = useProjects();

  return (
    <ProjectList
      projects={projects}
      loading={loading}
      error={error}
      statusFilter={statusFilter}
      toast={toast}
      setStatusFilter={setStatusFilter}
      createProject={createProject}
      deleteProject={deleteProject}
      clearToast={clearToast}
      refetch={refetch}
    />
  );
}

export default ProjectsPage;
