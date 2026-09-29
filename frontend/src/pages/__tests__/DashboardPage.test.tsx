import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import DashboardPage from "../DashboardPage";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn() },
}));

const apiMocks = createApiMocks();

vi.mock("../../components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Counts are deliberately all different: each one is asserted by its own text,
// and a repeat would match the wrong tile.
const VELOCITY = {
  stage_counts: { received: 4, deep_assessment: 2, completed: 1 },
  pitches_per_month: [
    { month: "2026-08", count: 3 },
    { month: "2026-09", count: 7 },
  ],
  conversion: {
    total_pitches: 20,
    advanced_to_assessment: 9,
    advancement_rate: 45,
    completed: 1,
    parked: 5,
    declined: 6,
    decline_rate: 30,
  },
  recent_30_days: {
    pitches_added: 11,
    meetings_logged: 12,
    assessments_created: 13,
    stage_changes: 14,
  },
};

/**
 * The card a heading sits in. Numbers repeat across the dashboard — the derived
 * total equals a month's count, and "Declined" is both a stat tile and a stage —
 * so an unscoped query matches the wrong one.
 */
function cardFor(heading: string): HTMLElement {
  const card = screen.getByText(heading).closest("div");
  if (!card) throw new Error(`no card around "${heading}"`);
  return card;
}

beforeEach(() => {
  apiMocks.get.mockResolvedValue({ data: VELOCITY });
});

describe("DashboardPage", () => {
  it("says it is loading before the report arrives", () => {
    // A request that never settles, which is what "still loading" is.
    apiMocks.get.mockReturnValue(new Promise(() => undefined));

    render(<DashboardPage />);

    expect(screen.getByText(/Loading dashboard/)).toBeInTheDocument();
  });

  it("reports a failure rather than an empty dashboard", async () => {
    apiMocks.get.mockRejectedValue(new Error("boom"));

    render(<DashboardPage />);

    expect(
      await screen.findByText("Unable to load dashboard data"),
    ).toBeInTheDocument();
  });

  // The total is derived, not served: the endpoint sends the stage counts and
  // the page adds them up, so a stage left out of the sum would go unnoticed.
  it("totals the pipeline from every stage count", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText("Total in Pipeline")).toBeInTheDocument();
    expect(
      within(cardFor("Total in Pipeline")).getByText("7"),
    ).toBeInTheDocument();
  });

  it("shows the conversion figures the report carries", async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByText("Advanced to Assessment"),
    ).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("45% of total")).toBeInTheDocument();
    expect(screen.getByText("30% of total")).toBeInTheDocument();
  });

  // Every stage, not only the ones the report mentioned: a stage with no pitches
  // still has to hold its place, or the breakdown silently shortens.
  it("lists every pipeline stage, zeroing the ones with no pitches", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText("Deep Assessment")).toBeInTheDocument();
    const stages = within(cardFor("Pipeline by Stage"));
    for (const stage of [
      "Received",
      "Initial Screen",
      "Discovery",
      "Due Diligence",
      "Decision Pending",
      "Active Support",
      "Parked",
      "Declined",
      "Completed",
    ]) {
      expect(stages.getByText(stage)).toBeInTheDocument();
    }
    // Seven of the ten carry no count in the fixture.
    expect(stages.getAllByText("0")).toHaveLength(7);
  });

  it("shows a count for each month the report returned", async () => {
    render(<DashboardPage />);
    await screen.findByText("Pitches Received per Month");

    const chart = within(cardFor("Pitches Received per Month"));
    expect(chart.getByText("3")).toBeInTheDocument();
    expect(chart.getByText("7")).toBeInTheDocument();
  });

  it("says so when there is nothing to chart yet", async () => {
    apiMocks.get.mockResolvedValue({
      data: { ...VELOCITY, pitches_per_month: [] },
    });

    render(<DashboardPage />);

    expect(await screen.findByText(/No data yet/)).toBeInTheDocument();
  });

  it("shows the last 30 days of activity", async () => {
    render(<DashboardPage />);

    expect(await screen.findByText("New pitches added")).toBeInTheDocument();
    for (const [label, value] of [
      ["New pitches added", "11"],
      ["Meetings logged", "12"],
      ["Assessments created", "13"],
      ["Stage transitions", "14"],
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });
});
