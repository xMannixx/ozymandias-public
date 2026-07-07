import { FormEvent, useState } from "react";
import type { CreateContactRequest } from "@/api/types";
import Button from "@/components/common/Button";
import Modal from "@/components/common/Modal";

type CreateContactDialogProps = {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (payload: CreateContactRequest) => Promise<void>;
};

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function CreateContactDialog({ open, creating, onClose, onCreate }: CreateContactDialogProps): JSX.Element {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    await onCreate({
      first_name: firstName.trim(),
      last_name: lastName.trim() || undefined,
      company: company.trim() || undefined,
      tags: parseTags(tagsRaw),
    });
    setFirstName("");
    setLastName("");
    setCompany("");
    setTagsRaw("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New contact">
      <form className="space-y-3" onSubmit={(event) => void submit(event)} data-testid="create-contact-form">
        <div>
          <label className="mb-1 block text-sm text-gray-300" htmlFor="create-contact-first">
            First name
          </label>
          <input
            id="create-contact-first"
            aria-label="First name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-300" htmlFor="create-contact-last">
            Last name
          </label>
          <input
            id="create-contact-last"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-300" htmlFor="create-contact-company">
            Company
          </label>
          <input
            id="create-contact-company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-300" htmlFor="create-contact-tags">
            Tags (kommagetrennt)
          </label>
          <input
            id="create-contact-tags"
            aria-label="Tags"
            value={tagsRaw}
            onChange={(event) => setTagsRaw(event.target.value)}
            placeholder="Arbeit, VIP"
            className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          />
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateContactDialog;
