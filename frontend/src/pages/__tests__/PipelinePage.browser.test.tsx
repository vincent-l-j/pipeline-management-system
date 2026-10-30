import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PipelinePage from "../PipelinePage";
import { AuthProvider } from "../../contexts/AuthContext";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const apiMocks = createApiMocks();

const PITCH = {
  id: "p1",
  title: "Autonomous Remote Sensing for Rangeland Carbon Accounting",
  short_description: "A long-running collaboration with three universities",
  source: "referral",
  funding_pathway: "crc_project",
  domain_tags: "agriculture, remote sensing, carbon",
  current_stage: "due_diligence",
  stage_entered_at: "2026-03-14T00:00:00Z",
  submission_date: "2026-03-14",
  lead_id: "u1",
};

const PITCHES = [
  PITCH,
  {
    ...PITCH,
    id: "p2",
    title: "Low-Cost Soil Moisture Telemetry for Smallholder Irrigation",
    current_stage: "initial_screen",
  },
];

/** Closed long enough ago to be hidden, which puts the show/hide toggle up. */
const LONG_DECLINED = {
  ...PITCH,
  id: "p3",
  title: "Declined Years Ago",
  current_stage: "declined",
  stage_entered_at: "2020-01-01T00:00:00Z",
};

const DIRECTORY = [
  { id: "u1", display_name: "Alexandra McConnell-Fitzwilliam" },
];

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

beforeEach(() => {
  localStorage.setItem("token", "t");
  localStorage.setItem(
    "user",
    JSON.stringify({ id: "u1", role: "admin", display_name: "Admin" }),
  );
  apiMocks.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url === "/pitches" ? [...PITCHES, LONG_DECLINED] : DIRECTORY,
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function showPipeline() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <PipelinePage />
      </AuthProvider>
    </MemoryRouter>,
  );
  await expect.element(page.getByText(PITCH.title)).toBeVisible();
}

describe("the pipeline on a 360px screen", () => {
  it("runs below the md breakpoint", () => {
    expect(window.innerWidth).toBeLessThan(768);
  });

  it("opens on the list", async () => {
    await showPipeline();

    await expect.element(page.getByRole("table")).toBeVisible();
  });

  it("gives every row's stage a control a finger can hit", async () => {
    await showPipeline();

    const controls = page.getByRole("combobox", { name: /^Stage of / }).all();
    expect(controls).toHaveLength(PITCHES.length);
    for (const control of controls) {
      expectTappable(control.element());
    }
  });

  it("keeps every filter, sort and view control on screen and tappable", async () => {
    await showPipeline();
    // A set filter is what offers "Clear filters".
    const sources = page
      .getByRole("combobox")
      .elements()
      .find((e) => e.textContent.includes("All sources"));
    if (!sources) throw new Error("no source filter");
    await userEvent.selectOptions(sources, "referral");

    const stageControls = new Set(
      page
        .getByRole("combobox", { name: /^Stage of / })
        .elements()
        .map((e) => e as Element),
    );
    const controls = [
      ...page
        .getByRole("combobox")
        .elements()
        .filter((e) => !stageControls.has(e)),
      page.getByRole("link", { name: "New Pitch" }).element(),
      page.getByRole("button", { name: "Board" }).element(),
      page.getByRole("button", { name: "List" }).element(),
      page.getByRole("button", { name: "Clear filters" }).element(),
      page.getByRole("button", { name: "Show old pitches" }).element(),
    ];
    // Five filter and sort selects, then the five buttons and links.
    expect(controls).toHaveLength(10);
    for (const control of controls) {
      const { left, right } = control.getBoundingClientRect();
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(window.innerWidth);
      expectTappable(control);
    }
  });

  it("does not overflow the viewport", async () => {
    await showPipeline();

    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  });
});

/**
 * Tall enough for a finger, and the topmost thing at its own centre once
 * scrolled to — `elementFromPoint` sees only what is inside the viewport.
 */
function expectTappable(control: Element) {
  control.scrollIntoView({ block: "center", inline: "nearest" });
  const { left, top, width, height } = control.getBoundingClientRect();
  expect(height).toBeGreaterThanOrEqual(44);
  const hit = document.elementFromPoint(left + width / 2, top + height / 2);
  expect(control === hit || control.contains(hit)).toBe(true);
}
