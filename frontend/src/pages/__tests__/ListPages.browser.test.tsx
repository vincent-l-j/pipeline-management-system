import { commands, page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
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

const RESPONSES: Record<string, unknown> = {
  "/pitches": [PITCH],
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
