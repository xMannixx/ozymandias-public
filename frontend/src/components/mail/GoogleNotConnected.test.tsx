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
    expect(screen.getByText("Google nicht verbunden")).toBeInTheDocument();
  });

  it("Link zu /settings vorhanden", () => {
    render(
      <MemoryRouter>
        <GoogleNotConnected />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Zu den Einstellungen" })).toHaveAttribute("href", "/settings");
  });
});
