import type { ContactResponse } from "@/api/types";
import AvatarDisplay from "@/components/contacts/AvatarDisplay";

type ContactCardProps = {
  contact: ContactResponse;
  isSelected: boolean;
  onSelect: (contactId: string) => void;
};

function displayName(contact: ContactResponse): string {
  const parts = [contact.first_name, contact.last_name ?? ""].filter(Boolean);
  return parts.join(" ").trim() || contact.first_name;
}

function ContactCard({ contact, isSelected, onSelect }: ContactCardProps): JSX.Element {
  const name = displayName(contact);
  const staysLocal = contact.sensitivity === "S3" || contact.sensitivity === "S4";

  return (
    <button
      type="button"
      data-testid={`contact-card-${contact.contact_id}`}
      onClick={() => onSelect(contact.contact_id)}
      className={`glass-card flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition ${
        isSelected ? "border-blue-400/80 ring-1 ring-blue-500/50" : "border-gray-700 hover:border-blue-500/40"
      }`}
    >
      <div className="flex items-center gap-3">
        <AvatarDisplay
          contactId={contact.contact_id}
          hasAvatar={contact.has_avatar}
          label={name}
          className="h-12 w-12 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-blue-100">{name}</p>
            {staysLocal ? (
              <span
                title="Ozy only uses this contact on a local model"
                className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200"
              >
                Local only
              </span>
            ) : null}
          </div>
          {contact.company ? <p className="truncate text-sm text-gray-400">{contact.company}</p> : null}
        </div>
      </div>
      {contact.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {contact.tags.map((tag) => (
            <span key={tag} className="rounded bg-gray-800/80 px-2 py-0.5 text-xs text-gray-300">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

export default ContactCard;
