import type { ProjectDetailResponse, ProjectResponse } from "@/api/types";

export const mockProject: ProjectResponse = {
  project_id: "project-1",
  name: "Projekt Alpha",
  description: "Testprojekt",
  status: "active",
  priority: "high",
  color: "#58a6ff",
  start_date: "2026-04-01",
  target_date: "2026-06-01",
  completed_date: null,
  task_count: 3,
  task_done_count: 1,
  risk_open_count: 2,
  next_milestone: "M1",
  created_at: "2026-04-05T08:00:00Z",
  updated_at: "2026-04-06T08:00:00Z",
};

export const mockProjectDetail: ProjectDetailResponse = {
  ...mockProject,
  milestones: [
    {
      milestone_id: "m1",
      project_id: "project-1",
      name: "M1",
      due_date: "2026-05-01",
      completed: false,
      completed_at: null,
      sort_order: 0,
      created_at: "2026-04-05T09:00:00Z",
    },
  ],
  tasks: [
    {
      task_id: "t1",
      project_id: "project-1",
      name: "Task offen",
      description: null,
      status: "open",
      priority: "medium",
      due_date: null,
      sort_order: 0,
      created_at: "2026-04-05T09:00:00Z",
      updated_at: "2026-04-05T09:00:00Z",
    },
    {
      task_id: "t2",
      project_id: "project-1",
      name: "Task erledigt",
      description: null,
      status: "done",
      priority: "low",
      due_date: null,
      sort_order: 1,
      created_at: "2026-04-05T09:00:00Z",
      updated_at: "2026-04-05T09:00:00Z",
    },
  ],
  risks: [
    {
      risk_id: "r1",
      project_id: "project-1",
      name: "Risikotest",
      description: "beschreibung",
      severity: "critical",
      status: "open",
      created_at: "2026-04-05T09:00:00Z",
      updated_at: "2026-04-05T09:00:00Z",
    },
  ],
  notes: [
    {
      note_id: "n1",
      project_id: "project-1",
      content: "Notiz 1",
      source: "user",
      created_at: "2026-04-05T10:00:00Z",
    },
  ],
  files: [
    {
      file_id: "f1",
      project_id: "project-1",
      filename: "stored-file.pdf",
      original_name: "vertrag.pdf",
      content_type: "application/pdf",
      size_bytes: 2048,
      created_at: "2026-04-05T11:00:00Z",
    },
  ],
  links: [
    {
      link_id: "l1",
      project_id: "project-1",
      name: "Referenz",
      url: "https://example.com",
      created_at: "2026-04-05T11:00:00Z",
    },
  ],
};
