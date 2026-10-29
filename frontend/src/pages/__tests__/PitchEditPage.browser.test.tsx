import { commands, page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PitchEditPage from "../PitchEditPage";
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

const RESPONSES: Record<string, unknown> = {
  "/pitches/42": {
    id: "42",
    title: "Rangeland carbon sensing",
    short_description: "Soil carbon measured from the air.",
    submission_date: "2026-01-01",
    source: null,
    request_type: null,
    funding_pathway: null,
    domain_tags: "Health",
    masterplan_alignment: null,
    next_step: null,
    is_confidential: false,
    organisation_id: null,
    lead_id: LEAD.id,
    contact_ids: [],
  },
  "/organisations": [],
  "/contacts": [],
  "/users/directory": [LEAD],
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

afterEach(async () => {
  cleanup();
  await commands.emulateMedia("screen");
  window.scrollTo(0, 0);
});

/** Renders the page and waits for the pitch to fill the form. */
async function showForm() {
  render(
    <MemoryRouter initialEntries={["/pitches/42/edit"]}>
      <Routes>
        <Route path="/pitches/:pitchId/edit" element={<PitchEditPage />} />
        <Route path="/pitches/:pitchId" element={<p>Pitch detail</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await expect
    .element(page.getByLabelText("Title *"))
    .toHaveValue("Rangeland carbon sensing");
}

const saveButton = () => page.getByRole("button", { name: "Save Changes" });

describe("editing a pitch on a 360px screen", () => {
  it("runs at the width the mobile layout was designed for", () => {
    expect(window.innerWidth).toBe(360);
  });

  it("shows the save action before the form has been scrolled at all", async () => {
    await showForm();
    expect(document.documentElement.scrollHeight).toBeGreaterThan(
      window.innerHeight,
    );

    const { top, bottom } = saveButton().element().getBoundingClientRect();

    expect(window.scrollY).toBe(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  it("saves the edit by touch from the first screen", async () => {
    apiMocks.patch.mockResolvedValue({ data: {} });
    await showForm();

    await commands.tap('button[type="submit"]');

    await expect
      .poll(() => apiMocks.patch.mock.mock.calls.length)
      .toBeGreaterThan(0);
    expect(apiMocks.patch.mock).toHaveBeenCalledWith(
      "/pitches/42",
      expect.objectContaining({ title: "Rangeland carbon sensing" }),
    );
  });

  it("does not print the save bar", async () => {
    await showForm();
    const bar = page.getByTestId("save-bar").element();

    await commands.emulateMedia("print");

    expect(bar.checkVisibility()).toBe(false);
  });
});
