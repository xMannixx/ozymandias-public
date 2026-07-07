import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GoogleNotConnected from "@/components/mail/GoogleNotConnected";

describe("GoogleNotConnected", () => {
  it("zeigt Warnung wenn nicht verbunden", () => {
    render(
      <MemoryRouter>
        <GoogleNotConnected />
      </MemoryRouter>,
    );
    expect(screen.getByText("Google not connected")).toBeInTheDocument();
  });

  it("Link zu /settings vorhanden", () => {
    render(
      <MemoryRouter>
        <GoogleNotConnected />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Go to Settings" })).toHaveAttribute("href", "/settings");
  });
});
