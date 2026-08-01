import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactCard from "@/components/contacts/ContactCard";
import { mockContact } from "@/test/contacts-fixtures";

vi.mock("@/components/contacts/AvatarDisplay", () => ({
  default: (): JSX.Element => <div data-testid="avatar-mock" />,
}));

describe("ContactCard", () => {
  it("zeigt Namen und Firma", () => {
    render(
      <ContactCard contact={mockContact} isSelected={false} onSelect={vi.fn()} />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Analytical Engines Ltd")).toBeInTheDocument();
  });

  it("zeigt Tags", () => {
    render(
      <ContactCard contact={mockContact} isSelected={false} onSelect={vi.fn()} />,
    );

    expect(screen.getByText("Arbeit")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
  });

  it("click calls onSelect with contact_id", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ContactCard contact={mockContact} isSelected={false} onSelect={onSelect} />,
    );

    await user.click(screen.getByTestId(`contact-card-${mockContact.contact_id}`));
    expect(onSelect).toHaveBeenCalledWith(mockContact.contact_id);
  });
});
