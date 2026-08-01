import { FormEvent, useMemo, useState } from "react";
import Button from "@/components/common/Button";
import type { NoteSource, ProjectDetailResponse } from "@/api/types";

type NotesTabProps = {
  project: ProjectDetailResponse;
  loading: boolean;
  onCreateNote: (data: { content: string; source?: NoteSource }) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
};

const SOURCE_LABELS: Record<NoteSource, string> = {
  user: "Written by you",
  chat: "From a chat",
  system: "Added automatically",
};

function NotesTab({ project, loading, onCreateNote, onDeleteNote }: NotesTabProps): JSX.Element {
  const [content, setContent] = useState("");

  const sortedNotes = useMemo(
    () =>
      [...project.notes].sort(
        (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
      ),
    [project.notes],
  );

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }
    await onCreateNote({ content: content.trim(), source: "user" });
    setContent("");
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Notes are facts and decisions Ozy should remember in this workspace.
      </p>

      <form className="space-y-2" onSubmit={(event) => void submit(event)}>
        <textarea
          aria-label="new-note-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Something Ozy should remember here…"
          className="h-24 w-full"
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            Add note
          </Button>
        </div>
      </form>

      {sortedNotes.length === 0 ? (
        <p className="text-sm text-zinc-500">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {sortedNotes.map((note) => (
            <li
              key={note.note_id}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-500">
                  {SOURCE_LABELS[note.source]} · {new Date(note.created_at).toLocaleDateString("en-GB")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 py-0 text-xs text-red-200 hover:text-red-100"
                  onClick={() => void onDeleteNote(note.note_id)}
                  disabled={loading}
                  aria-label="Delete note"
                >
                  Delete
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-zinc-200">{note.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default NotesTab;
