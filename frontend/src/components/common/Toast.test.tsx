import { act, render, screen } from "@testing-library/react";
import Toast from "@/components/common/Toast";

describe("Toast", () => {
  it("renders message with error style", () => {
    render(<Toast message="boom" type="error" />);
    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("boom");
    expect(toast).toHaveClass("text-red-100");
  });

  it("floats in the viewport so it stays visible on long pages", () => {
    render(<Toast message="saved" type="success" />);
    expect(screen.getByRole("status")).toHaveClass("fixed");
  });

  it("hides after timeout", async () => {
    vi.useFakeTimers();
    render(<Toast message="temp" timeoutMs={50} />);
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
