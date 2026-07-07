import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactList from "@/components/contacts/ContactList";
import { mockContact } from "@/test/contacts-fixtures";

vi.mock("@/components/contacts/AvatarDisplay", () => ({
  default: (): JSX.Element => <div data-testid="avatar-mock" />,
}));

describe("ContactList", () => {
  const baseProps = {
    contacts: [mockContact],
    allTags: ["Arbeit", "VIP"],
    loading: false,
    error: null,
    searchQuery: "",
    tagFilter: null,
    selectedId: null,
    creatingOpen: false,
    onSearchChange: vi.fn(),
    onTagFilter: vi.fn(),
    onSelect: vi.fn(),
    onOpenCreate: vi.fn(),
  };

  it("zeigt Suchfeld", () => {
    render(<ContactList {...baseProps} />);
    expect(screen.getByLabelText("contacts-search")).toBeInTheDocument();
  });

  it("zeigt Tag-Filter wenn allTags nicht leer", () => {
    render(<ContactList {...baseProps} />);
    expect(screen.getByTestId("contact-tag-filters")).toBeInTheDocument();
    const filterRow = screen.getByTestId("contact-tag-filters");
    expect(filterRow).toHaveTextContent("Arbeit");
    expect(filterRow).toHaveTextContent("VIP");
  });

  it("zeigt leer-Hinweis ohne Kontakte", () => {
    render(<ContactList {...baseProps} contacts={[]} />);
    expect(screen.getByText("No contacts found.")).toBeInTheDocument();
  });

  it("Suchfeld aendern ruft onSearchChange auf", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<ContactList {...baseProps} onSearchChange={onSearchChange} />);

    await user.type(screen.getByLabelText("contacts-search"), "Ada");
    expect(onSearchChange).toHaveBeenCalled();
  });
});
