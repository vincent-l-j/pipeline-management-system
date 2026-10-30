import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingDetailPage from "../MeetingDetailPage";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

const mockUser = { id: "u1", display_name: "Alice Admin", role: "admin" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

const MEETING = {
  id: "m1",
  title: "Discovery call",
  meeting_date: "2026-05-20",
  meeting_time: null,
  platform: "teams",
  summary: null,
  key_points: null,
  action_items: null,
  follow_up_date: null,
  recording_link: null,
  transcript_path: null,
  ai_import_status: null,
  pitch_id: "p1",
  created_at: "2026-05-20T00:00:00Z",
};

const RESPONSES: Record<string, unknown> = {
  "/meetings/m1": MEETING,
  "/meetings/m1/attendees": [],
  "/contacts": [],
  "/users/directory": [{ id: "u1", display_name: "Alice Admin" }],
};

// See PitchCreatePage.browser.test.tsx: the page settles outside act().
beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

beforeEach(() => {
  apiMocks.get.mockImplementation((url: string) => {
    const data = RESPONSES[url];
    return data === undefined
      ? Promise.reject(new Error(`no fixture for ${url}`))
      : Promise.resolve({ data });
  });
});

afterEach(() => {
  cleanup();
});

async function editMeeting() {
  render(
    <MemoryRouter initialEntries={["/meetings/m1"]}>
      <Routes>
        <Route path="/meetings/:meetingId" element={<MeetingDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(page.getByRole("button", { name: "Edit Meeting" }));
}

/** The input in a label's cell: the edit form's labels name no control. */
function inputUnder(label: string): DOMRect {
  const input = page
    .getByText(label, { exact: true })
    .element()
    .parentElement?.querySelector("input");
  if (!input) throw new Error(`no input under ${label}`);
  return input.getBoundingClientRect();
}

describe("the meeting edit form above the sm breakpoint", () => {
  it("runs at a width the second column applies at", () => {
    expect(window.innerWidth).toBeGreaterThanOrEqual(640);
  });

  it("puts Follow-up Date and Recording Link on one row", async () => {
    await editMeeting();

    const first = inputUnder("Follow-up Date");
    const second = inputUnder("Recording Link");

    expect(second.top).toBe(first.top);
    expect(second.left).toBeGreaterThanOrEqual(first.right);
  });
});
