import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { VoiceMode } from "@/api/types";
import Button from "@/components/common/Button";
import VoiceButton from "@/components/chat/VoiceButton";
import type { VoiceState } from "@/hooks/useVoice";

type ChatInputProps = {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
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
  voiceState,
  voiceMode,
  isVoiceEnabled,
  voiceError,
  onStartRecording,
  onStopRecording,
  onToggleVoice,
}: ChatInputProps): JSX.Element {
  const [text, setText] = useState("");

  const trimmed = text.trim();
  const isBlocked = disabled || !trimmed;

  async function performSend(): Promise<void> {
    if (isBlocked) {
      return;
    }

    await onSend(trimmed);
    setText("");
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

  return (
    <form className="glass-card mt-3 flex items-center gap-2 p-3" onSubmit={submitMessage}>
      <input
        aria-label="chat-input"
        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
        placeholder="Nachricht an Ozy..."
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
      <Button type="submit" disabled={isBlocked}>
        Send
      </Button>
    </form>
  );
}

export default ChatInput;
