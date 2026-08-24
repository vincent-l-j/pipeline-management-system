import { render, screen } from "@testing-library/react";
import PipelineListView from "../PipelineListView";

vi.mock(
  "react-router-dom",
  async (importOriginal: () => Promise<typeof import("react-router-dom")>) => {
    const mod = await importOriginal();
    return { ...mod, useNavigate: () => vi.fn() };
  },
);

describe("PipelineListView", () => {
  it("renders empty state when no pitches", () => {
    render(<PipelineListView pitches={[]} />);
    expect(screen.getByText(/No pitches/i)).toBeInTheDocument();
  });

  const DECLINED = {
    id: "p1",
    title: "Declined Pitch",
    current_stage: "declined",
    decline_reason: "grant_funding_rejected",
  };

  it("shows the decline reason beneath the stage badge", () => {
    render(<PipelineListView pitches={[DECLINED as never]} />);
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("Grant funding rejected")).toBeInTheDocument();
  });

  it("adds no extra column, which would be blank on undeclined rows", () => {
    render(<PipelineListView pitches={[DECLINED as never]} />);
    // The reason sits inside the Stage cell rather than a seventh header.
    expect(
      screen.getByRole("columnheader", { name: /Stage/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /Reason/i }),
    ).not.toBeInTheDocument();
  });

  it("marks nothing on a pitch with no decline reason", () => {
    render(
      <PipelineListView
        pitches={[{ id: "p2", title: "Open Pitch", current_stage: "received" }]}
      />,
    );
    expect(
      screen.queryByText("Grant funding rejected"),
    ).not.toBeInTheDocument();
  });
});
