import {
  createProject,
  listProjects,
  listTasks,
} from "@/api/projects";
import { downloadFile, uploadFile } from "@/api/files";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api/projects-files", () => {
  it("listProjects sends GET /projects", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse([{ project_id: "p1" }]));

    await listProjects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/projects");
  });

  it("listProjects sends status query when filter is set", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse([{ project_id: "p1" }]));

    await listProjects("active");

    expect(fetchMock.mock.calls[0][0]).toBe("/projects?status=active");
  });

  it("createProject sends POST /projects", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse({ project_id: "p2" }, 201));

    await createProject({ name: "Neu" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/projects");
    expect(options?.method).toBe("POST");
  });

  it("listTasks sends GET with status query", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse([{ task_id: "t1" }]));

    await listTasks("project-1", "open");

    expect(fetchMock.mock.calls[0][0]).toBe("/projects/project-1/tasks?status=open");
  });

  it("uploadFile sends multipart FormData via request client", async () => {
    const fetchMock = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(makeJsonResponse({ file_id: "f1" }, 200));

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    await uploadFile("project-1", file);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/files/project-1/upload");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBeInstanceOf(FormData);
  });

  it("downloadFile returns blob", async () => {
    window.localStorage.setItem("ozy.jwt", "token-123");
    const blobResponse = new Response(new Blob(["abc"], { type: "application/pdf" }), {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(blobResponse);

    const blob = await downloadFile("project-1", "f1");

    expect(fetchMock.mock.calls[0][0]).toBe("/files/project-1/files/f1/download");
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(0);
  });
});
