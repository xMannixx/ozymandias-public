import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GoogleNotConnected from "@/components/mail/GoogleNotConnected";

describe("GoogleNotConnected", () => {
  it("shows warning when not connected", () => {
    render(
      <MemoryRouter>
        <GoogleNotConnected />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Google is not connected yet/)).toBeInTheDocument();
  });

  it("provides a link back to the settings integrations section", () => {
    render(
      <MemoryRouter>
        <GoogleNotConnected />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "Open Settings to connect Google" }),
    ).toHaveAttribute("href", "/settings#settings-integrations");
  });
});
