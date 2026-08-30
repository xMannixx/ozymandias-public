import { renderHook, waitFor } from "@testing-library/react";
import { useChatStarters } from "@/hooks/useChatStarters";

const listChatStartersMock = vi.fn();

vi.mock("@/api/conversations", () => ({
  listChatStarters: () => listChatStartersMock(),
}));

const starters = [
  {
    id: "proposals",
    icon: "proposals",
    title: "Review 3 proposals",
    prompt: "Which memory proposals are waiting for me?",
  },
];

describe("useChatStarters", () => {
  beforeEach(() => {
    listChatStartersMock.mockReset();
    listChatStartersMock.mockResolvedValue(starters);
  });

  it("loads the suggestions on mount", async () => {
    const { result } = renderHook(() => useChatStarters());

    await waitFor(() => {
      expect(result.current.starters).toHaveLength(1);
    });
    expect(result.current.loading).toBe(false);
  });

  it("drops entries that are not suggestions", async () => {
    listChatStartersMock.mockResolvedValue([...starters, { id: "broken" }]);

    const { result } = renderHook(() => useChatStarters());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.starters).toHaveLength(1);
  });

  it("survives a misrouted response that answered with HTML", async () => {
    listChatStartersMock.mockResolvedValue("<!doctype html><html></html>");

    const { result } = renderHook(() => useChatStarters());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.starters).toEqual([]);
  });

  it("stays quiet when the request fails, because the screen has a fallback", async () => {
    listChatStartersMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useChatStarters());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.starters).toEqual([]);
  });

  it("reloads on demand", async () => {
    const { result } = renderHook(() => useChatStarters());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    await result.current.refetch();

    expect(listChatStartersMock).toHaveBeenCalledTimes(2);
  });
});
