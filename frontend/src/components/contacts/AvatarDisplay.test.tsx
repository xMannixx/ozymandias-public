import { render, screen, waitFor } from "@testing-library/react";
import AvatarDisplay from "@/components/contacts/AvatarDisplay";

vi.mock("@/store/auth", () => ({
  getToken: (): string => "test-token",
  forceLogout: vi.fn(),
}));

describe("AvatarDisplay", () => {
  it("shows initials when no avatar", () => {
    render(<AvatarDisplay contactId="c1" hasAvatar={false} label="Ada Lovelace" className="h-8 w-8" />);
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("AL");
  });

  it("laedt Bild bei hasAvatar", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(new Blob(["x"], { type: "image/png" }), { status: 200 }),
    );

    render(<AvatarDisplay contactId="c1" hasAvatar={true} label="Ada Lovelace" className="h-8 w-8" />);

    await waitFor(() => {
      const img = screen.getByTestId("avatar-image");
      expect(img.getAttribute("src")).toMatch(/^blob:/);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/contacts\/c1\/avatar$/),
      expect.objectContaining({
        headers: expect.any(Headers) as Headers,
      }),
    );

    fetchMock.mockRestore();
  });

  it("revoked Object URL beim Unmount", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(new Blob(["x"], { type: "image/png" }), { status: 200 }),
    );
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");

    const { unmount } = render(<AvatarDisplay contactId="c1" hasAvatar={true} label="Ada" className="h-8 w-8" />);

    let src = "";
    await waitFor(() => {
      const img = screen.getByTestId("avatar-image");
      src = img.getAttribute("src") ?? "";
      expect(src).toMatch(/^blob:/);
    });

    unmount();
    expect(revokeSpy).toHaveBeenCalledWith(src);

    fetchMock.mockRestore();
    revokeSpy.mockRestore();
  });
});
