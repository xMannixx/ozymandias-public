import { FormEvent, useState } from "react";
import Button from "@/components/common/Button";
import Modal from "@/components/common/Modal";
import type { CreateProjectRequest, Sensitivity } from "@/api/types";

type CreateProjectDialogProps = {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (payload: CreateProjectRequest) => Promise<void>;
};

const sensitivityOptions: Array<{ value: Sensitivity; label: string }> = [
  { value: "S1", label: "Normal — may use cloud models" },
  { value: "S2", label: "Personal — may use cloud models" },
  { value: "S3", label: "Sensitive — stays on local models" },
  { value: "S4", label: "Secret — stays on local models" },
];

/** Asks only for what a workspace needs to be useful right away. */
function CreateProjectDialog({
  open,
  creating,
  onClose,
  onCreate,
}: CreateProjectDialogProps): JSX.Element | null {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("S1");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please give the workspace a name.");
      return;
    }
    await onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      instructions: instructions.trim() || undefined,
      sensitivity,
      target_date: targetDate || undefined,
    });
    setName("");
    setDescription("");
    setInstructions("");
    setSensitivity("S1");
    setTargetDate("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New workspace">
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div>
          <label className="mb-1 block text-sm text-zinc-300" htmlFor="create-project-name">
            Name
          </label>
          <input
            id="create-project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tax return 2026"
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-300" htmlFor="create-project-description">
            What is this about?
          </label>
          <textarea
            id="create-project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="h-20 w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-300" htmlFor="create-project-instructions">
            Instructions (optional)
          </label>
          <textarea
            id="create-project-instructions"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="How should Ozy behave in this workspace?"
            className="h-20 w-full"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Ozy follows these in every chat inside this workspace. You can change them later.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              className="mb-1 block text-sm text-zinc-300"
              htmlFor="create-project-sensitivity"
            >
              Privacy level
            </label>
            <select
              id="create-project-sensitivity"
              value={sensitivity}
              onChange={(event) => setSensitivity(event.target.value as Sensitivity)}
              className="w-full"
            >
              {sensitivityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-300" htmlFor="create-project-target">
              Target date (optional)
            </label>
            <input
              id="create-project-target"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating}>
            Create workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateProjectDialog;
