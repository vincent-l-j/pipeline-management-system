import { page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import MeetingDetailPage from "../MeetingDetailPage";
import PitchDetailPage from "../PitchDetailPage";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  listAttachments: vi.fn().mockResolvedValue([]),
  uploadAttachment: vi.fn(),
  downloadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));

const apiMocks = createApiMocks();

// Admin, so the pitch header carries every action it can show, Delete included.
const mockUser = { id: "u1", display_name: "Alice Admin", role: "admin" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

// Short on purpose: the actions alone are wider than a phone, so an ordinary
// title already overflows and a long one would hide that.
const PITCH = {
  id: "p1",
  title: "Sep pitch",
  short_description: "Soil carbon measured from the air.",
  current_stage: "initial_screen",
  is_confidential: false,
  lead_id: "u1",
  organisation_id: null,
  contact_ids: [],
};

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
  "/pitches/p1": PITCH,
  "/users/directory": [{ id: "u1", display_name: "Alice Admin" }],
  "/meetings?pitch_id=p1": [],
  "/pitches/p1/assessments": [],
  "/pitches/p1/timeline": { events: [] },
  "/contacts": [],
  "/meetings/m1": MEETING,
  "/meetings/m1/attendees": [],
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

function viewportOverflow(): number {
  const root = document.documentElement;
  return root.scrollWidth - root.clientWidth;
}

const DETAIL_PAGES: [
  name: string,
  path: string,
  route: string,
  element: ReactElement,
  title: string,
  actions: string[],
][] = [
  [
    "Pitch detail",
    "/pitches/p1",
    "/pitches/:pitchId",
    <PitchDetailPage />,
    PITCH.title,
    ["Edit", "Log Meeting", "New Assessment", "Delete"],
  ],
  [
    "Meeting detail",
    "/meetings/m1",
    "/meetings/:meetingId",
    <MeetingDetailPage />,
    MEETING.title,
    ["Edit Meeting", "Back to Meetings"],
  ],
];

async function show(
  path: string,
  route: string,
  element: ReactElement,
  title: string,
) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );
  await expect
    .element(page.getByRole("heading", { name: title, level: 1 }))
    .toBeVisible();
}

// The assessment detail page has the same header shape; its own browser test
// covers it.
describe("detail pages on a 360px screen", () => {
  it("runs at the width the mobile layout was designed for", () => {
    expect(window.innerWidth).toBe(360);
  });

  it.each(DETAIL_PAGES)(
    "%s does not overflow the viewport",
    async (_name, path, route, element, title) => {
      await show(path, route, element, title);

      expect(viewportOverflow()).toBeLessThanOrEqual(0);
    },
  );

  it.each(DETAIL_PAGES)(
    "%s keeps every header action on screen",
    async (_name, path, route, element, title, actions) => {
      await show(path, route, element, title);

      for (const name of actions) {
        const { left, right } = page
          .getByRole("main")
          .getByText(name, { exact: true })
          .element()
          .getBoundingClientRect();
        expect(left, name).toBeGreaterThanOrEqual(0);
        expect(right, name).toBeLessThanOrEqual(window.innerWidth);
      }
    },
  );
});
