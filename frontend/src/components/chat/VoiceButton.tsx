import Button from "@/components/common/Button";
import Spinner from "@/components/common/Spinner";
import type { VoiceMode } from "@/api/types";
import type { VoiceState } from "@/hooks/useVoice";

type VoiceButtonProps = {
  voiceState: VoiceState;
  voiceMode: VoiceMode;
  isVoiceEnabled: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleVoice: () => void;
  error: string | null;
};

function VoiceButton({
  voiceState,
  voiceMode,
  isVoiceEnabled,
  onStartRecording,
  onStopRecording,
  onToggleVoice,
  error,
}: VoiceButtonProps): JSX.Element {
  const isRecording = voiceState === "recording";
  const isProcessing = voiceState === "processing";
  const isPlaying = voiceState === "playing";
  const pushToTalk = voiceMode === "push_to_talk";
  const buttonLabel = !isVoiceEnabled
    ? "Voice aus"
    : isProcessing
      ? "Verarbeitung"
      : isPlaying
        ? "Wiedergabe"
        : isRecording
          ? "Aufnahme..."
          : pushToTalk
            ? "Push-to-Talk"
            : "Freisprechen";

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={isRecording ? "danger" : "ghost"}
        disabled={isProcessing || isPlaying}
        aria-label="voice-button"
        onClick={() => {
          if (!isVoiceEnabled) {
            onToggleVoice();
            return;
          }
          if (!pushToTalk) {
            onToggleVoice();
            return;
          }
          // Push-to-talk is handled by mouse/touch hold events.
        }}
        onMouseDown={() => {
          if (!isVoiceEnabled || !pushToTalk || isRecording || isProcessing || isPlaying) {
            return;
          }
          onStartRecording();
        }}
        onMouseUp={() => {
          if (!isVoiceEnabled || !pushToTalk) {
            return;
          }
          onStopRecording();
        }}
        onTouchStart={() => {
          if (!isVoiceEnabled || !pushToTalk || isRecording || isProcessing || isPlaying) {
            return;
          }
          onStartRecording();
        }}
        onTouchEnd={() => {
          if (!isVoiceEnabled || !pushToTalk) {
            return;
          }
          onStopRecording();
        }}
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <Spinner />
            {buttonLabel}
          </span>
        ) : (
          buttonLabel
        )}
      </Button>
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </div>
  );
}

export default VoiceButton;
