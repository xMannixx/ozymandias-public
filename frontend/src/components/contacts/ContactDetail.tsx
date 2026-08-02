import { FormEvent, useEffect, useState } from "react";
import { listProjects } from "@/api/projects";
import type {
  ContactDetailResponse,
  EmailEntry,
  PhoneEntry,
  ProjectResponse,
  Sensitivity,
  UpdateContactRequest,
} from "@/api/types";
import AvatarDisplay from "@/components/contacts/AvatarDisplay";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";

type ContactDetailProps = {
  contact: ContactDetailResponse | null;
  loading: boolean;
  busy: boolean;
  onSave: (contactId: string, data: UpdateContactRequest) => Promise<void>;
  onDelete: (contactId: string) => Promise<void>;
  onUploadAvatar: (contactId: string, file: File) => Promise<void>;
  onDeleteAvatar: (contactId: string) => Promise<void>;
  onLinkProject: (contactId: string, projectId: string) => Promise<void>;
  onUnlinkProject: (contactId: string, projectId: string) => Promise<void>;
};

function displayName(contact: ContactDetailResponse): string {
  const parts = [contact.first_name, contact.last_name ?? ""].filter(Boolean);
  return parts.join(" ").trim() || contact.first_name;
}

/** S3 and S4 keep this person out of every cloud request, so say so plainly. */
const sensitivityOptions: Array<{ value: Sensitivity; label: string }> = [
  { value: "S0", label: "S0 — public, nothing to protect" },
  { value: "S1", label: "S1 — normal, may use cloud models" },
  { value: "S2", label: "S2 — personal, may use cloud models" },
  { value: "S3", label: "S3 — private contact, local models only" },
  { value: "S4", label: "S4 — secret, local models only" },
];

function ContactDetail({
  contact,
  loading,
  busy,
  onSave,
  onDelete,
  onUploadAvatar,
  onDeleteAvatar,
  onLinkProject,
  onUnlinkProject,
}: ContactDetailProps): JSX.Element {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [address, setAddress] = useState("");
  const [birthday, setBirthday] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("S2");
  const [phones, setPhones] = useState<PhoneEntry[]>([]);
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [linkProjectId, setLinkProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!contact) {
      return;
    }
    setFirstName(contact.first_name);
    setLastName(contact.last_name ?? "");
    setCompany(contact.company ?? "");
    setRole(contact.role ?? "");
    setAddress(contact.address ?? "");
    setBirthday(contact.birthday ?? "");
    setNotes(contact.notes ?? "");
    setTagsRaw(contact.tags.join(", "));
    setSensitivity(contact.sensitivity);
    setPhones(contact.phones.length > 0 ? contact.phones : [{ label: "", number: "" }]);
    setEmails(contact.emails.length > 0 ? contact.emails : [{ label: "", email: "" }]);
    setError(null);
    setLinkProjectId("");
  }, [contact]);

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center p-6" data-testid="contact-detail-loading">
        <Spinner />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="glass-card p-4 text-sm text-gray-400" data-testid="contact-detail-empty">
        Select a contact.
      </div>
    );
  }

  const name = displayName(contact);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    const phonePayload = phones
      .map((p) => ({ label: p.label.trim(), number: p.number.trim() }))
      .filter((p) => p.label && p.number);
    const emailPayload = emails
      .map((e) => ({ label: e.label.trim(), email: e.email.trim() }))
      .filter((e) => e.label && e.email);
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload: UpdateContactRequest = {
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      company: company.trim() || null,
      role: role.trim() || null,
      address: address.trim() || null,
      birthday: birthday.trim() || null,
      notes: notes.trim() || null,
      tags,
      phones: phonePayload,
      emails: emailPayload,
      sensitivity,
    };
    await onSave(contact.contact_id, payload);
  };

  const staysLocal = sensitivity === "S3" || sensitivity === "S4";

  const linkedIds = new Set(contact.linked_projects.map((p) => p.project_id));
  const linkableProjects = projects.filter((p) => !linkedIds.has(p.project_id));

  return (
    <div className="glass-card space-y-4 p-4" data-testid="contact-detail">
      <div className="flex flex-col items-center gap-3 border-b border-gray-700 pb-4">
        <AvatarDisplay contactId={contact.contact_id} hasAvatar={contact.has_avatar} label={name} className="h-24 w-24" />
        <div className="flex flex-wrap justify-center gap-2">
          <label className="cursor-pointer rounded-md bg-gray-800 px-3 py-1 text-xs text-gray-200">
            Upload avatar
            <input
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="contact-avatar-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  void onUploadAvatar(contact.contact_id, file);
                }
              }}
            />
          </label>
          {contact.has_avatar ? (
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              disabled={busy}
              onClick={() => void onDeleteAvatar(contact.contact_id)}
            >
              Remove avatar
            </Button>
          ) : null}
        </div>
      </div>

      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="cd-first">
            First name
          </label>
          <input
            id="cd-first"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="cd-last">
            Last name
          </label>
          <input
            id="cd-last"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="cd-company">
            Company
          </label>
          <input
            id="cd-company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="cd-role">
            Role
          </label>
          <input
            id="cd-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="cd-address">
            Address
          </label>
          <textarea
            id="cd-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            rows={2}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="cd-birthday">
            Birthday
          </label>
          <input
            id="cd-birthday"
            type="date"
            value={birthday}
            onChange={(event) => setBirthday(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="cd-notes">
            Notes
          </label>
          <textarea
            id="cd-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="cd-tags">
            Tags (comma-separated)
          </label>
          <input
            id="cd-tags"
            value={tagsRaw}
            onChange={(event) => setTagsRaw(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400" htmlFor="cd-sensitivity">
            Privacy level
          </label>
          <select
            id="cd-sensitivity"
            value={sensitivity}
            onChange={(event) => setSensitivity(event.target.value as Sensitivity)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
          >
            {sensitivityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {staysLocal
              ? "Ozy only uses this contact when answering on a local model. Nothing about this person goes to a cloud provider."
              : "When you mention this person in a chat, Ozy sees the full entry — phone, email, address, notes."}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400">Phone</p>
          {phones.map((row, index) => (
            <div key={`phone-${String(index)}`} className="flex gap-2">
              <input
                aria-label={`Phone label ${String(index + 1)}`}
                placeholder="Label"
                value={row.label}
                onChange={(event) => {
                  const next = [...phones];
                  next[index] = { ...next[index], label: event.target.value };
                  setPhones(next);
                }}
                className="w-1/3 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100"
              />
              <input
                aria-label={`Phone number ${String(index + 1)}`}
                placeholder="Number"
                value={row.number}
                onChange={(event) => {
                  const next = [...phones];
                  next[index] = { ...next[index], number: event.target.value };
                  setPhones(next);
                }}
                className="flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            onClick={() => setPhones([...phones, { label: "", number: "" }])}
          >
            + Number
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400">Email</p>
          {emails.map((row, index) => (
            <div key={`email-${String(index)}`} className="flex gap-2">
              <input
                aria-label={`Email label ${String(index + 1)}`}
                placeholder="Label"
                value={row.label}
                onChange={(event) => {
                  const next = [...emails];
                  next[index] = { ...next[index], label: event.target.value };
                  setEmails(next);
                }}
                className="w-1/3 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100"
              />
              <input
                aria-label={`Email address ${String(index + 1)}`}
                placeholder="email@..."
                value={row.email}
                onChange={(event) => {
                  const next = [...emails];
                  next[index] = { ...next[index], email: event.target.value };
                  setEmails(next);
                }}
                className="flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            onClick={() => setEmails([...emails, { label: "", email: "" }])}
          >
            + Email
          </Button>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={busy}>
            Save
          </Button>
          <Button type="button" variant="danger" disabled={busy} onClick={() => void onDelete(contact.contact_id)}>
            Delete
          </Button>
        </div>
      </form>

      <div className="border-t border-gray-700 pt-4">
        <h4 className="mb-2 text-sm font-semibold text-blue-200">Linked projects</h4>
        <ul className="space-y-2" data-testid="linked-projects">
          {contact.linked_projects.map((p) => (
            <li key={p.project_id} className="flex items-center justify-between gap-2 text-sm text-gray-200">
              <span className="truncate">
                {p.name}{" "}
                <span className="text-xs text-gray-500">({p.status})</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 text-xs"
                disabled={busy}
                onClick={() => void onUnlinkProject(contact.contact_id, p.project_id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        {linkableProjects.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              aria-label="Link project"
              value={linkProjectId}
              onChange={(event) => setLinkProjectId(event.target.value)}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100"
            >
              <option value="">Choose project...</option>
              {linkableProjects.map((p) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="primary"
              className="text-xs"
              disabled={busy || !linkProjectId}
              onClick={() => {
                if (linkProjectId) {
                  void onLinkProject(contact.contact_id, linkProjectId);
                }
              }}
            >
              Link
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ContactDetail;
