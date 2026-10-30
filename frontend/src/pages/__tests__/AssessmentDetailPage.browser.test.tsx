import { page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentDetailPage from "../AssessmentDetailPage";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

const mockUser = { id: "u1", display_name: "Alice Assessor", role: "assessor" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

const ASSESSOR = {
  id: "u1",
  display_name: "Alexandra McConnell-Fitzwilliam",
};

/** The longest reason, beside a recommendation badge, so the header is crowded. */
const ASSESSMENT = {
  id: "a1",
  pitch_id: "p1",
  assessor_id: ASSESSOR.id,
  assessment_date: "2026-01-15",
  version: 12,
  recommendation: "decline",
  decline_reason: "insufficient_capacity_capability",
  rationale: "The team is two people.",
  national_impact: 5,
  translation_readiness: 4,
  team_capability: 1,
  ecosystem_fit: 3,
  funding_pathway_clarity: 2,
  masterplan_alignment: 5,
};

const RESPONSES: Record<string, unknown> = {
  "/assessments/a1": ASSESSMENT,
  "/users/directory": [ASSESSOR],
  "/pitches/p1": {
    id: "p1",
    title: "Rangeland carbon sensing from low-orbit hyperspectral imaging",
    short_description: "Soil carbon measured from the air.",
    current_stage: "initial_review",
  },
  "/pitches/p1/assessments": [ASSESSMENT],
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

async function showAssessment() {
  render(
    <MemoryRouter initialEntries={["/assessments/a1"]}>
      <Routes>
        <Route
          path="/assessments/:assessmentId"
          element={<AssessmentDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
  await expect
    .element(page.getByRole("heading", { name: "Assessment v12" }))
    .toBeInTheDocument();
}

/** Every text a reader of the card needs, each of which must be in view. */
const CARD_TEXTS = [
  "Assessment v12",
  "Decline",
  "Insufficient capacity or capability",
  "3.3",
  "5/5 — Very High",
  "1/5 — Very Low",
];

/**
 * The card clips its overflow, so text pushed past its edge is cut off while
 * the page itself still fits: the card, not the viewport, is the edge to test.
 */
function scoringCard(): HTMLElement {
  const card = page
    .getByRole("heading", { name: "Assessment v12" })
    .element()
    .closest<HTMLElement>(".rounded-xl");
  if (!card) throw new Error("scoring card not found");
  return card;
}

describe("reading an assessment on a 360px screen", () => {
  it("runs at the width the mobile layout was designed for", () => {
    expect(window.innerWidth).toBe(360);
  });

  it("fits the viewport without scrolling sideways", async () => {
    await showAssessment();

    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    expect(document.body.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  });

  it.each(CARD_TEXTS)("keeps %s inside the scoring card", async (text) => {
    await showAssessment();
    const card = scoringCard().getBoundingClientRect();

    const { left, right } = page
      .getByText(text, { exact: true })
      .first()
      .element()
      .getBoundingClientRect();

    expect(left).toBeGreaterThanOrEqual(card.left);
    expect(right).toBeLessThanOrEqual(card.right);
  });
});
