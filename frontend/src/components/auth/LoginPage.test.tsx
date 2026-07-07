import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage, { externalRedirect } from "@/components/auth/LoginPage";
import { AuthProvider } from "@/store/auth";
import { getGoogleAuthUrl, loginWithToken } from "@/api/auth";

vi.mock("@/api/auth", () => ({
  getGoogleAuthUrl: vi.fn(),
  loginWithToken: vi.fn(),
}));

function renderLogin(): void {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>home-page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("renders google login button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
  });

  it("submits dev token, stores token and redirects", async () => {
    vi.mocked(loginWithToken).mockResolvedValue({ access_token: "jwt-123" });
    renderLogin();

    await userEvent.type(screen.getByLabelText("dev-token-input"), "dev-token");
    await userEvent.click(screen.getByRole("button", { name: "Token Login" }));

    expect(loginWithToken).toHaveBeenCalledWith("dev-token");
    expect(window.localStorage.getItem("ozy.jwt")).toBe("jwt-123");
    expect(await screen.findByText("home-page")).toBeInTheDocument();
  });

  it("calls google auth endpoint on button click", async () => {
    const redirectSpy = vi.spyOn(externalRedirect, "to").mockImplementation(() => undefined);
    vi.mocked(getGoogleAuthUrl).mockResolvedValue({ url: "https://accounts.google.com/test" });
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
    expect(getGoogleAuthUrl).toHaveBeenCalled();
    expect(redirectSpy).toHaveBeenCalledWith("https://accounts.google.com/test");
  });
});
