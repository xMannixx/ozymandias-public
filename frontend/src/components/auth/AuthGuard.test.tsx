import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";
import { AuthProvider, forceLogout } from "@/store/auth";

function renderGuard(initialPath = "/"): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>login-page</p>} />
          <Route element={<AuthGuard />}>
            <Route path="/" element={<p>protected-page</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("AuthGuard", () => {
  it("redirects to login without token", () => {
    renderGuard("/");
    expect(screen.getByText("login-page")).toBeInTheDocument();
  });

  it("renders protected content with token", () => {
    window.localStorage.setItem("ozy.jwt", "valid-token");
    renderGuard("/");
    expect(screen.getByText("protected-page")).toBeInTheDocument();
  });

  it("redirects when token is removed after mount", async () => {
    window.localStorage.setItem("ozy.jwt", "valid-token");
    renderGuard("/");
    expect(screen.getByText("protected-page")).toBeInTheDocument();

    act(() => {
      forceLogout();
    });
    expect(await screen.findByText("login-page")).toBeInTheDocument();
  });
});
