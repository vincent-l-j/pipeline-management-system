import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssessmentCreatePage from "../AssessmentCreatePage";
import { createApiMocks } from "../../test/mocks/api";
import { CRITERIA } from "../../components/assessments/AssessmentConfig";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

const mockUser = { id: "u1", display_name: "Alice Assessor", role: "assessor" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

/** Long the way real titles are long, so it cannot fit a 360px column. */
const PITCH = {
  id: "p1",
  title: "Rangeland carbon sensing from low-orbit hyperspectral imaging",
};

const SCORES = [1, 2, 3, 4, 5];

// See PitchCreatePage.browser.test.tsx: the page settles outside act().
beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

beforeEach(() => {
  apiMocks.get.mockImplementation((url: string) =>
    url === "/pitches"
      ? Promise.resolve({ data: [PITCH] })
      : Promise.reject(new Error(`no fixture for ${url}`)),
  );
});

afterEach(() => {
  cleanup();
  window.scrollTo(0, 0);
});

/** Renders the page and waits for the pitch list its select needs. */
async function showForm() {
  render(
    <MemoryRouter>
      <AssessmentCreatePage />
    </MemoryRouter>,
  );
  await expect
    .element(page.getByRole("option", { name: PITCH.title }))
    .toBeInTheDocument();
}

const scoreButton = (criterion: string, score: number) =>
  page
    .getByRole("group", { name: criterion })
    .getByRole("button", { name: String(score), exact: true });

/** The same button as a Playwright selector, so a real finger can be aimed at it. */
const scoreSelector = (criterion: string, score: number) =>
  `role=group[name="${criterion}"] >> role=button[name="${String(score)}"]`;

describe("scoring an assessment on a 360px screen", () => {
  it("runs at the width the mobile layout was designed for", () => {
    expect(window.innerWidth).toBe(360);
  });

  it("fits the viewport without scrolling sideways", async () => {
    await showForm();

    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    expect(document.body.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  });

  it.each(["Pitch *", "Assessment Date *"])(
    "gives %s a column to itself",
    async (label) => {
      await showForm();

      const field = page.getByLabelText(label).element();

      expect(field.getBoundingClientRect().width).toBeGreaterThan(
        window.innerWidth / 2,
      );
    },
  );

  it.each(CRITERIA.map((c) => c.label))(
    "gives every %s score a 44px touch target inside the screen",
    async (criterion) => {
      await showForm();

      for (const score of SCORES) {
        const { left, right, width, height } = scoreButton(criterion, score)
          .element()
          .getBoundingClientRect();

        expect(width).toBeGreaterThanOrEqual(44);
        expect(height).toBeGreaterThanOrEqual(44);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(right).toBeLessThanOrEqual(window.innerWidth);
      }
    },
  );

  it("hides the score bar, which repeats the score printed beside it", async () => {
    await showForm();
    await commands.tap(scoreSelector(CRITERIA[0].label, 4));
    await expect.element(page.getByText("4/5 — High")).toBeInTheDocument();

    const bars = page.getByTestId("score-bar").elements();

    expect(bars).toHaveLength(CRITERIA.length);
    for (const bar of bars) expect(bar.checkVisibility()).toBe(false);
  });

  it("submits every criterion, a declining recommendation and its reason by touch", async () => {
    apiMocks.post.mockResolvedValue({ data: { id: "a1" } });
    await showForm();

    await userEvent.selectOptions(page.getByLabelText("Pitch *"), PITCH.id);
    for (const [i, c] of CRITERIA.entries()) {
      await commands.tap(scoreSelector(c.label, (i % 5) + 1));
    }
    await commands.tap('button:text-is("Decline")');
    await userEvent.selectOptions(
      page.getByLabelText("Reason for declining"),
      "insufficient_scale",
    );
    await userEvent.fill(
      page.getByPlaceholder("Explain the reasoning"),
      "Too small to move the needle nationally.",
    );
    await commands.tap('button[type="submit"]');

    await expect
      .poll(() => apiMocks.post.mock.mock.calls.length)
      .toBeGreaterThan(0);
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/assessments",
      expect.objectContaining({
        pitch_id: PITCH.id,
        national_impact: 1,
        translation_readiness: 2,
        team_capability: 3,
        ecosystem_fit: 4,
        funding_pathway_clarity: 5,
        masterplan_alignment: 1,
        recommendation: "decline",
        decline_reason: "insufficient_scale",
        rationale: "Too small to move the needle nationally.",
      }),
    );
  });

  it("keeps the decline reason select inside the screen", async () => {
    await showForm();
    await commands.tap('button:text-is("Decline")');

    const { left, right } = page
      .getByLabelText("Reason for declining")
      .element()
      .getBoundingClientRect();

    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(window.innerWidth);
  });
});
