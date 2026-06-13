import { useState } from "react";
import Toast from "@/components/common/Toast";
import ContactDetail from "@/components/contacts/ContactDetail";
import ContactList from "@/components/contacts/ContactList";
import CreateContactDialog from "@/components/contacts/CreateContactDialog";
import { useContacts } from "@/hooks/useContacts";
import type { UpdateContactRequest } from "@/api/types";

function ContactsPage(): JSX.Element {
  const [createOpen, setCreateOpen] = useState(false);
  const {
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
    clearToast,
  } = useContacts();

  return (
    <section className="space-y-4">
      {toast ? (
        <div onAnimationEnd={clearToast}>
          <Toast message={toast.message} type={toast.type} timeoutMs={3200} />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <ContactList
          contacts={contacts}
          allTags={allTags}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          tagFilter={tagFilter}
          selectedId={selectedContact?.contact_id ?? null}
          creatingOpen={createOpen}
          onSearchChange={setSearchQuery}
          onTagFilter={setTagFilter}
          onSelect={(id) => void selectContact(id)}
          onOpenCreate={() => setCreateOpen(true)}
        />

        <ContactDetail
          contact={selectedContact}
          loading={detailLoading}
          busy={loading}
          onSave={async (contactId, data: UpdateContactRequest) => {
            await updateContact(contactId, data);
          }}
          onDelete={deleteContact}
          onUploadAvatar={uploadAvatar}
          onDeleteAvatar={deleteAvatar}
          onLinkProject={linkProject}
          onUnlinkProject={unlinkProject}
        />
      </div>

      <CreateContactDialog
        open={createOpen}
        creating={loading}
        onClose={() => setCreateOpen(false)}
        onCreate={createContact}
      />
    </section>
  );
}

export default ContactsPage;
