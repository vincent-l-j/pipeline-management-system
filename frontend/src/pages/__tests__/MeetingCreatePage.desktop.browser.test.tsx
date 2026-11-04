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
