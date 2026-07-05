import { postTurn, streamTurn, type TurnStreamEvent } from "@/api/turns";

function sseResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

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

  it("streamTurn parses SSE delta, result and error events", async () => {
    const sseBody =
      'event: delta\ndata: {"text": "Hel"}\n\n'
      + 'event: delta\ndata: {"text": "lo"}\n\n'
      + 'event: result\ndata: {"turn_id": "t1", "response_text": "Hello"}\n\n';
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(sseResponse(sseBody));

    const events: TurnStreamEvent[] = [];
    for await (const event of streamTurn("hi", { provider: "ollama" })) {
      events.push(event);
    }

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/turns/stream");
    expect(options?.method).toBe("POST");
    expect(events.map((event) => event.event)).toEqual(["delta", "delta", "result"]);
    expect(events[0].data).toEqual({ text: "Hel" });
    const result = events[2];
    expect(result.event).toBe("result");
    if (result.event === "result") {
      expect(result.data.response_text).toBe("Hello");
    }
  });

  it("streamTurn surfaces error events from the stream", async () => {
    const sseBody =
      'event: error\ndata: {"code": "service_error", "message": "boom"}\n\n';
    vi.spyOn(window, "fetch").mockResolvedValue(sseResponse(sseBody));

    const events: TurnStreamEvent[] = [];
    for await (const event of streamTurn("hi")) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("error");
    if (events[0].event === "error") {
      expect(events[0].data.code).toBe("service_error");
    }
  });

  it("streamTurn throws ApiError on non-OK response", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "locked" }), {
        status: 423,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const iterate = async (): Promise<void> => {
      for await (const _event of streamTurn("hi")) {
        // no events expected
      }
    };
    await expect(iterate()).rejects.toMatchObject({ status: 423, message: "locked" });
  });
});
