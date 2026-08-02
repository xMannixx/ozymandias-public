import type { ContactDetailResponse, ContactResponse } from "@/api/types";

export const mockContact: ContactResponse = {
  contact_id: "contact-1",
  first_name: "Ada",
  last_name: "Lovelace",
  company: "Analytical Engines Ltd",
  role: "Pioneer",
  phones: [{ label: "Work", number: "+491234567" }],
  emails: [{ label: "Work", email: "ada@example.com" }],
  tags: ["Arbeit", "VIP"],
  has_avatar: true,
  sensitivity: "S2",
  created_at: "2024-01-01T10:00:00Z",
  updated_at: "2024-01-02T10:00:00Z",
};

export const mockContactDetail: ContactDetailResponse = {
  ...mockContact,
  address: "London",
  birthday: "1815-12-10",
  notes: "Notizen",
  linked_projects: [{ project_id: "p1", name: "Projekt Alpha", status: "active" }],
};
