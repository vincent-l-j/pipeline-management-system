import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import AssessmentsPage from "../AssessmentsPage";
import ContactsPage from "../ContactsPage";
import DashboardPage from "../DashboardPage";
import MeetingsPage from "../MeetingsPage";
import OrganisationsPage from "../OrganisationsPage";
import PipelinePage from "../PipelinePage";
import PitchesPage from "../PitchesPage";
import ReportsPage from "../ReportsPage";
import SearchPage from "../SearchPage";
import UsersPage from "../UsersPage";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

const mockUser = { id: "u1", display_name: "Alice Admin", role: "admin" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

// Long the way real records are long: names, titles and email addresses that no
// 360px column can hold.
const PITCH = {
  id: "p1",
  title: "Autonomous Remote Sensing for Rangeland Carbon Accounting",
  short_description: "A long-running collaboration with three universities",
  source: "university",
  funding_pathway: "crc_project",
  domain_tags: "agriculture, remote sensing, carbon",
  current_stage: "deep_assessment",
  submission_date: "2026-03-14",
  lead_id: "u1",
};

const CONTACT = {
  id: "c1",
  first_name: "Bartholomew",
  last_name: "Wintergreen-Fitzwilliam",
  email: "bartholomew.wintergreen@wintergreen-innovation.example.com",
  organisation_ids: ["o1"],
};

// Holds the table at its real width while the first row is edited: alone, that
// row's columns would collapse to fit the inputs and hide the overflow.
const SECOND_CONTACT = {
  ...CONTACT,
  id: "c2",
  first_name: "Persephone",
  last_name: "Featherstonehaugh-Cholmondeley",
  email: "persephone.featherstonehaugh@rangeland-carbon.example.com",
};

const ORGANISATION = {
  id: "o1",
  name: "Wintergreen Innovation Partners (Australia) Limited",
  org_type: "university",
  sector: "Agriculture and environmental sciences",
  state_territory: "NSW",
  website: "https://wintergreen-innovation.example.com",
  abn: "12 345 678 901",
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
};

/** Unaffiliated with the contact, so the picker still offers it. */
const OTHER_ORGANISATION = {
  ...ORGANISATION,
  id: "o2",
  name: "Rangeland Carbon Cooperative Research Centre",
};

const ASSESSMENT = {
  id: "a1",
  pitch_id: "p1",
  assessor_id: "u1",
  assessment_date: "2026-04-02",
  version: 2,
  recommendation: "proceed",
  rationale: "Strong alignment with the rangeland carbon programme",
  strategic_alignment: 4,
  technical_feasibility: 3,
  commercial_potential: 4,
  team_capability: 5,
  funding_viability: 3,
};

const DIRECTORY = [
  { id: "u1", display_name: "Alexandra McConnell-Fitzwilliam" },
];

const MEETING = {
  id: "m1",
  title: "Discovery meeting with Wintergreen Innovation Partners",
  meeting_date: "2026-05-20",
  platform: "teams",
  follow_up_date: "2026-06-03",
  ai_import_status: "completed",
};

const VELOCITY = {
  stage_counts: { received: 4, deep_assessment: 2, completed: 1 },
  pitches_per_month: [
    { month: "2026-04", count: 3 },
    { month: "2026-05", count: 5 },
  ],
  conversion: {
    total_pitches: 7,
    advanced_to_assessment: 4,
    advancement_rate: 57.1,
    completed: 1,
    parked: 1,
    declined: 2,
    decline_rate: 28.6,
  },
  recent_30_days: {
    pitches_added: 3,
    meetings_logged: 5,
    assessments_created: 2,
    stage_changes: 6,
  },
};

const PIPELINE_SUMMARY = {
  total: 1,
  pitches: [
    {
      id: 1,
      title: PITCH.title,
      current_stage: "deep_assessment",
      stage_label: "Deep Assessment",
      lead: "Alexandra McConnell-Fitzwilliam",
      organisation: ORGANISATION.name,
      source: "University",
      funding_pathway: "CRC Project",
      submission_date: "2026-03-14",
      is_confidential: false,
    },
  ],
};

const USERS = [
  {
    id: "u1",
    email: "alexandra.mcconnell@rozettainstitute.example.com",
    display_name: "Alexandra McConnell-Fitzwilliam",
    role: "admin",
    is_active: true,
  },
];

const SEARCH_RESULTS = {
  total: 1,
  pitches: [
    {
      id: "p1",
      type: "pitch",
      title: PITCH.title,
      subtitle: ORGANISATION.name,
      badge: "Deep Assessment",
    },
  ],
  organisations: [],
  contacts: [],
  meetings: [],
  assessments: [],
};

const RESPONSES: Record<string, unknown> = {
  "/pitches": [PITCH],
  "/contacts": [CONTACT, SECOND_CONTACT],
  "/organisations": [ORGANISATION, OTHER_ORGANISATION],
  "/assessments": [ASSESSMENT],
  "/users/directory": DIRECTORY,
  "/meetings": [MEETING],
  "/reports/velocity": VELOCITY,
  "/reports/pipeline-summary": PIPELINE_SUMMARY,
  "/users": USERS,
  "/search": SEARCH_RESULTS,
};

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

/** Renders a page and waits for the record its fixtures put on screen. */
async function show(element: ReactElement, settled: string) {
  render(<MemoryRouter>{element}</MemoryRouter>);
  await expect.element(page.getByText(settled, { exact: false })).toBeVisible();
}

/** `commands` aim at a selector, not at an element. */
const SCROLLER = '[data-testid="table-scroll"]';

function viewportOverflow(): number {
  const root = document.documentElement;
  return root.scrollWidth - root.clientWidth;
}

const TABLE_PAGES: [name: string, element: ReactElement, settled: string][] = [
  ["Pitches", <PitchesPage />, PITCH.title],
  ["Contacts", <ContactsPage />, CONTACT.email],
  ["Organisations", <OrganisationsPage />, ORGANISATION.name],
  ["Assessments", <AssessmentsPage />, PITCH.title],
  ["Meetings", <MeetingsPage />, MEETING.title],
  ["Reports", <ReportsPage />, PITCH.title],
  ["Users", <UsersPage />, USERS[0].email],
];

describe("pages with a table, on a 360px screen", () => {
  it.each(TABLE_PAGES)(
    "%s does not overflow the viewport",
    async (_name, element, settled) => {
      await show(element, settled);

      expect(viewportOverflow()).toBeLessThanOrEqual(0);
    },
  );

  // Scrolled as a reader would, not by assigning `scrollLeft`: a clipped
  // container moves just as well from script, so only a real gesture tells the
  // two apart.
  it.each(TABLE_PAGES)(
    "%s lets a reader scroll its table sideways",
    async (_name, element, settled) => {
      await show(element, settled);
      const container = page.getByTestId("table-scroll").element();

      await commands.scrollX(SCROLLER, 200);

      await expect.poll(() => container.scrollLeft).toBeGreaterThan(0);
    },
  );
});

// The pipeline opens on the board, so its table sits behind the list toggle.
// Only the table is this ticket's business: the board itself, and the stage
// control the list needs on a touchscreen, belong to the pipeline's own slice.
describe("the pipeline list, on a 360px screen", () => {
  it("lets a reader scroll its table sideways", async () => {
    await show(<PipelinePage />, PITCH.title);
    await userEvent.click(page.getByRole("button", { name: "List" }));
    const container = page.getByTestId("table-scroll").element();
    container.id = "pipeline-table";

    await commands.scrollX("#pipeline-table", 200);

    await expect.poll(() => container.scrollLeft).toBeGreaterThan(0);
  });

  it("does not overflow the viewport", async () => {
    await show(<PipelinePage />, PITCH.title);

    await userEvent.click(page.getByRole("button", { name: "List" }));

    expect(viewportOverflow()).toBeLessThanOrEqual(0);
  });
});

// The organisation picker opens out of an editing row, and a scroll container
// clips on both axes: the page must stay narrow and the options stay tappable.
describe("editing a contact", () => {
  async function editFirstContact() {
    await show(<ContactsPage />, CONTACT.email);
    await userEvent.click(page.getByRole("button", { name: "Edit" }).first());
  }

  it("does not overflow the viewport", async () => {
    await editFirstContact();

    expect(viewportOverflow()).toBeLessThanOrEqual(0);
  });

  it("shows the organisation options in full", async () => {
    await editFirstContact();

    await userEvent.click(
      page.getByRole("combobox", { name: "Add organisation" }),
    );

    const option = page.getByRole("option", {
      name: OTHER_ORGANISATION.name,
    });
    await expect.element(option).toBeVisible();
    // What is under the finger, not merely what is in the document: a row the
    // container has clipped away is still laid out, and still has a rectangle.
    const { left, top, width, height } = option
      .element()
      .getBoundingClientRect();
    const atOption = document.elementFromPoint(
      left + width / 2,
      top + height / 2,
    );
    expect(option.element().contains(atOption)).toBe(true);
  });
});

describe("pages without a table, on a 360px screen", () => {
  it("the dashboard does not overflow the viewport", async () => {
    await show(<DashboardPage />, "Total in Pipeline");

    expect(viewportOverflow()).toBeLessThanOrEqual(0);
  });

  it("search results do not overflow the viewport", async () => {
    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    await userEvent.fill(page.getByPlaceholder(/^Search pitches/), "rangeland");
    await expect
      .element(page.getByText(PITCH.title, { exact: false }))
      .toBeVisible();

    expect(viewportOverflow()).toBeLessThanOrEqual(0);
  });
});
