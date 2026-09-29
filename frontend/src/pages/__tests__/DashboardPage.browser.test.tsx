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

// Twelve, because that is what /api/reports/velocity returns; the count is what
// squeezes the labels, and a short series fits any width and proves nothing.
const TWELVE_MONTHS = [
  "2025-10",
  "2025-11",
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
].map((month, i) => ({ month, count: (i % 5) + 1 }));

/** Renders the dashboard over a full year and hands back the chart's card. */
async function chartCard(): Promise<HTMLElement> {
  apiMocks.get.mockImplementation((url: string) =>
    url === "/reports/velocity"
      ? Promise.resolve({
          data: { ...VELOCITY, pitches_per_month: TWELVE_MONTHS },
        })
      : Promise.resolve({ data: [] }),
  );
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
  await expect.element(page.getByText("Total in Pipeline")).toBeVisible();
  const card = page
    .getByText("Pitches Received per Month")
    .element()
    .closest("div");
  if (!card) throw new Error("the chart heading has no card around it");
  return card;
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

// The page-level viewport check in ListPages.browser.test.tsx catches the page
// being pushed wide, but a card can be overrun without that happening, so the
// chart is measured against its own card: flex items default to
// `min-width: auto`, and a nowrap label sets a floor `flex-1` cannot shrink
// past, which the row then takes out of the card.
describe("the chart's month labels", () => {
  it("stay inside the card, and clear of each other", async () => {
    const card = await chartCard();
    const bounds = card.getBoundingClientRect();

    const labels = [...card.querySelectorAll("[data-testid='month-label']")];

    // Asserted before the geometry: a card with no labels in it would satisfy
    // every bound below, and an unreadable month is not a fix.
    expect(labels).toHaveLength(TWELVE_MONTHS.length);
    const boxes = labels.map((label) => {
      expect(label.textContent.trim()).not.toBe("");
      return label.getBoundingClientRect();
    });
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(bounds.left);
      expect(box.right).toBeLessThanOrEqual(bounds.right);
    }
    // Fitting the card is not enough to be readable: labels too wide for their
    // own column stay inside the card by running into each other instead.
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].right);
    }
  });

  it("give up their year to the card, which carries it instead", async () => {
    await chartCard();

    await expect.element(page.getByText("Oct 2025 – Sep 2026")).toBeVisible();
  });
});
