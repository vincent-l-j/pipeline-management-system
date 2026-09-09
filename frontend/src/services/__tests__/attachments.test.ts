import type { AxiosProgressEvent, AxiosRequestConfig } from "axios";
import api, {
  deleteAttachment,
  downloadAttachment,
  listAttachments,
  uploadAttachment,
} from "../api";
import type { Attachment } from "../../types";

const ROW: Attachment = {
  id: "a1",
  pitch_id: "p1",
  filename: "deck.pdf",
  content_type: "application/pdf",
  size_bytes: 2048,
  uploaded_by_name: "Ada Lovelace",
  created_at: "2026-09-01T00:00:00Z",
};

function aFile(name = "deck.pdf"): File {
  return new File(["a pitch deck"], name, { type: "application/pdf" });
}

describe("listAttachments", () => {
  it("asks for the attachments of the given pitch", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: [ROW] });

    await listAttachments("p1");

    expect(get).toHaveBeenCalledWith("/pitches/p1/attachments");
  });

  it("returns the rows the API sent, field names untouched", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [ROW] });

    expect(await listAttachments("p1")).toEqual([ROW]);
  });
});

describe("uploadAttachment", () => {
  it("posts to the attachments endpoint of the given pitch", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: ROW });

    await uploadAttachment("p1", aFile());

    expect(post.mock.calls[0][0]).toBe("/pitches/p1/attachments");
  });

  it("sends the file as multipart under the field the API reads", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: ROW });
    const file = aFile();

    await uploadAttachment("p1", file);

    const body = post.mock.calls[0][1] as FormData;
    expect(body.get("file")).toBe(file);
  });

  it("leaves the content type to the browser so the boundary is right", () => {
    // Setting multipart/form-data by hand omits the boundary parameter, and the
    // request then cannot be parsed. Asserted because writing it out looks
    // helpful and quietly breaks every upload.
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: ROW });

    void uploadAttachment("p1", aFile());

    const config = post.mock.calls[0][2] as AxiosRequestConfig;
    expect(config.headers).toBeUndefined();
  });

  it("returns the attachment the API created", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: ROW });

    expect(await uploadAttachment("p1", aFile())).toEqual(ROW);
  });

  it("reports progress as a percentage while the file goes up", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: ROW });
    const seen: number[] = [];

    await uploadAttachment("p1", aFile(), (percent) => seen.push(percent));

    const config = post.mock.calls[0][2] as AxiosRequestConfig;
    config.onUploadProgress?.({
      loaded: 512,
      total: 2048,
    } as AxiosProgressEvent);
    config.onUploadProgress?.({
      loaded: 2048,
      total: 2048,
    } as AxiosProgressEvent);

    expect(seen).toEqual([25, 100]);
  });

  it("reports nothing when the total size is unknown", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: ROW });
    const seen: number[] = [];

    await uploadAttachment("p1", aFile(), (percent) => seen.push(percent));

    const config = post.mock.calls[0][2] as AxiosRequestConfig;
    config.onUploadProgress?.({ loaded: 512 } as AxiosProgressEvent);

    expect(seen).toEqual([]);
  });
});

describe("downloadAttachment", () => {
  it("asks for the attachment through its own pitch", async () => {
    const blob = new Blob(["bytes"]);
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: blob });

    await downloadAttachment("p1", "a1");

    expect(get.mock.calls[0][0]).toBe("/pitches/p1/attachments/a1/download");
  });

  it("asks for a binary response rather than parsed text", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValue({ data: new Blob(["bytes"]) });

    await downloadAttachment("p1", "a1");

    const config = get.mock.calls[0][1] as AxiosRequestConfig;
    expect(config.responseType).toBe("blob");
  });

  it("returns the bytes as a blob", async () => {
    const blob = new Blob(["bytes"]);
    vi.spyOn(api, "get").mockResolvedValue({ data: blob });

    expect(await downloadAttachment("p1", "a1")).toBe(blob);
  });
});

describe("deleteAttachment", () => {
  it("deletes the attachment through its own pitch", async () => {
    const remove = vi.spyOn(api, "delete").mockResolvedValue({ data: {} });

    await deleteAttachment("p1", "a1");

    expect(remove).toHaveBeenCalledWith("/pitches/p1/attachments/a1");
  });
});
