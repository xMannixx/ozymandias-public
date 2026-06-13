import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactsSummary from "@/components/dashboard/ContactsSummary";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("ContactsSummary", () => {
  it("zeigt Kontaktanzahl", () => {
    render(<ContactsSummary contactsTotal={12} />);

    expect(screen.getByText("12 Kontakte")).toBeInTheDocument();
  });

  it("Klick navigiert zu /contacts", async () => {
    const user = userEvent.setup();
    render(<ContactsSummary contactsTotal={3} />);

    await user.click(screen.getByTestId("contacts-summary-card"));
    expect(navigateMock).toHaveBeenCalledWith("/contacts");
  });
});
