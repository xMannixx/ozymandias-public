import { ChangeEvent, DragEvent, FormEvent, useMemo, useState } from "react";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import type { ExtractStatus, ProjectDetailResponse, ProjectFileResponse } from "@/api/types";

type KnowledgeTabProps = {
  project: ProjectDetailResponse;
  loading: boolean;
  onUploadFile: (file: File) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onDownloadFile: (fileId: string) => Promise<void>;
  onCreateLink: (data: { name: string; url: string }) => Promise<void>;
  onDeleteLink: (linkId: string) => Promise<void>;
};

const READABLE_HINT = "Readable formats: .txt, .md, .csv and .pdf up to 5 MB.";

function formatSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (sizeBytes >= 1024) {
    return `${Math.round(sizeBytes / 1024).toString()} KB`;
  }
  return `${sizeBytes.toString()} B`;
}

function describeExtraction(file: ProjectFileResponse): { label: string; className: string } {
  const status: ExtractStatus = file.extract_status;
  switch (status) {
    case "ok":
      return {
        label: `In context · ${file.text_chars.toLocaleString("en-GB")} characters`,
        className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
      };
    case "unsupported":
      return {
        label: "Stored only · text cannot be read",
        className: "border-white/[0.09] bg-white/[0.03] text-zinc-400",
      };
    case "failed":
      return {
        label: "Stored only · reading the text failed",
        className: "border-amber-400/25 bg-amber-400/10 text-amber-200",
      };
    case "pending":
      return {
        label: "Waiting to be read",
        className: "border-white/[0.09] bg-white/[0.03] text-zinc-400",
      };
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function toFaviconUrl(link: string): string {
  try {
    const parsed = new URL(link);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
  } catch {
    return "";
  }
}

/**
 * The workspace's knowledge: files whose text Ozy can quote, plus reference
 * links. Files whose text cannot be read are kept, but say so plainly.
 */
function KnowledgeTab({
  project,
  loading,
  onUploadFile,
  onDeleteFile,
  onDownloadFile,
  onCreateLink,
  onDeleteLink,
}: KnowledgeTabProps): JSX.Element {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const files = useMemo(
    () =>
      [...project.files].sort(
        (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
      ),
    [project.files],
  );
  const readableCount = files.filter((file) => file.extract_status === "ok").length;

  const handleUpload = async (file: File): Promise<void> => {
    setUploading(true);
    try {
      await onUploadFile(file);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleUpload(file);
    }
  };

  const onFileInput = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (file) {
      await handleUpload(file);
    }
  };

  const submitLink = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!linkName.trim() || !linkUrl.trim()) {
      return;
    }
    await onCreateLink({ name: linkName.trim(), url: linkUrl.trim() });
    setLinkName("");
    setLinkUrl("");
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-medium text-zinc-100">Files</h3>
          <p className="text-xs text-zinc-500">
            {readableCount > 0
              ? `${readableCount.toString()} of ${files.length.toString()} files can be quoted in this workspace's chats.`
              : `Upload a document and Ozy will use it in every chat here. ${READABLE_HINT}`}
          </p>
        </header>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => void onDrop(event)}
          className={`rounded-lg border border-dashed p-4 text-center text-sm ${
            dragActive
              ? "border-indigo-400/60 bg-indigo-400/10 text-indigo-100"
              : "border-white/[0.12] text-zinc-400"
          }`}
        >
          <p>Drop a file here</p>
          <label className="mt-2 inline-block cursor-pointer rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400">
            Choose file
            <input
              type="file"
              className="hidden"
              aria-label="knowledge-file-input"
              onChange={(event) => void onFileInput(event)}
            />
          </label>
          <p className="mt-2 text-xs text-zinc-500">{READABLE_HINT}</p>
          {uploading ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-indigo-200">
              <Spinner />
              Uploading and reading the text…
            </div>
          ) : null}
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-zinc-500">No files yet.</p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => {
              const extraction = describeExtraction(file);
              return (
                <li
                  key={file.file_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-100" title={file.original_name}>
                      {file.original_name}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span
                        className={`rounded-full border px-2 py-0.5 ${extraction.className}`}
                      >
                        {extraction.label}
                      </span>
                      <span>{formatSize(file.size_bytes)}</span>
                      <span>{new Date(file.created_at).toLocaleDateString("en-GB")}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 py-0 text-xs"
                      onClick={() => void onDownloadFile(file.file_id)}
                      disabled={loading || uploading}
                    >
                      Download
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 py-0 text-xs text-red-200 hover:text-red-100"
                      onClick={() => void onDeleteFile(file.file_id)}
                      disabled={loading || uploading}
                      aria-label={`Remove ${file.original_name}`}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-medium text-zinc-100">Reference links</h3>
          <p className="text-xs text-zinc-500">
            Ozy sees the names and addresses, but does not open the pages by itself.
          </p>
        </header>

        {project.links.length === 0 ? (
          <p className="text-sm text-zinc-500">No links yet.</p>
        ) : (
          <ul className="space-y-2">
            {project.links.map((link) => (
              <li
                key={link.link_id}
                className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
              >
                {toFaviconUrl(link.url) ? (
                  <img src={toFaviconUrl(link.url)} alt="" className="h-4 w-4 rounded-sm" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm text-indigo-200 hover:underline"
                  >
                    {link.name}
                  </a>
                  <p className="truncate text-xs text-zinc-500">{link.url}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 py-0 text-xs text-red-200 hover:text-red-100"
                  onClick={() => void onDeleteLink(link.link_id)}
                  disabled={loading}
                  aria-label={`Remove ${link.name}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid gap-2 rounded-lg border border-dashed border-white/[0.12] p-3 md:grid-cols-[1fr_2fr_auto]"
          onSubmit={(event) => void submitLink(event)}
        >
          <input
            aria-label="new-link-name"
            value={linkName}
            onChange={(event) => setLinkName(event.target.value)}
            placeholder="Name"
          />
          <input
            aria-label="new-link-url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://..."
          />
          <Button type="submit" disabled={loading}>
            Add link
          </Button>
        </form>
      </section>
    </div>
  );
}

export default KnowledgeTab;
