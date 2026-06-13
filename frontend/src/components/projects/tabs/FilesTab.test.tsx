import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilesTab from "@/components/projects/tabs/FilesTab";
import { mockProjectDetail } from "@/test/projects-fixtures";

describe("FilesTab", () => {
  it("rendert dateiliste", () => {
    render(
      <FilesTab
        project={mockProjectDetail}
        loading={false}
        onUploadFile={vi.fn(async () => undefined)}
        onDeleteFile={vi.fn(async () => undefined)}
        onDownloadFile={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText("vertrag.pdf")).toBeInTheDocument();
  });

  it("upload ruft uploadFile auf", async () => {
    const user = userEvent.setup();
    const onUploadFile = vi.fn(async () => undefined);
    render(
      <FilesTab
        project={mockProjectDetail}
        loading={false}
        onUploadFile={onUploadFile}
        onDeleteFile={vi.fn(async () => undefined)}
        onDownloadFile={vi.fn(async () => undefined)}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["a"], "a.txt", { type: "text/plain" });
    await user.upload(input, file);

    expect(onUploadFile).toHaveBeenCalledWith(file);
  });

  it("download triggert callback", async () => {
    const user = userEvent.setup();
    const onDownloadFile = vi.fn(async () => undefined);
    render(
      <FilesTab
        project={mockProjectDetail}
        loading={false}
        onUploadFile={vi.fn(async () => undefined)}
        onDeleteFile={vi.fn(async () => undefined)}
        onDownloadFile={onDownloadFile}
      />,
    );

    await user.click(screen.getByText("Download"));

    expect(onDownloadFile).toHaveBeenCalledWith("f1");
  });
});
