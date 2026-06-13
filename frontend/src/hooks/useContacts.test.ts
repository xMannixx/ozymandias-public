import { act, renderHook, waitFor } from "@testing-library/react";
import { useContacts } from "@/hooks/useContacts";
import { mockContact, mockContactDetail } from "@/test/contacts-fixtures";

const listContactsMock = vi.fn();
const getContactMock = vi.fn();
const createContactMock = vi.fn();
const updateContactMock = vi.fn();
const deleteContactMock = vi.fn();
const uploadAvatarMock = vi.fn();
const deleteAvatarMock = vi.fn();
const linkProjectMock = vi.fn();
const unlinkProjectMock = vi.fn();

vi.mock("@/api/contacts", () => ({
  listContacts: (...args: unknown[]) => listContactsMock(...args),
  getContact: (...args: unknown[]) => getContactMock(...args),
  createContact: (...args: unknown[]) => createContactMock(...args),
  updateContact: (...args: unknown[]) => updateContactMock(...args),
  deleteContact: (...args: unknown[]) => deleteContactMock(...args),
  uploadAvatar: (...args: unknown[]) => uploadAvatarMock(...args),
  deleteAvatar: (...args: unknown[]) => deleteAvatarMock(...args),
  linkProject: (...args: unknown[]) => linkProjectMock(...args),
  unlinkProject: (...args: unknown[]) => unlinkProjectMock(...args),
}));

describe("useContacts", () => {
  const taggedA = { ...mockContact, tags: ["alpha"] };
  const taggedB = { ...mockContact, contact_id: "c2", tags: ["beta"] };

  beforeEach(() => {
    listContactsMock.mockReset();
    getContactMock.mockReset();
    createContactMock.mockReset();
    updateContactMock.mockReset();
    deleteContactMock.mockReset();
    uploadAvatarMock.mockReset();
    deleteAvatarMock.mockReset();
    linkProjectMock.mockReset();
    unlinkProjectMock.mockReset();

    listContactsMock.mockImplementation((_search?: string, tag?: string) => {
      if (tag === "alpha") {
        return Promise.resolve([taggedA]);
      }
      return Promise.resolve([taggedA, taggedB]);
    });
    getContactMock.mockImplementation((id: string) => ({ ...mockContactDetail, contact_id: id }));
    createContactMock.mockResolvedValue({ ...mockContact, contact_id: "new-c" });
    updateContactMock.mockResolvedValue(mockContact);
    deleteContactMock.mockResolvedValue(undefined);
    uploadAvatarMock.mockResolvedValue({ ...mockContact, has_avatar: true });
    deleteAvatarMock.mockResolvedValue(undefined);
    linkProjectMock.mockResolvedValue(undefined);
    unlinkProjectMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("laedt Kontakte beim Mount", async () => {
    const { result } = renderHook(() => useContacts());

    await waitFor(() => {
      expect(result.current.contacts).toHaveLength(2);
    });
    expect(listContactsMock).toHaveBeenCalledWith(undefined, undefined);
    expect(result.current.allTags).toEqual(["alpha", "beta"]);
  });

  it("allTags bleibt stabil bei Tag-Filter", async () => {
    const { result } = renderHook(() => useContacts());

    await waitFor(() => {
      expect(result.current.allTags).toEqual(["alpha", "beta"]);
    });

    act(() => {
      result.current.setTagFilter("alpha");
    });

    await waitFor(() => {
      expect(result.current.contacts).toHaveLength(1);
    });
    expect(result.current.allTags).toEqual(["alpha", "beta"]);
  });

  it("createContact laedt Tag-Index neu", async () => {
    const { result } = renderHook(() => useContacts());

    await waitFor(() => {
      expect(result.current.contacts.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.createContact({ first_name: "Neu" });
    });

    expect(createContactMock).toHaveBeenCalled();
    const unfilteredCalls = listContactsMock.mock.calls.filter((c) => c[0] === undefined && c[1] === undefined);
    expect(unfilteredCalls.length).toBeGreaterThanOrEqual(2);
  });
});
