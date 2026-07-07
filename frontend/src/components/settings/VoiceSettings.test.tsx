import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VoiceSettings from "@/components/settings/VoiceSettings";

const getVoicesMock = vi.fn();
const synthesizeSpeechMock = vi.fn();

vi.mock("@/api/voice", () => ({
  getVoices: (...args: unknown[]) => getVoicesMock(...args),
  synthesizeSpeech: (...args: unknown[]) => synthesizeSpeechMock(...args),
}));

describe("VoiceSettings", () => {
  beforeEach(() => {
    getVoicesMock.mockReset();
    synthesizeSpeechMock.mockReset();
    getVoicesMock.mockResolvedValue(["ash", "nova"]);
    synthesizeSpeechMock.mockResolvedValue(new Blob(["mp3"], { type: "audio/mpeg" }));
  });

  it("renders voice section and loads voices", async () => {
    render(
      <VoiceSettings
        voiceEnabled={false}
        voiceMode="push_to_talk"
        ttsVoice="ash"
        ttsModel="tts-1"
        ttsAutoplay
        saving={false}
        onSave={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText("Speech / Voice")).toBeInTheDocument();
    await waitFor(() => {
      expect(getVoicesMock).toHaveBeenCalled();
    });
  });

  it("saves voice settings payload", async () => {
    const onSave = vi.fn(async () => undefined);
    render(
      <VoiceSettings
        voiceEnabled={false}
        voiceMode="push_to_talk"
        ttsVoice="ash"
        ttsModel="tts-1"
        ttsAutoplay
        saving={false}
        onSave={onSave}
      />,
    );

    await userEvent.click(screen.getByLabelText("settings-voice-enabled"));
    await userEvent.click(screen.getByRole("radio", { name: "Hands-free" }));
    await userEvent.selectOptions(screen.getByLabelText("settings-voice-select"), "nova");
    await userEvent.click(screen.getByRole("radio", { name: "tts-1-hd" }));
    await userEvent.click(screen.getByLabelText("settings-voice-autoplay"));
    await userEvent.click(screen.getByRole("button", { name: "Save voice" }));

    expect(onSave).toHaveBeenCalledWith(true, "hands_free", "nova", "tts-1-hd", false);
  });

  it("plays test voice", async () => {
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      writable: true,
      value: class {
        constructor(_: string) {}
        pause(): void {}
        currentTime = 0;
        async play(): Promise<void> {}
      },
    });

    render(
      <VoiceSettings
        voiceEnabled
        voiceMode="push_to_talk"
        ttsVoice="ash"
        ttsModel="tts-1"
        ttsAutoplay
        saving={false}
        onSave={vi.fn(async () => undefined)}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Test voice" }));
    await waitFor(() => {
      expect(synthesizeSpeechMock).toHaveBeenCalled();
    });
  });
});
