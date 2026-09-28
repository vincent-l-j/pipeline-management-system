import { page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "../DashboardPage";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", display_name: "Alice Admin", role: "admin" },
    logout: vi.fn(),
  }),
}));

const VELOCITY = {
  stage_counts: { received: 4, deep_assessment: 2, completed: 1 },
  pitches_per_month: [],
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

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(() => {
  cleanup();
});

/** Renders the dashboard over one month series and hands back the bar heights. */
async function barHeights(counts: number[]): Promise<number[]> {
  apiMocks.get.mockImplementation((url: string) =>
    url === "/reports/velocity"
      ? Promise.resolve({
          data: {
            ...VELOCITY,
            pitches_per_month: counts.map((count, i) => ({
              month: `2026-${String(i + 1).padStart(2, "0")}`,
              count,
            })),
          },
        })
      : Promise.resolve({ data: [] }),
  );
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
  await expect.element(page.getByText("Total in Pipeline")).toBeVisible();
  return [...document.querySelectorAll("[data-testid='month-bar']")].map(
    (bar) => bar.getBoundingClientRect().height,
  );
}

// Measured in pixels rather than read off the style attribute. The bars are
// sized in per cent, and a per cent of a box with no definite height resolves
// to nothing — so the markup read as though it had heights while every bar drew
// at zero, and only the rendered box tells the two apart.
describe("the pitches-per-month chart", () => {
  it("draws a bar for a month that has pitches", async () => {
    const [drawn] = await barHeights([1]);

    expect(drawn).toBeGreaterThan(0);
  });

  it("draws bars in proportion to their counts", async () => {
    const [one, two] = await barHeights([1, 2]);

    // The point of a bar chart, and the part that survived the first fix: with
    // the count and the label sharing the bar's box, the taller bar was shrunk
    // to fit around them and drew 1.5x the shorter rather than twice it.
    expect(two).toBeCloseTo(one * 2, 0);
  });

  it("draws nothing for a month without pitches", async () => {
    const [empty, drawn] = await barHeights([0, 1]);

    // A stub the eye can see is the chart claiming activity the pipeline did
    // not have — and since the window is generated, most of it can be zeros.
    expect(empty).toBe(0);
    expect(drawn).toBeGreaterThan(0);
  });
});
