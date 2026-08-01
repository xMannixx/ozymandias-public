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

  it('zeigt "Nicht verbunden" wenn disconnected', () => {
    render(<GoogleConnection />);
    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
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

  it('"Verbinden" Button ruft getGoogleAuthUrl auf', async () => {
    vi.mocked(getGoogleAuthUrl).mockResolvedValue({ url: "https://accounts.google.com/o/oauth2/auth" });
    const redirectSpy = vi.spyOn(googleRedirect, "to").mockImplementation(() => undefined);

    render(<GoogleConnection />);
    await userEvent.click(screen.getByRole("button", { name: "Mit Google verbinden" }));

    expect(getGoogleAuthUrl).toHaveBeenCalledTimes(1);
    expect(redirectSpy).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth");
  });

  it('"Trennen" Button ruft disconnectGoogle auf', async () => {
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
    await userEvent.click(screen.getByRole("button", { name: "Verbindung trennen" }));

    expect(disconnectGoogle).toHaveBeenCalledTimes(1);
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
