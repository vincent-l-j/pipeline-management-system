import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PitchAttachments from "../PitchAttachments";
import {
  deleteAttachment,
  downloadAttachment,
  listAttachments,
  uploadAttachment,
} from "../../../services/api";
import type { Attachment } from "../../../types";

vi.mock("../../../services/api", () => ({
  default: {},
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  downloadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

let mockUser = { role: "admin" };
vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

const listed = vi.mocked(listAttachments);
const uploaded = vi.mocked(uploadAttachment);
const downloaded = vi.mocked(downloadAttachment);
const removed = vi.mocked(deleteAttachment);

const DECK: Attachment = {
  id: "a1",
  pitch_id: "p1",
  filename: "deck.pdf",
  content_type: "application/pdf",
  size_bytes: 2048,
  uploaded_by_name: "Ada Lovelace",
  created_at: "2026-09-01T00:00:00Z",
};

const CASE: Attachment = {
  ...DECK,
  id: "a2",
  filename: "business-case.docx",
  uploaded_by_name: "Grace Hopper",
};

function aFile(name = "deck.pdf"): File {
  return new File(["a pitch deck"], name, { type: "application/pdf" });
}

/** A rejection shaped like the one axios delivers for a refused request. */
function refusal(status: number, detail: string): unknown {
  return { response: { status, data: { detail } } };
}

/**
 * A drop really carries a `FileList`, not an array — so this builds one.
 *
 * The difference matters: an array answers `[0]` and nothing else, so a handler
 * reading `.item(0)` works against a real browser and not against a plainer
 * stub. Faking the array shape would let the test pass over code the browser
 * would break.
 */
function fileList(files: File[]): FileList {
  const list: Record<string | number, unknown> = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
  };
  // The numeric properties too, spelled out rather than spread: spreading an
  // array into an object is the same thing but reads like a mistake.
  files.forEach((file, index) => {
    list[index] = file;
  });
  return list as unknown as FileList;
}

/**
 * HTML5 drag and drop has no `user-event` equivalent — it drives pointer and
 * keyboard input, not `DataTransfer` — so these two go through `fireEvent`.
 */
function dragOver(target: HTMLElement, files: File[] = [aFile()]): void {
  fireEvent.dragOver(target, {
    dataTransfer: { files: fileList(files), types: ["Files"] },
  });
}

function drop(target: HTMLElement, files: File[] = [aFile()]): void {
  fireEvent.drop(target, {
    dataTransfer: { files: fileList(files), types: ["Files"] },
  });
}

function dropTarget(): HTMLElement {
  return screen.getByLabelText(/attach a file/i);
}

beforeEach(() => {
  mockUser = { role: "admin" };
  listed.mockResolvedValue([]);
  uploaded.mockResolvedValue(DECK);
  downloaded.mockResolvedValue(new Blob(["bytes"]));
  removed.mockResolvedValue(undefined);
});

describe("loading the list", () => {
  it("asks for the given pitch's attachments", async () => {
    render(<PitchAttachments pitchId="p1" />);

    await waitFor(() => {
      expect(listed).toHaveBeenCalledWith("p1");
    });
  });

  it("shows the empty state when the pitch has none", async () => {
    render(<PitchAttachments pitchId="p1" />);

    expect(await screen.findByText(/no files attached/i)).toBeInTheDocument();
  });

  it("shows each attachment's name", async () => {
    listed.mockResolvedValue([DECK, CASE]);
    render(<PitchAttachments pitchId="p1" />);

    expect(await screen.findByText("deck.pdf")).toBeInTheDocument();
    expect(screen.getByText("business-case.docx")).toBeInTheDocument();
  });

  it("shows who uploaded each attachment", async () => {
    listed.mockResolvedValue([DECK]);
    render(<PitchAttachments pitchId="p1" />);

    expect(await screen.findByText(/Ada Lovelace/)).toBeInTheDocument();
  });

  it("says so when the list could not be loaded", async () => {
    listed.mockRejectedValue(refusal(500, "Internal server error"));
    render(<PitchAttachments pitchId="p1" />);

    expect(
      await screen.findByText("Internal server error"),
    ).toBeInTheDocument();
  });
});

describe("dropping a file", () => {
  it("shows that a dragged file will be accepted", async () => {
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);

    dragOver(dropTarget());

    expect(await screen.findByText(/drop to attach/i)).toBeInTheDocument();
  });

  it("stops showing that once the file is dragged away", async () => {
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);

    dragOver(dropTarget());
    await screen.findByText(/drop to attach/i);
    fireEvent.dragLeave(dropTarget());

    await waitFor(() => {
      expect(screen.queryByText(/drop to attach/i)).not.toBeInTheDocument();
    });
  });

  it("uploads the dropped file to the given pitch", async () => {
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);
    const file = aFile();

    drop(dropTarget(), [file]);

    await waitFor(() => {
      expect(uploaded).toHaveBeenCalledWith("p1", file, expect.any(Function));
    });
  });

  it("adds the uploaded attachment to the list without reloading", async () => {
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);

    drop(dropTarget());

    expect(await screen.findByText("deck.pdf")).toBeInTheDocument();
    // One call, from mount: the row came from the response, not a re-fetch.
    expect(listed).toHaveBeenCalledTimes(1);
  });

  it("shows the uploader of the attachment it just added", async () => {
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);

    drop(dropTarget());

    expect(await screen.findByText(/Ada Lovelace/)).toBeInTheDocument();
  });

  it("ignores a drop that carries no file", async () => {
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);

    drop(dropTarget(), []);

    expect(uploaded).not.toHaveBeenCalled();
  });
});

describe("choosing a file through the picker", () => {
  it("uploads the file the picker returned", async () => {
    const user = userEvent.setup();
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);
    const file = aFile();

    await user.upload(screen.getByLabelText(/attach a file/i), file);

    await waitFor(() => {
      expect(uploaded).toHaveBeenCalledWith("p1", file, expect.any(Function));
    });
  });
});

describe("a failed upload", () => {
  it("shows the server's reason", async () => {
    uploaded.mockRejectedValue(
      refusal(400, "File is larger than the 25 MB limit"),
    );
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);

    drop(dropTarget());

    expect(
      await screen.findByText("File is larger than the 25 MB limit"),
    ).toBeInTheDocument();
  });

  it("adds no row", async () => {
    uploaded.mockRejectedValue(
      refusal(400, "Files of this type are not accepted"),
    );
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);

    drop(dropTarget());

    await screen.findByText("Files of this type are not accepted");
    expect(screen.getByText(/no files attached/i)).toBeInTheDocument();
  });

  it("leaves the row out of limbo — no progress is left showing", async () => {
    uploaded.mockRejectedValue(refusal(502, "The file could not be saved"));
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);

    drop(dropTarget());

    await screen.findByText("The file could not be saved");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

/**
 * Stub the anchor click the download path makes.
 *
 * Wrapped in a function so `ReturnType` keeps the spy's real type — reading it
 * off `vi.spyOn` directly loses the generics and everything downstream becomes
 * `any`.
 */
function stubAnchorClick() {
  return vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => undefined);
}

describe("downloading", () => {
  let click: ReturnType<typeof stubAnchorClick>;

  beforeEach(() => {
    // jsdom implements neither, and the component needs both to hand the blob
    // to the browser.
    URL.createObjectURL = vi.fn(() => "blob:deck");
    URL.revokeObjectURL = vi.fn();
    // Stubbed for the assertion below, and because jsdom answers a real anchor
    // click with "Not implemented: navigation to another Document" on stderr.
    click = stubAnchorClick();
  });

  afterEach(() => {
    // clearMocks calls mockClear, which does not uninstall a spy.
    click.mockRestore();
  });

  it("offers the file to the browser under its own name", async () => {
    const user = userEvent.setup();
    listed.mockResolvedValue([DECK]);
    render(<PitchAttachments pitchId="p1" />);

    await user.click(
      await screen.findByRole("button", { name: /download deck\.pdf/i }),
    );

    await waitFor(() => {
      expect(click).toHaveBeenCalled();
    });
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("deck.pdf");
  });

  it("fetches the bytes through the backend", async () => {
    const user = userEvent.setup();
    listed.mockResolvedValue([DECK]);
    render(<PitchAttachments pitchId="p1" />);

    await user.click(
      await screen.findByRole("button", { name: /download deck\.pdf/i }),
    );

    expect(downloaded).toHaveBeenCalledWith("p1", "a1");
  });

  it("shows the reason when the download fails", async () => {
    const user = userEvent.setup();
    listed.mockResolvedValue([DECK]);
    downloaded.mockRejectedValue(refusal(502, "The file could not be read"));
    render(<PitchAttachments pitchId="p1" />);

    await user.click(
      await screen.findByRole("button", { name: /download deck\.pdf/i }),
    );

    expect(
      await screen.findByText("The file could not be read"),
    ).toBeInTheDocument();
  });
});

describe("removing", () => {
  it("deletes the attachment through its own pitch", async () => {
    const user = userEvent.setup();
    listed.mockResolvedValue([DECK]);
    render(<PitchAttachments pitchId="p1" />);

    await user.click(
      await screen.findByRole("button", { name: /remove deck\.pdf/i }),
    );

    expect(removed).toHaveBeenCalledWith("p1", "a1");
  });

  it("takes the row out of the list", async () => {
    const user = userEvent.setup();
    listed.mockResolvedValue([DECK]);
    render(<PitchAttachments pitchId="p1" />);

    await user.click(
      await screen.findByRole("button", { name: /remove deck\.pdf/i }),
    );

    await waitFor(() => {
      expect(screen.queryByText("deck.pdf")).not.toBeInTheDocument();
    });
  });

  it("keeps the row and shows the reason when the delete fails", async () => {
    const user = userEvent.setup();
    listed.mockResolvedValue([DECK]);
    removed.mockRejectedValue(refusal(502, "The file could not be removed"));
    render(<PitchAttachments pitchId="p1" />);

    await user.click(
      await screen.findByRole("button", { name: /remove deck\.pdf/i }),
    );

    expect(
      await screen.findByText("The file could not be removed"),
    ).toBeInTheDocument();
    expect(screen.getByText("deck.pdf")).toBeInTheDocument();
  });
});

describe("what a viewer sees", () => {
  // Clarity only. The server refuses a viewer's upload and delete regardless,
  // and the hidden control is not the protection — the backend tests are.
  beforeEach(() => {
    mockUser = { role: "viewer" };
    listed.mockResolvedValue([DECK]);
  });

  it("sees the attachment", async () => {
    render(<PitchAttachments pitchId="p1" />);

    expect(await screen.findByText("deck.pdf")).toBeInTheDocument();
  });

  it("sees the download control", async () => {
    render(<PitchAttachments pitchId="p1" />);

    expect(
      await screen.findByRole("button", { name: /download deck\.pdf/i }),
    ).toBeInTheDocument();
  });

  it("sees no upload control", async () => {
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText("deck.pdf");

    expect(screen.queryByLabelText(/attach a file/i)).not.toBeInTheDocument();
  });

  it("sees no remove control", async () => {
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText("deck.pdf");

    expect(
      screen.queryByRole("button", { name: /remove deck\.pdf/i }),
    ).not.toBeInTheDocument();
  });
});

describe("what an assessor sees", () => {
  it("sees the upload control", async () => {
    mockUser = { role: "assessor" };
    render(<PitchAttachments pitchId="p1" />);
    await screen.findByText(/no files attached/i);

    expect(screen.getByLabelText(/attach a file/i)).toBeInTheDocument();
  });
});
