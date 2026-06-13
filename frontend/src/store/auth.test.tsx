import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/store/auth";

function Probe(): JSX.Element {
  const { token, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <p>{token ?? "none"}</p>
      <p>{isAuthenticated ? "yes" : "no"}</p>
      <button type="button" onClick={() => login("jwt-1")}>
        do-login
      </button>
      <button type="button" onClick={() => logout()}>
        do-logout
      </button>
    </div>
  );
}

describe("store/auth useAuth", () => {
  it("login stores token and sets authenticated=true", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "do-login" }));
    expect(window.localStorage.getItem("ozy.jwt")).toBe("jwt-1");
    expect(screen.getByText("yes")).toBeInTheDocument();
  });

  it("logout removes token and sets authenticated=false", async () => {
    window.localStorage.setItem("ozy.jwt", "jwt-1");
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "do-logout" }));
    expect(window.localStorage.getItem("ozy.jwt")).toBeNull();
    expect(screen.getByText("no")).toBeInTheDocument();
  });
});
