import { getVoices, synthesizeSpeech, transcribeAudio } from "@/api/voice";
import * as authStore from "@/store/auth";

describe("api/voice", () => {
  it("sends multipart to /voice/stt", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ text: "transcript" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await transcribeAudio(new Blob(["audio"]));
    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe("/voice/stt");
    expect(options?.body).toBeInstanceOf(FormData);
    expect(result).toBe("transcript");
  });

  it("requests TTS as blob with auth header", async () => {
    vi.spyOn(authStore, "getToken").mockReturnValue("token-123");
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(new Blob(["mp3-data"], { type: "audio/mpeg" }), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );

    const blob = await synthesizeSpeech("Hallo", "ash", "tts-1");
    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe("/voice/tts");
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("audio/mpeg");
  });

  it("loads available voices list", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ voices: ["ash", "alloy"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const voices = await getVoices();
    expect(voices).toEqual(["ash", "alloy"]);
  });
});
