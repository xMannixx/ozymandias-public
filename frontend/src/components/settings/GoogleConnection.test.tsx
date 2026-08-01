import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GoogleConnection, { googleRedirect } from "@/components/settings/GoogleConnection";
import { disconnectGoogle, getGoogleAuthUrl } from "@/api/auth";

const useGoogleStatusMock = vi.fn();

vi.mock("@/hooks/useGoogleStatus", () => ({
  useGoogleStatus: () => useGoogleStatusMock(),
}));

vi.mock("@/api/auth", () => ({
  disconnectGoogle: vi.fn(),
  getGoogleAuthUrl: vi.fn(),
}));

describe("GoogleConnection", () => {
  beforeEach(() => {
    useGoogleStatusMock.mockReset();
    useGoogleStatusMock.mockReturnValue({
      connected: false,
      email: null,
      scopes: [],
      loading: false,
      error: null,
      refetch: vi.fn(async () => null),
    });
    vi.mocked(getGoogleAuthUrl).mockReset();
    vi.mocked(disconnectGoogle).mockReset();
  });

  it("shows a not-connected status when disconnected", () => {
    render(<GoogleConnection />);
    expect(screen.getByText(/Status: Not connected/)).toBeInTheDocument();
  });

  it("explains what connecting Google will do", () => {
    render(<GoogleConnection />);
    expect(screen.getByText(/Google's own sign-in page/i)).toBeInTheDocument();
    expect(screen.getByText(/password is never seen by Ozymandias/i)).toBeInTheDocument();
  });

  it("shows email when connected", () => {
    useGoogleStatusMock.mockReturnValue({
      connected: true,
      email: "owner@example.com",
      scopes: ["scope-a"],
      loading: false,
      error: null,
      refetch: vi.fn(async () => null),
    });
    render(<GoogleConnection />);
    expect(screen.getByText("Email: owner@example.com")).toBeInTheDocument();
  });

  it("connect button calls getGoogleAuthUrl", async () => {
    vi.mocked(getGoogleAuthUrl).mockResolvedValue({ url: "https://accounts.google.com/o/oauth2/auth" });
    const redirectSpy = vi.spyOn(googleRedirect, "to").mockImplementation(() => undefined);

    render(<GoogleConnection />);
    await userEvent.click(screen.getByRole("button", { name: "Connect Google" }));

    expect(getGoogleAuthUrl).toHaveBeenCalledTimes(1);
    expect(redirectSpy).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth");
  });

  it("disconnect button calls disconnectGoogle", async () => {
    const refetchMock = vi.fn(async () => null);
    useGoogleStatusMock.mockReturnValue({
      connected: true,
      email: "owner@example.com",
      scopes: [],
      loading: false,
      error: null,
      refetch: refetchMock,
    });
    vi.mocked(disconnectGoogle).mockResolvedValue({ disconnected: true });

    render(<GoogleConnection />);
    await userEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));

    expect(disconnectGoogle).toHaveBeenCalledTimes(1);
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
