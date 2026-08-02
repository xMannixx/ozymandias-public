import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VoiceButton from "@/components/chat/VoiceButton";
import type { VoiceState } from "@/hooks/useVoice";

function renderVoiceButton(state: VoiceState, options?: { enabled?: boolean; mode?: "push_to_talk" | "hands_free"; error?: string | null }) {
  const onStartRecording = vi.fn();
  const onStopRecording = vi.fn();
  const onToggleVoice = vi.fn();
  render(
    <VoiceButton
      voiceState={state}
      voiceMode={options?.mode ?? "push_to_talk"}
      isVoiceEnabled={options?.enabled ?? true}
      onStartRecording={onStartRecording}
      onStopRecording={onStopRecording}
      onToggleVoice={onToggleVoice}
      error={options?.error ?? null}
    />,
  );
  return { onStartRecording, onStopRecording, onToggleVoice };
}

describe("VoiceButton", () => {
  it("starts recording on press in push-to-talk mode", async () => {
    const { onStartRecording } = renderVoiceButton("idle");
    await userEvent.pointer([{ target: screen.getByLabelText("voice-button"), keys: "[MouseLeft>]" }]);
    expect(onStartRecording).toHaveBeenCalled();
  });

  it("stops recording on release in push-to-talk mode", async () => {
    const { onStopRecording } = renderVoiceButton("recording");
    fireEvent.mouseUp(screen.getByLabelText("voice-button"));
    expect(onStopRecording).toHaveBeenCalled();
  });

  it("delegates stop on mouseup even when props still show idle (avoids stale isRecording closure)", () => {
    const { onStartRecording, onStopRecording } = renderVoiceButton("idle");
    fireEvent.mouseDown(screen.getByLabelText("voice-button"));
    expect(onStartRecording).toHaveBeenCalled();
    // Parent may not have re-rendered yet; release must still call stop (hook no-ops if inactive).
    fireEvent.mouseUp(screen.getByLabelText("voice-button"));
    expect(onStopRecording).toHaveBeenCalled();
  });

  it("delegates stop on touchend even when props still show idle", () => {
    const { onStartRecording, onStopRecording } = renderVoiceButton("idle");
    fireEvent.touchStart(screen.getByLabelText("voice-button"));
    expect(onStartRecording).toHaveBeenCalled();
    fireEvent.touchEnd(screen.getByLabelText("voice-button"));
    expect(onStopRecording).toHaveBeenCalled();
  });

  it("shows processing state with spinner text", () => {
    renderVoiceButton("processing");
    expect(screen.getByText("Processing")).toBeInTheDocument();
  });

  it("renders error message when present", () => {
    renderVoiceButton("idle", { error: "Transkription fehlgeschlagen" });
    expect(screen.getByText("Transkription fehlgeschlagen")).toBeInTheDocument();
  });

  it("toggles voice when currently disabled", async () => {
    const { onToggleVoice } = renderVoiceButton("idle", { enabled: false });
    await userEvent.click(screen.getByLabelText("voice-button"));
    expect(onToggleVoice).toHaveBeenCalled();
  });
});
