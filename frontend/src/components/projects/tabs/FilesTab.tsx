import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import type { ProjectDetailResponse, ProjectFileResponse } from "@/api/types";

type FilesTabProps = {
  project: ProjectDetailResponse;
  loading: boolean;
  onUploadFile: (file: File) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onDownloadFile: (fileId: string) => Promise<void>;
};

function formatSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (sizeBytes >= 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }
  return `${sizeBytes} B`;
}

function fileIcon(contentType: string): string {
  if (contentType.startsWith("image/")) {
    return "IMG";
  }
  if (contentType === "application/pdf") {
    return "PDF";
  }
  if (contentType.includes("word") || contentType.includes("officedocument") || contentType.includes("text/")) {
    return "DOC";
  }
  return "FILE";
}

function sortFiles(items: ProjectFileResponse[]): ProjectFileResponse[] {
  return [...items].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
}

function FilesTab({
  project,
  loading,
  onUploadFile,
  onDeleteFile,
  onDownloadFile,
}: FilesTabProps): JSX.Element {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const files = useMemo(() => sortFiles(project.files), [project.files]);

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
    if (!file) {
      return;
    }
    await handleUpload(file);
  };

  const onFileInput = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }
    await handleUpload(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => void onDrop(event)}
        className={`rounded-md border-2 border-dashed p-4 text-center text-sm ${
          dragActive ? "border-blue-500 bg-blue-950/30 text-blue-100" : "border-gray-600 text-gray-300"
        }`}
      >
        <p>Datei hierher ziehen oder auswaehlen</p>
        <label className="mt-2 inline-block cursor-pointer rounded bg-blue-700 px-3 py-1.5 text-xs text-white">
          Datei waehlen
          <input type="file" className="hidden" onChange={(event) => void onFileInput(event)} />
        </label>
        {uploading ? (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-blue-200">
            <Spinner />
            Upload laeuft...
          </div>
        ) : null}
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Dateien vorhanden.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {files.map((file) => (
            <article key={file.file_id} className="rounded-md border border-gray-700 bg-gray-900/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-blue-900/40 px-2 py-1 text-xs font-semibold text-blue-100">
                  {fileIcon(file.content_type)}
                </span>
                <span className="text-xs text-gray-500">{formatSize(file.size_bytes)}</span>
              </div>
              <p className="truncate text-sm text-gray-100" title={file.original_name}>
                {file.original_name}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {new Date(file.created_at).toLocaleString("de-DE")}
              </p>
              <div className="mt-3 flex items-center gap-2">
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
                  variant="danger"
                  className="h-8 px-2 py-0 text-xs"
                  onClick={() => void onDeleteFile(file.file_id)}
                  disabled={loading || uploading}
                >
                  Del
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default FilesTab;
