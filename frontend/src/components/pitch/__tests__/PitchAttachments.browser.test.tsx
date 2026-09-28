import { page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import PitchAttachments from "../PitchAttachments";
import { listAttachments } from "../../../services/api";

vi.mock("../../../services/api", () => ({
  default: {},
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  downloadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

beforeEach(() => {
  vi.mocked(listAttachments).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

async function showAttachments() {
  render(<PitchAttachments pitchId="p1" />);
  await expect
    .element(page.getByText("No files attached yet."))
    .toBeInTheDocument();
}

// A phone reports hover: none, which is the browser saying there is no dragging
// here — so the instruction that tells a reader to drop a file is wrong.
describe("the attachments dropzone on a touchscreen", () => {
  it("tells the reader to tap rather than to drag", async () => {
    await showAttachments();

    await expect.element(page.getByText(/tap to choose a file/i)).toBeVisible();
    await expect.element(page.getByText(/drop a file here/i)).not.toBeVisible();
  });

  it("puts the file picker under a finger anywhere on the zone", async () => {
    await showAttachments();
    const input = page.getByLabelText("Attach a file").element();
    const { left, top, width, height } = input.getBoundingClientRect();

    // Whatever a tap in the middle of the zone lands on is what opens.
    const hit = document.elementFromPoint(left + width / 2, top + height / 2);

    expect(hit).toBe(input);
    expect(height).toBeGreaterThanOrEqual(44);
  });
});
