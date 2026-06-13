import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactDetail from "@/components/contacts/ContactDetail";
import { mockContactDetail } from "@/test/contacts-fixtures";
import { mockProject } from "@/test/projects-fixtures";

vi.mock("@/components/contacts/AvatarDisplay", () => ({
  default: (): JSX.Element => <div data-testid="avatar-mock" />,
}));

const listProjectsMock = vi.fn();

vi.mock("@/api/projects", () => ({
  listProjects: (...args: unknown[]) => listProjectsMock(...args),
}));

describe("ContactDetail", () => {
  beforeEach(() => {
    listProjectsMock.mockReset();
    listProjectsMock.mockResolvedValue([
      mockProject,
      { ...mockProject, project_id: "project-2", name: "Projekt Beta" },
    ]);
  });

  it("zeigt Platzhalter ohne Kontakt", () => {
    render(
      <ContactDetail
        contact={null}
        loading={false}
        busy={false}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onUploadAvatar={vi.fn()}
        onDeleteAvatar={vi.fn()}
        onLinkProject={vi.fn()}
        onUnlinkProject={vi.fn()}
      />,
    );

    expect(screen.getByTestId("contact-detail-empty")).toHaveTextContent("Kontakt auswaehlen");
  });

  it("zeigt Ladezustand", () => {
    render(
      <ContactDetail
        contact={null}
        loading={true}
        busy={false}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onUploadAvatar={vi.fn()}
        onDeleteAvatar={vi.fn()}
        onLinkProject={vi.fn()}
        onUnlinkProject={vi.fn()}
      />,
    );

    expect(screen.getByTestId("contact-detail-loading")).toBeInTheDocument();
  });

  it("zeigt Stammdaten des Kontakts", async () => {
    render(
      <ContactDetail
        contact={{
          ...mockContactDetail,
          linked_projects: [{ project_id: "project-1", name: "Projekt Alpha", status: "active" }],
        }}
        loading={false}
        busy={false}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onUploadAvatar={vi.fn()}
        onDeleteAvatar={vi.fn()}
        onLinkProject={vi.fn()}
        onUnlinkProject={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(listProjectsMock).toHaveBeenCalled();
    });

    expect(screen.getByDisplayValue("Ada")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lovelace")).toBeInTheDocument();
    expect(screen.getByTestId("linked-projects")).toHaveTextContent("Projekt Alpha");
  });

  it("Speichern ruft onSave auf", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);

    render(
      <ContactDetail
        contact={{
          ...mockContactDetail,
          linked_projects: [],
        }}
        loading={false}
        busy={false}
        onSave={onSave}
        onDelete={vi.fn()}
        onUploadAvatar={vi.fn()}
        onDeleteAvatar={vi.fn()}
        onLinkProject={vi.fn()}
        onUnlinkProject={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(listProjectsMock).toHaveBeenCalled();
    });

    await user.clear(screen.getByLabelText("Vorname"));
    await user.type(screen.getByLabelText("Vorname"), "Charles");
    await user.click(screen.getByText("Speichern"));

    expect(onSave).toHaveBeenCalledWith(
      mockContactDetail.contact_id,
      expect.objectContaining({ first_name: "Charles" }),
    );
  });

  it("Verknuepfen ruft onLinkProject auf", async () => {
    const user = userEvent.setup();
    const onLinkProject = vi.fn(async () => undefined);

    render(
      <ContactDetail
        contact={{
          ...mockContactDetail,
          linked_projects: [{ project_id: "project-1", name: "Projekt Alpha", status: "active" }],
        }}
        loading={false}
        busy={false}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onUploadAvatar={vi.fn()}
        onDeleteAvatar={vi.fn()}
        onLinkProject={onLinkProject}
        onUnlinkProject={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(listProjectsMock).toHaveBeenCalled();
    });

    await user.selectOptions(screen.getByLabelText("Projekt verknuepfen"), "project-2");
    await user.click(screen.getByText("Verknuepfen"));

    expect(onLinkProject).toHaveBeenCalledWith(mockContactDetail.contact_id, "project-2");
  });
});
