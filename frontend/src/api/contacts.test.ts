import { createContact, listContacts } from "@/api/contacts";
import type { ContactResponse } from "@/api/types";

const minimalContact = (overrides: Partial<ContactResponse> = {}): ContactResponse => ({
  contact_id: "x",
  first_name: "Max",
  last_name: null,
  company: null,
  role: null,
  phones: [],
  emails: [],
  tags: [],
  has_avatar: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api/contacts", () => {
  it("listContacts setzt search und tag Query", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(makeJsonResponse([]));

    await listContacts("ada", "work");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/contacts?");
    expect(String(url)).toContain("search=ada");
    expect(String(url)).toContain("tag=work");
  });

  it("createContact sendet POST mit JSON Body", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse(minimalContact()));

    await createContact({ first_name: "Max" });

    const [, options] = fetchMock.mock.calls[0];
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify({ first_name: "Max" }));
  });
});
