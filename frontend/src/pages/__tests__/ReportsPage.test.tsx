import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ReportsPage from "../ReportsPage";
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

function summaryRow(id: number, title: string, stage: string, label: string) {
  return {
    id,
    title,
    current_stage: stage,
    stage_label: label,
    lead: null,
    organisation: null,
    source: null,
    funding_pathway: null,
    submission_date: null,
    is_confidential: false,
  };
}

const SUMMARY = {
  total: 3,
  pitches: [
    summaryRow(1, "Left in Received", "received", "Received"),
    summaryRow(2, "Being screened", "initial_screen", "Initial Screen"),
    summaryRow(3, "Mid assessment", "deep_assessment", "Deep Assessment"),
  ],
};

const VELOCITY = {
  conversion: {
    total_pitches: 2,
    advanced_to_assessment: 0,
    advancement_rate: 0,
    completed: 0,
    parked: 0,
    declined: 0,
    decline_rate: 0,
  },
};

beforeEach(() => {
  apiMocks.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url === "/reports/velocity" ? VELOCITY : SUMMARY,
    }),
  );
});

describe("ReportsPage and retired stages", () => {
  it("never offers a retired stage as a filter, even while a pitch is in it", async () => {
    render(<ReportsPage />);

    const filter = await screen.findByDisplayValue("All stages (3)");
    const options = Array.from(filter.querySelectorAll("option")).map(
      (o) => o.textContent,
    );

    expect(options).toContain("Initial Screen (1)");
    expect(options.some((o) => o.startsWith("Received"))).toBe(false);
    expect(options.some((o) => o.startsWith("Deep Assessment"))).toBe(false);
  });

  it("still lists pitches in retired stages, with their labels, under all stages", async () => {
    render(<ReportsPage />);

    expect(await screen.findByText("Left in Received")).toBeInTheDocument();
    expect(screen.getByText("Mid assessment")).toBeInTheDocument();
    expect(
      screen.getByText("Deep Assessment", { selector: "span" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Received", { selector: "span" }),
    ).toBeInTheDocument();
  });
});
