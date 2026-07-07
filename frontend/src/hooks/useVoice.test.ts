import { act, renderHook, waitFor } from "@testing-library/react";
import { useVoice } from "@/hooks/useVoice";
import * as voiceApi from "@/api/voice";

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  stream: MediaStream;
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"]), type: "dataavailable" } as BlobEvent);
    this.onstop?.();
  }
}

describe("useVoice", () => {
  const getUserMediaMock = vi.fn();

  beforeEach(() => {
    vi.spyOn(voiceApi, "transcribeAudio").mockResolvedValue("Hallo Welt");
    vi.spyOn(voiceApi, "synthesizeSpeech").mockResolvedValue(new Blob(["mp3"], { type: "audio/mpeg" }));
    const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
    getUserMediaMock.mockResolvedValue({
      getTracks: () => [track],
    } as unknown as MediaStream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      writable: true,
      value: FakeMediaRecorder,
    });
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      writable: true,
      value: class {
        onended: (() => void) | null = null;
        pause = vi.fn();
        currentTime = 0;
        constructor(_: string) {}
        async play(): Promise<void> {
          this.onended?.();
        }
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("initializes with idle state", () => {
    const { result } = renderHook(() => useVoice({ onTranscript: vi.fn() }));
    expect(result.current.voiceState).toBe("idle");
    expect(result.current.voiceMode).toBe("push_to_talk");
  });

  it("toggles voice and requests microphone permission", async () => {
    const { result } = renderHook(() => useVoice({ onTranscript: vi.fn() }));
    await act(async () => {
      await result.current.toggleVoice();
    });
    expect(getUserMediaMock).toHaveBeenCalled();
    expect(result.current.isVoiceEnabled).toBe(true);
  });

  it("plays response even when voice toggle is disabled", async () => {
    localStorage.setItem("ozy-voice-enabled", "0");
    const { result } = renderHook(() => useVoice({ onTranscript: vi.fn() }));

    await act(async () => {
      await result.current.playResponse("**Antwort** von `Ozy`");
    });

    await waitFor(() => {
      expect(voiceApi.synthesizeSpeech).toHaveBeenCalledWith("Antwort von Ozy", "ash", "tts-1");
    });
  });

  it("retries blocked playback after next user interaction", async () => {
    const playMock = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("blocked"), { name: "NotAllowedError" }))
      .mockResolvedValueOnce(undefined);
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      writable: true,
      value: class {
        onended: (() => void) | null = null;
        pause = vi.fn();
        currentTime = 0;
        constructor(_: string) {}
        async play(): Promise<void> {
          await playMock();
        }
      },
    });

    const { result } = renderHook(() => useVoice({ onTranscript: vi.fn() }));

    await act(async () => {
      await result.current.playResponse("Autoplay check");
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Playback is waiting for interaction");
    });
    expect(playMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(2);
    });
    expect(result.current.error).toBeNull();
  });

  it("falls back to browser speech synthesis when autoplay is blocked", async () => {
    const playMock = vi.fn().mockRejectedValueOnce(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      writable: true,
      value: class {
        onended: (() => void) | null = null;
        pause = vi.fn();
        currentTime = 0;
        constructor(_: string) {}
        async play(): Promise<void> {
          await playMock();
        }
      },
    });

    class MockSpeechSynthesisUtterance {
      text: string;
      lang = "";
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      writable: true,
      value: MockSpeechSynthesisUtterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak: speakMock, cancel: cancelMock },
    });

    const { result } = renderHook(() => useVoice({ onTranscript: vi.fn() }));
    let played = false;
    await act(async () => {
      played = await result.current.playResponse("Autoplay fallback");
    });

    expect(played).toBe(true);
    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0]?.[0] as MockSpeechSynthesisUtterance;
    expect(utterance.text).toBe("Autoplay fallback");
    expect(result.current.error).toBeNull();

    await act(async () => {
      utterance.onend?.();
    });
    expect(result.current.voiceState).toBe("idle");
  });

  it("prefers browser speech synthesis before backend TTS when available", async () => {
    class MockSpeechSynthesisUtterance {
      text: string;
      lang = "";
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      writable: true,
      value: MockSpeechSynthesisUtterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak: speakMock, cancel: cancelMock },
    });

    const { result } = renderHook(() => useVoice({ onTranscript: vi.fn() }));
    let played = false;
    await act(async () => {
      played = await result.current.playResponse("**Direkt** lokal");
    });

    expect(played).toBe(true);
    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0]?.[0] as MockSpeechSynthesisUtterance;
    expect(utterance.text).toBe("Direkt lokal");
    expect(voiceApi.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("records, transcribes and passes transcript callback", async () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoice({ onTranscript }));

    await act(async () => {
      await result.current.toggleVoice();
    });
    await waitFor(() => {
      expect(result.current.isVoiceEnabled).toBe(true);
    });
    await act(async () => {
      await result.current.startRecording();
    });
    await waitFor(() => {
      expect(result.current.voiceState).toBe("recording");
    });
    await act(async () => {
      await result.current.stopRecording();
    });
    await waitFor(() => {
      expect(voiceApi.transcribeAudio).toHaveBeenCalled();
    });
    expect(onTranscript).toHaveBeenCalledWith("Hallo Welt");
    await waitFor(() => {
      expect(result.current.voiceState).toBe("idle");
    });
  });

  it("calls latest onTranscript even after re-render (stale closure regression)", async () => {
    const onTranscriptA = vi.fn();
    const onTranscriptB = vi.fn();
    const { result, rerender } = renderHook(({ onTranscript }) => useVoice({ onTranscript }), {
      initialProps: { onTranscript: onTranscriptA },
    });

    await act(async () => {
      await result.current.toggleVoice();
    });
    await waitFor(() => {
      expect(result.current.isVoiceEnabled).toBe(true);
    });
    await act(async () => {
      await result.current.startRecording();
    });
    await waitFor(() => {
      expect(result.current.voiceState).toBe("recording");
    });

    rerender({ onTranscript: onTranscriptB });

    await act(async () => {
      await result.current.stopRecording();
    });

    await waitFor(() => {
      expect(voiceApi.transcribeAudio).toHaveBeenCalled();
    });
    expect(onTranscriptB).toHaveBeenCalledWith("Hallo Welt");
    expect(onTranscriptA).not.toHaveBeenCalled();
  });

  it("shows send error separately from transcription error", async () => {
    const onTranscript = vi.fn().mockRejectedValue(new Error("send failed"));
    const { result } = renderHook(() => useVoice({ onTranscript }));

    await act(async () => {
      await result.current.toggleVoice();
    });
    await waitFor(() => {
      expect(result.current.isVoiceEnabled).toBe(true);
    });
    await act(async () => {
      await result.current.startRecording();
    });
    await waitFor(() => {
      expect(result.current.voiceState).toBe("recording");
    });
    await act(async () => {
      await result.current.stopRecording();
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Failed to send the message");
    });
    expect(result.current.error).not.toBe("Transcription failed");
  });

  it("hands-free VAD interval reads current voice state so silence can stop recording", async () => {
    const audioCtxDesc = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
    const intervalCallbacks: Array<() => void> = [];
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") {
        intervalCallbacks.push(fn as () => void);
      }
      return 999 as unknown as number;
    });
    const clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation(() => {});

    let analyserFill: (arr: Uint8Array) => void = () => {};
    class MockAnalyser {
      fftSize = 512;
      frequencyBinCount = 4;
      connect = vi.fn();
      getByteFrequencyData(arr: Uint8Array): void {
        analyserFill(arr);
      }
    }

    class MockAudioContext {
      state = "running";
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
      createAnalyser = vi.fn(() => new MockAnalyser());
      close = vi.fn().mockResolvedValue(undefined);
    }

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    let mockNow = 50_000;
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => mockNow);

    try {
      const onTranscript = vi.fn();
      const { result } = renderHook(() => useVoice({ onTranscript }));

      await act(async () => {
        await result.current.toggleVoice();
      });

      act(() => {
        result.current.setVoiceMode("hands_free");
      });

      await waitFor(() => {
        expect(intervalCallbacks.length).toBeGreaterThan(0);
      });

      const vadTick = intervalCallbacks[intervalCallbacks.length - 1]!;

      analyserFill = (arr) => {
        arr.fill(200);
      };
      await act(async () => {
        vadTick();
      });
      await waitFor(() => {
        expect(result.current.voiceState).toBe("recording");
      });

      analyserFill = (arr) => {
        arr.fill(0);
      };
      mockNow = 50_600;
      await act(async () => {
        vadTick();
      });
      mockNow = 52_100;
      await act(async () => {
        vadTick();
      });

      await waitFor(() => {
        expect(voiceApi.transcribeAudio).toHaveBeenCalled();
      });
      expect(onTranscript).toHaveBeenCalledWith("Hallo Welt");
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
      dateSpy.mockRestore();
      if (audioCtxDesc) {
        Object.defineProperty(globalThis, "AudioContext", audioCtxDesc);
      } else {
        Reflect.deleteProperty(globalThis, "AudioContext");
      }
    }
  });

  it("persists voice mode in localStorage", async () => {
    const { result } = renderHook(() => useVoice({ onTranscript: vi.fn() }));
    act(() => {
      result.current.setVoiceMode("hands_free");
    });
    expect(localStorage.getItem("ozy-voice-mode")).toBe("hands_free");
  });
});
