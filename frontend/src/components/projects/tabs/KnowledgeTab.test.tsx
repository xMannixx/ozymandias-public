import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KnowledgeTab from "@/components/projects/tabs/KnowledgeTab";
import { mockProjectDetail } from "@/test/projects-fixtures";

function renderKnowledge(overrides: Partial<ComponentProps<typeof KnowledgeTab>> = {}): void {
  const props: ComponentProps<typeof KnowledgeTab> = {
    project: mockProjectDetail,
    loading: false,
    onUploadFile: vi.fn(async () => undefined),
    onDeleteFile: vi.fn(async () => undefined),
    onDownloadFile: vi.fn(async () => undefined),
    onCreateLink: vi.fn(async () => undefined),
    onDeleteLink: vi.fn(async () => undefined),
    ...overrides,
  };
  render(<KnowledgeTab {...props} />);
}

describe("KnowledgeTab", () => {
  it("says which files can be quoted", () => {
    renderKnowledge();

    expect(
      screen.getByText("1 of 2 files can be quoted in this workspace's chats."),
    ).toBeInTheDocument();
    expect(screen.getByText("In context · 4,200 characters")).toBeInTheDocument();
  });

  it("explains files whose text cannot be read", () => {
    renderKnowledge();

    expect(screen.getByText("Stored only · text cannot be read")).toBeInTheDocument();
  });

  it("nudges towards an upload when there is no knowledge yet", () => {
    renderKnowledge({ project: { ...mockProjectDetail, files: [] } });

    expect(screen.getByText(/Upload a document and Ozy will use it/)).toBeInTheDocument();
  });

  it("uploads a chosen file", async () => {
    const user = userEvent.setup();
    const onUploadFile = vi.fn(async () => undefined);
    renderKnowledge({ onUploadFile });

    const file = new File(["hello"], "notes.md", { type: "text/markdown" });
    await user.upload(screen.getByLabelText("knowledge-file-input"), file);

    expect(onUploadFile).toHaveBeenCalledWith(file);
  });

  it("removes a file", async () => {
    const user = userEvent.setup();
    const onDeleteFile = vi.fn(async () => undefined);
    renderKnowledge({ onDeleteFile });

    await user.click(screen.getByRole("button", { name: "Remove contract.pdf" }));

    expect(onDeleteFile).toHaveBeenCalledWith("f1");
  });

  it("adds a reference link", async () => {
    const user = userEvent.setup();
    const onCreateLink = vi.fn(async () => undefined);
    renderKnowledge({ onCreateLink });

    await user.type(screen.getByLabelText("new-link-name"), "Guide");
    await user.type(screen.getByLabelText("new-link-url"), "https://example.org");
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(onCreateLink).toHaveBeenCalledWith({ name: "Guide", url: "https://example.org" });
  });
});
