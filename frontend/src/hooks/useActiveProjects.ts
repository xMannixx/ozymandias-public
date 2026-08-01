import { useEffect, useState } from "react";
import { listProjects } from "@/api/projects";
import type { ProjectResponse } from "@/api/types";

/**
 * Active projects, for places that only need to name or pick a workspace.
 * Failures are silent: callers degrade to an unscoped experience.
 */
export function useActiveProjects(): ProjectResponse[] {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const items = await listProjects("active");
        if (mounted) {
          setProjects(items);
        }
      } catch {
        // Leave the list empty.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return projects;
}
