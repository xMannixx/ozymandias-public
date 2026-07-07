import { FormEvent, useMemo, useState } from "react";
import Button from "@/components/common/Button";
import type { NoteSource, ProjectDetailResponse } from "@/api/types";

type NotesTabProps = {
  project: ProjectDetailResponse;
  loading: boolean;
  onCreateNote: (data: { content: string; source?: NoteSource }) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
};

const sourceOptions: NoteSource[] = ["user", "chat", "system"];

function NotesTab({ project, loading, onCreateNote, onDeleteNote }: NotesTabProps): JSX.Element {
  const [content, setContent] = useState("");
  const [source, setSource] = useState<NoteSource>("user");

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
    await onCreateNote({
      content: content.trim(),
      source,
    });
    setContent("");
    setSource("user");
  };

  return (
    <div className="space-y-3">
      {sortedNotes.length === 0 ? (
        <p className="text-sm text-gray-400">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {sortedNotes.map((note) => (
            <article key={note.note_id} className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-900/50 px-2 py-0.5 text-xs text-blue-100">
                    {note.source}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(note.created_at).toLocaleString("en-GB")}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="h-8 px-2 py-0 text-xs"
                  onClick={() => void onDeleteNote(note.note_id)}
                  disabled={loading}
                >
                  Del
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-200">{note.content}</p>
            </article>
          ))}
        </div>
      )}

      <form className="space-y-2 rounded-md border border-dashed border-gray-600 p-3" onSubmit={(event) => void submit(event)}>
        <textarea
          aria-label="new-note-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="New note..."
          className="h-24 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
        <div className="flex items-center justify-between gap-2">
          <select
            aria-label="new-note-source"
            value={source}
            onChange={(event) => setSource(event.target.value as NoteSource)}
            className="rounded border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100"
          >
            {sourceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={loading}>
            Save note
          </Button>
        </div>
      </form>
    </div>
  );
}

export default NotesTab;
