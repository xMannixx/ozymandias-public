import type { ContactResponse } from "@/api/types";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import ContactCard from "@/components/contacts/ContactCard";

type ContactListProps = {
  contacts: ContactResponse[];
  allTags: string[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  tagFilter: string | null;
  selectedId: string | null;
  creatingOpen: boolean;
  onSearchChange: (value: string) => void;
  onTagFilter: (tag: string | null) => void;
  onSelect: (contactId: string) => void;
  onOpenCreate: () => void;
};

function ContactList({
  contacts,
  allTags,
  loading,
  error,
  searchQuery,
  tagFilter,
  selectedId,
  creatingOpen,
  onSearchChange,
  onTagFilter,
  onSelect,
  onOpenCreate,
}: ContactListProps): JSX.Element {
  return (
    <div className="space-y-3" data-testid="contact-list">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="contacts-search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search name, company..."
          className="min-w-[12rem] flex-1 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
        <Button type="button" variant="primary" onClick={onOpenCreate} disabled={creatingOpen}>
          New contact
        </Button>
      </div>

      {allTags.length > 0 ? (
        <div className="flex flex-wrap gap-2" data-testid="contact-tag-filters">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs ${!tagFilter ? "bg-blue-700/60 text-white" : "bg-gray-800 text-gray-300"}`}
            onClick={() => onTagFilter(null)}
          >
            Alle Tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`rounded-full px-3 py-1 text-xs ${
                tagFilter === tag ? "bg-blue-700/60 text-white" : "bg-gray-800 text-gray-300"
              }`}
              onClick={() => onTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <div className="glass-card flex justify-center p-6">
          <Spinner />
        </div>
      ) : null}

      {!loading && contacts.length === 0 ? (
        <p className="glass-card p-4 text-sm text-gray-400">No contacts found.</p>
      ) : (
        <div className="grid auto-rows-min gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.contact_id}
              contact={contact}
              isSelected={selectedId === contact.contact_id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ContactList;
