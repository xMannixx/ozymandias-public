import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  createContact as createContactApi,
  deleteContact as deleteContactApi,
  deleteAvatar as deleteAvatarApi,
  getContact,
  linkProject as linkProjectApi,
  listContacts,
  unlinkProject as unlinkProjectApi,
  updateContact as updateContactApi,
  uploadAvatar as uploadAvatarApi,
} from "@/api/contacts";
import type { ContactDetailResponse, ContactResponse, CreateContactRequest, UpdateContactRequest } from "@/api/types";

type ToastMessage = {
  message: string;
  type: "success" | "error" | "info";
};

function deriveTags(contacts: ContactResponse[]): string[] {
  const set = new Set<string>();
  for (const c of contacts) {
    for (const t of c.tags) {
      if (t.trim()) {
        set.add(t);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Contact action failed";
}

export type UseContactsResult = {
  contacts: ContactResponse[];
  allTags: string[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  tagFilter: string | null;
  toast: ToastMessage | null;
  selectedContact: ContactDetailResponse | null;
  detailLoading: boolean;
  setSearchQuery: (value: string) => void;
  setTagFilter: (value: string | null) => void;
  selectContact: (contactId: string | null) => Promise<void>;
  createContact: (data: CreateContactRequest) => Promise<void>;
  updateContact: (contactId: string, data: UpdateContactRequest) => Promise<void>;
  deleteContact: (contactId: string) => Promise<void>;
  uploadAvatar: (contactId: string, file: File) => Promise<void>;
  deleteAvatar: (contactId: string) => Promise<void>;
  linkProject: (contactId: string, projectId: string) => Promise<void>;
  unlinkProject: (contactId: string, projectId: string) => Promise<void>;
  refetch: () => Promise<void>;
  clearToast: () => void;
};

export function useContacts(): UseContactsResult {
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refreshTagIndex = useCallback(async () => {
    try {
      const full = await listContacts();
      setAllTags(deriveTags(full));
    } catch {
      /* ignore tag index refresh errors */
    }
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listContacts(searchQuery.trim() || undefined, tagFilter ?? undefined);
      setContacts(data);
      if (!searchQuery.trim() && !tagFilter) {
        setAllTags(deriveTags(data));
      }
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, tagFilter]);

  const selectContact = useCallback(
    async (contactId: string | null) => {
      if (!contactId) {
        setSelectedContact(null);
        return;
      }
      setDetailLoading(true);
      setError(null);
      try {
        const detail = await getContact(contactId);
        setSelectedContact(detail);
      } catch (err) {
        setError(normalizeError(err));
        setSelectedContact(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  const createContact = useCallback(
    async (data: CreateContactRequest) => {
      setLoading(true);
      setError(null);
      try {
        const created = await createContactApi(data);
        setContacts((current) => [created, ...current]);
        setToast({ type: "success", message: "Kontakt erstellt." });
        await refreshTagIndex();
        await selectContact(created.contact_id);
      } catch (err) {
        const message = normalizeError(err);
        setError(message);
        setToast({ type: "error", message });
      } finally {
        setLoading(false);
      }
    },
    [refreshTagIndex, selectContact],
  );

  const updateContact = useCallback(
    async (contactId: string, data: UpdateContactRequest) => {
      setLoading(true);
      setError(null);
      try {
        const updated = await updateContactApi(contactId, data);
        setContacts((current) => current.map((c) => (c.contact_id === contactId ? updated : c)));
        setSelectedContact((current) => {
          if (!current || current.contact_id !== contactId) {
            return current;
          }
          return {
            ...current,
            ...updated,
            linked_projects: current.linked_projects,
            ...(data.notes !== undefined ? { notes: data.notes } : {}),
            ...(data.address !== undefined ? { address: data.address } : {}),
            ...(data.birthday !== undefined ? { birthday: data.birthday } : {}),
          };
        });
        setToast({ type: "success", message: "Kontakt aktualisiert." });
        await refreshTagIndex();
      } catch (err) {
        const message = normalizeError(err);
        setError(message);
        setToast({ type: "error", message });
      } finally {
        setLoading(false);
      }
    },
    [refreshTagIndex],
  );

  const deleteContact = useCallback(
    async (contactId: string) => {
      if (!window.confirm("Delete this contact?")) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await deleteContactApi(contactId);
        setContacts((current) => current.filter((c) => c.contact_id !== contactId));
        setSelectedContact((current) => (current?.contact_id === contactId ? null : current));
        setToast({ type: "success", message: "Kontakt geloescht." });
        await refreshTagIndex();
      } catch (err) {
        const message = normalizeError(err);
        setError(message);
        setToast({ type: "error", message });
      } finally {
        setLoading(false);
      }
    },
    [refreshTagIndex],
  );

  const uploadAvatar = useCallback(async (contactId: string, file: File) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await uploadAvatarApi(contactId, file);
      setContacts((current) => current.map((c) => (c.contact_id === contactId ? updated : c)));
      setSelectedContact((current) => {
        if (!current || current.contact_id !== contactId) {
          return current;
        }
        return { ...current, ...updated, linked_projects: current.linked_projects };
      });
      setToast({ type: "success", message: "Avatar hochgeladen." });
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAvatar = useCallback(async (contactId: string) => {
    setLoading(true);
    setError(null);
    try {
      await deleteAvatarApi(contactId);
      setContacts((current) =>
        current.map((c) => (c.contact_id === contactId ? { ...c, has_avatar: false } : c)),
      );
      setSelectedContact((current) =>
        current && current.contact_id === contactId ? { ...current, has_avatar: false } : current,
      );
      setToast({ type: "success", message: "Avatar entfernt." });
    } catch (err) {
      const message = normalizeError(err);
      setError(message);
      setToast({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, []);

  const linkProject = useCallback(
    async (contactId: string, projectId: string) => {
      setLoading(true);
      setError(null);
      try {
        await linkProjectApi(contactId, { project_id: projectId });
        setToast({ type: "success", message: "Project linked." });
        await selectContact(contactId);
      } catch (err) {
        const message = normalizeError(err);
        setError(message);
        setToast({ type: "error", message });
      } finally {
        setLoading(false);
      }
    },
    [selectContact],
  );

  const unlinkProject = useCallback(
    async (contactId: string, projectId: string) => {
      setLoading(true);
      setError(null);
      try {
        await unlinkProjectApi(contactId, projectId);
        setToast({ type: "success", message: "Verknuepfung entfernt." });
        await selectContact(contactId);
      } catch (err) {
        const message = normalizeError(err);
        setError(message);
        setToast({ type: "error", message });
      } finally {
        setLoading(false);
      }
    },
    [selectContact],
  );

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    contacts,
    allTags,
    loading,
    error,
    searchQuery,
    tagFilter,
    toast,
    selectedContact,
    detailLoading,
    setSearchQuery,
    setTagFilter,
    selectContact,
    createContact,
    updateContact,
    deleteContact,
    uploadAvatar,
    deleteAvatar,
    linkProject,
    unlinkProject,
    refetch,
    clearToast,
  };
}
