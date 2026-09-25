import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import ContactsPage from "../ContactsPage";
import PitchesPage from "../PitchesPage";
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

const RESPONSES: Record<string, unknown> = {
  "/pitches": [PITCH],
  "/contacts": [CONTACT, SECOND_CONTACT],
  "/organisations": [ORGANISATION, OTHER_ORGANISATION],
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
