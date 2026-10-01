import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PitchCreatePage from "../PitchCreatePage";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

const mockUser = { id: "u1", display_name: "Alice Assessor", role: "assessor" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

const LEAD = { id: "u1", display_name: "Alexandra McConnell-Fitzwilliam" };

/** Long the way real records are long, so nothing fits a 360px column. */
const ORGANISATION_NAME = "Wintergreen Innovation Partners (Australia) Limited";
const CONTACT_LABEL =
  "Bartholomew Wintergreen-Fitzwilliam (bartholomew.wintergreen@example.com)";

const RESPONSES: Record<string, unknown> = {
  "/organisations": [
    {
      id: "o1",
      name: ORGANISATION_NAME,
      org_type: "university",
      sector: null,
      state_territory: "NSW",
      website: null,
      abn: null,
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
  "/contacts": [
    {
      id: "c1",
      first_name: "Bartholomew",
      last_name: "Wintergreen-Fitzwilliam",
      email: "bartholomew.wintergreen@example.com",
      organisation_ids: ["o1"],
    },
  ],
  "/users/directory": [LEAD],
};

/** The chips carry no id, so a tap is aimed with Playwright's text engine. */
const domainChip = (domain: string) => `button:text-is("${domain}")`;

// Registered after React Testing Library's own act-environment beforeAll, so
// this wins: the page settles outside act(), and that is the rendering a user
// actually gets.
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

afterEach(async () => {
  cleanup();
  // Media emulation outlives the test that set it; the page is file-wide.
  await commands.emulateMedia("screen");
  window.scrollTo(0, 0);
});

/** Renders the page and waits for the lookups its pickers need. */
async function showForm() {
  render(
    <MemoryRouter>
      <PitchCreatePage />
    </MemoryRouter>,
  );
  await expect.element(page.getByText(LEAD.display_name)).toBeInTheDocument();
}

const saveButton = () => page.getByRole("button", { name: "Add Pitch" });

/** Taps by accessible name: the row is found as a user finds it, then touched. */
async function tapOption(name: string) {
  await commands.tap(`#${page.getByRole("option", { name }).element().id}`);
}

describe("creating a pitch on a 360px screen", () => {
  // Guards the file: at the wrong width everything below passes vacuously.
  it("runs at the width the mobile layout was designed for", () => {
    expect(window.innerWidth).toBe(360);
  });

  it("fits the viewport without scrolling sideways", async () => {
    await showForm();

    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  });

  // The whole point of the pinned bar: the form is several screens long, and
  // the save action has to be there from the first screen.
  it("shows the save action before the form has been scrolled at all", async () => {
    await showForm();
    // Without a form taller than the screen there is nothing to pin.
    expect(document.documentElement.scrollHeight).toBeGreaterThan(
      window.innerHeight,
    );

    const { top, bottom } = saveButton().element().getBoundingClientRect();

    expect(window.scrollY).toBe(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  // Pinned over blank form, "on top" would mean nothing, so this parks a field
  // where the bar is and asks what a finger in the overlap would land on.
  it("covers the fields it is pinned over", async () => {
    await showForm();
    // Below the fold, or it cannot be scrolled down to where the bar sits, and
    // not the last field, or the page bottoms out and the bar stops pinning.
    const field = page.getByLabelText("Masterplan Alignment").element();
    field.scrollIntoView({ block: "end" });
    const bar = page.getByTestId("save-bar").element();

    const over = bar.getBoundingClientRect();
    const under = field.getBoundingClientRect();
    const top = Math.max(over.top, under.top);
    const bottom = Math.min(over.bottom, under.bottom);
    expect(bottom).toBeGreaterThan(top);

    const inTheOverlap = document.elementFromPoint(
      under.left + under.width / 2,
      (top + bottom) / 2,
    );

    expect(bar.contains(inTheOverlap)).toBe(true);
  });

  // The bar is only worth having if the button in it still saves. Driven by a
  // finger the whole way, because a mouse would pass where a finger fails.
  it("creates a pitch end to end by touch", async () => {
    apiMocks.post.mockResolvedValue({ data: { id: "new-pitch" } });
    await showForm();

    await userEvent.fill(
      page.getByLabelText("Title *"),
      "Rangeland carbon sensing",
    );
    await commands.tap("#pitch-organisation");
    await tapOption(ORGANISATION_NAME);
    await commands.tap("#pitch-contacts");
    await tapOption(CONTACT_LABEL);
    await commands.tap(domainChip("Health"));

    await commands.tap('button[type="submit"]');

    await expect
      .poll(() => apiMocks.post.mock.mock.calls.length)
      .toBeGreaterThan(0);
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/pitches",
      expect.objectContaining({
        title: "Rangeland carbon sensing",
        organisation_id: "o1",
        contact_ids: ["c1"],
        domain_tags: "Health",
      }),
    );
  });

  // On paper the bar is a rule and a grey band around two hidden buttons.
  it("does not print the save bar", async () => {
    await showForm();
    const bar = page.getByTestId("save-bar").element();

    await commands.emulateMedia("print");

    expect(bar.checkVisibility()).toBe(false);
  });
});
