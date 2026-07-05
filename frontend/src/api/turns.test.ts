import { postTurn } from "@/api/turns";

describe("api/turns", () => {
  it("posts to /turns and returns response", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ turn_id: "t1", response_text: "Hello", provider: "deepseek", model: "deepseek-chat" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await postTurn("hi", { provider: "deepseek", model: "deepseek-chat" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/turns");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(
      JSON.stringify({
        text: "hi",
        channel: "web",
        claims: undefined,
        provider: "deepseek",
        model: "deepseek-chat",
        allow_s3_cloud_fallback: undefined,
        use_live_web: undefined,
        allow_s3_live_web: undefined,
        conversation_id: undefined,
      }),
    );
    expect(result.response_text).toBe("Hello");
    expect(result.provider).toBe("deepseek");
    expect(result.model).toBe("deepseek-chat");
  });

  it("passes conversation_id when provided", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ turn_id: "t2", conversation_id: "c1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await postTurn("hi again", { conversationId: "c1" });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options?.body)) as Record<string, unknown>;
    expect(body.conversation_id).toBe("c1");
    expect(result.conversation_id).toBe("c1");
  });
});
