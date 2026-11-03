import { page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MeetingCreatePage from "../MeetingCreatePage";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const apiMocks = createApiMocks();

const mockUser = { id: "u1", display_name: "Alice Assessor", role: "assessor" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

/** Grid order, so each row is the fields the layout puts side by side. */
const ROWS: string[][] = [
  ["Date *", "Time", "Platform"],
  ["Follow-up Date", "Recording Link"],
];

beforeEach(() => {
  apiMocks.get.mockResolvedValue({ data: [] });
});

afterEach(() => {
  cleanup();
  window.scrollTo(0, 0);
});

async function showForm() {
  render(
    <MemoryRouter>
      <MeetingCreatePage />
    </MemoryRouter>,
  );
  await expect.element(page.getByLabelText("Linked Pitch *")).toBeVisible();
}

const rect = (label: string) =>
  page.getByLabelText(label).element().getBoundingClientRect();

/** The label-and-control block the form spaces, not the control inside it. */
function fieldBox(label: string): DOMRect {
  const block = page.getByLabelText(label).element().parentElement;
  if (!block) throw new Error(`${label} has no enclosing block`);
  return block.getBoundingClientRect();
}

describe("the meeting form above the sm breakpoint", () => {
  it("runs at a width the grid's columns apply at", () => {
    expect(window.innerWidth).toBeGreaterThanOrEqual(640);
  });

  it.each(ROWS)("puts %s beside the fields that follow it", async (...row) => {
    await showForm();

    for (let i = 1; i < row.length; i++) {
      expect(rect(row[i]).top).toBe(rect(row[0]).top);
      expect(rect(row[i]).left).toBeGreaterThanOrEqual(rect(row[i - 1]).right);
    }
  });
});

describe("the meeting form's actions above the md breakpoint", () => {
  it("runs at a width md applies at", () => {
    expect(window.innerWidth).toBeGreaterThanOrEqual(768);
  });

  // Pinned, the bar would sit at the foot of the screen, above fields the
  // reader has not reached; at a desk the actions follow the last field.
  it("places the actions after the last field rather than pinning them", async () => {
    await showForm();
    expect(document.documentElement.scrollHeight).toBeGreaterThan(
      window.innerHeight,
    );

    const save = page
      .getByRole("button", { name: "Save Meeting" })
      .element()
      .getBoundingClientRect();

    expect(save.top).toBeGreaterThan(rect("Recording Link").bottom);
  });

  it("spaces the actions from the last field as the fields are spaced", async () => {
    await showForm();
    const bar = page.getByTestId("save-bar").element().getBoundingClientRect();
    const fieldGap =
      page
        .getByText("Key Points", { exact: true })
        .element()
        .getBoundingClientRect().top - fieldBox("Summary").bottom;

    expect(bar.top - fieldBox("Recording Link").bottom).toBe(fieldGap);
  });

  it("draws no band behind the actions", async () => {
    await showForm();
    const style = getComputedStyle(page.getByTestId("save-bar").element());

    expect(style.borderTopWidth).toBe("0px");
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });
});
