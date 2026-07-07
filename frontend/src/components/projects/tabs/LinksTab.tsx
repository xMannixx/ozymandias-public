import { FormEvent, useState } from "react";
import Button from "@/components/common/Button";
import type { ProjectDetailResponse } from "@/api/types";

type LinksTabProps = {
  project: ProjectDetailResponse;
  loading: boolean;
  onCreateLink: (data: { name: string; url: string }) => Promise<void>;
  onDeleteLink: (linkId: string) => Promise<void>;
};

function toFaviconUrl(link: string): string {
  try {
    const parsed = new URL(link);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
  } catch {
    return "";
  }
}

function LinksTab({ project, loading, onCreateLink, onDeleteLink }: LinksTabProps): JSX.Element {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!name.trim() || !url.trim()) {
      return;
    }
    await onCreateLink({ name: name.trim(), url: url.trim() });
    setName("");
    setUrl("");
  };

  return (
    <div className="space-y-3">
      {project.links.length === 0 ? (
        <p className="text-sm text-gray-400">Noch keine Links vorhanden.</p>
      ) : (
        <div className="space-y-2">
          {project.links.map((link) => (
            <article key={link.link_id} className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {toFaviconUrl(link.url) ? (
                      <img src={toFaviconUrl(link.url)} alt="" className="h-4 w-4 rounded-sm" />
                    ) : null}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-medium text-blue-200 hover:underline"
                    >
                      {link.name}
                    </a>
                  </div>
                  <p className="truncate text-xs text-gray-400">{link.url}</p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="h-8 px-2 py-0 text-xs"
                  onClick={() => void onDeleteLink(link.link_id)}
                  disabled={loading}
                >
                  Del
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <form className="grid gap-2 rounded-md border border-dashed border-gray-600 p-3 md:grid-cols-[1fr_2fr_auto]" onSubmit={(event) => void submit(event)}>
        <input
          aria-label="new-link-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
        <input
          aria-label="new-link-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://..."
          className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        />
        <Button type="submit" disabled={loading}>
          Add
        </Button>
      </form>
    </div>
  );
}

export default LinksTab;
