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
  it("shows how many contacts are saved", () => {
    render(<ContactsSummary contactsTotal={12} />);

    expect(screen.getByText("12 saved")).toBeInTheDocument();
    expect(screen.getByText("People Ozy can look up by name")).toBeInTheDocument();
  });

  it("says the address book is empty", () => {
    render(<ContactsSummary contactsTotal={0} />);

    expect(screen.getByText("Nobody in your address book yet")).toBeInTheDocument();
  });

  it("navigates to the address book", async () => {
    const user = userEvent.setup();
    render(<ContactsSummary contactsTotal={3} />);

    await user.click(screen.getByTestId("contacts-summary-card"));
    expect(navigateMock).toHaveBeenCalledWith("/contacts");
  });
});
