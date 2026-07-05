import { useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { ApiError } from "@/api/client";
import { extractAttachment } from "@/api/turns";
import type { TurnAttachment, VoiceMode } from "@/api/types";
import Button from "@/components/common/Button";
import VoiceButton from "@/components/chat/VoiceButton";
import type { VoiceState } from "@/hooks/useVoice";

const MAX_ATTACHMENTS = 5;
const ACCEPTED_EXTENSIONS = ".txt,.md,.csv,.pdf";

type PendingAttachment = TurnAttachment & {
  sensitivity: string;
  truncated: boolean;
};

type ChatInputProps = {
  onSend: (text: string, attachments?: TurnAttachment[]) => void | Promise<void>;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  voiceState: VoiceState;
  voiceMode: VoiceMode;
  isVoiceEnabled: boolean;
  voiceError: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleVoice: () => void;
};

function ChatInput({
  onSend,
  disabled = false,
  isStreaming = false,
  onStop,
  voiceState,
  voiceMode,
  isVoiceEnabled,
  voiceError,
  onStartRecording,
  onStopRecording,
  onToggleVoice,
}: ChatInputProps): JSX.Element {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = text.trim();
  const isBlocked = disabled || !trimmed || isExtracting;

  async function addFiles(files: FileList | File[]): Promise<void> {
    setAttachmentError(null);
    const incoming = Array.from(files);
    if (incoming.length === 0) {
      return;
    }
    if (attachments.length + incoming.length > MAX_ATTACHMENTS) {
      setAttachmentError(`Maximum ${MAX_ATTACHMENTS} attachments per message.`);
      return;
    }
    setIsExtracting(true);
    try {
      for (const file of incoming) {
        const extracted = await extractAttachment(file);
        setAttachments((prev) => [
          ...prev,
          {
            filename: extracted.filename,
            content: extracted.content,
            sensitivity: extracted.sensitivity,
            truncated: extracted.truncated,
          },
        ]);
      }
    } catch (error) {
      if (error instanceof ApiError && error.message.trim()) {
        setAttachmentError(error.message);
      } else {
        setAttachmentError("Could not read the file.");
      }
    } finally {
      setIsExtracting(false);
    }
  }

  function removeAttachment(index: number): void {
    setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function performSend(): Promise<void> {
    if (isBlocked) {
      return;
    }

    const outgoing = attachments.map(({ filename, content }) => ({ filename, content }));
    setText("");
    setAttachments([]);
    setAttachmentError(null);
    await onSend(trimmed, outgoing.length > 0 ? outgoing : undefined);
  }

  async function submitMessage(event: FormEvent): Promise<void> {
    event.preventDefault();
    await performSend();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void performSend();
    }
  }

  function onDrop(event: DragEvent<HTMLFormElement>): void {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files.length > 0) {
      void addFiles(event.dataTransfer.files);
    }
  }

  return (
    <form
      className={`glass-card mt-3 flex flex-col gap-2 p-3 ${
        isDragOver ? "outline outline-2 outline-blue-500/70" : ""
      }`}
      onSubmit={submitMessage}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={onDrop}
    >
      {attachments.length > 0 || attachmentError || isExtracting ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {attachments.map((attachment, index) => (
            <span
              key={`${attachment.filename}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-gray-600 bg-gray-800 px-2 py-1 text-gray-200"
            >
              <span aria-hidden>📄</span>
              <span className="max-w-[160px] truncate">{attachment.filename}</span>
              {attachment.truncated ? <span className="text-amber-400">(truncated)</span> : null}
              {attachment.sensitivity === "S3" || attachment.sensitivity === "S4" ? (
                <span className="rounded bg-red-900/60 px-1 text-red-200">
                  {attachment.sensitivity}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`Remove attachment ${attachment.filename}`}
                className="ml-1 text-gray-400 hover:text-gray-100"
                onClick={() => removeAttachment(index)}
              >
                ×
              </button>
            </span>
          ))}
          {isExtracting ? <span className="text-gray-400">Reading file...</span> : null}
          {attachmentError ? <span className="text-red-400">{attachmentError}</span> : null}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          className="hidden"
          aria-label="chat-attachment-input"
          onChange={(event) => {
            if (event.target.files) {
              void addFiles(event.target.files);
            }
            event.target.value = "";
          }}
        />
        <button
          type="button"
          aria-label="Attach file"
          title="Attach a text file (.txt, .md, .csv, .pdf)"
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          disabled={disabled || isExtracting}
          onClick={() => fileInputRef.current?.click()}
        >
          +
        </button>
        <input
          aria-label="chat-input"
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
          placeholder="Message Ozy... (drop a file to attach)"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <VoiceButton
          voiceState={voiceState}
          voiceMode={voiceMode}
          isVoiceEnabled={isVoiceEnabled}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          onToggleVoice={onToggleVoice}
          error={voiceError}
        />
        {isStreaming && onStop ? (
          <Button type="button" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={isBlocked}>
            Send
          </Button>
        )}
      </div>
    </form>
  );
}

export default ChatInput;
