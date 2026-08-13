import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PipelineFilters from "../PipelineFilters";

// Stages and sources are stubbed; DOMAIN_OPTIONS stays real so the domain
// assertion below checks the shipped vocabulary rather than a fixture.
vi.mock("../PipelineConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../PipelineConfig")>()),
  PIPELINE_STAGES: [
    { key: "received", label: "Received", color: "bg-blue-400" },
    { key: "submitted", label: "Submitted", color: "bg-green-400" },
  ],
  SOURCE_LABELS: { partner: "Partner", internal: "Internal" },
  FUNDING_LABELS: {},
}));

describe("PipelineFilters", () => {
  it("renders filter controls", () => {
    const onChange = vi.fn();
    render(
      <PipelineFilters
        filters={{ sort: "newest" }}
        onChange={onChange}
        users={[]}
      />,
    );

    expect(screen.getByDisplayValue("All stages")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All sources")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All domains")).toBeInTheDocument();
  });

  it("lists exactly the current domains, and none of the retired ones", () => {
    render(
      <PipelineFilters
        filters={{ sort: "newest" }}
        onChange={vi.fn()}
        users={[]}
      />,
    );

    const domainSelect = screen.getByDisplayValue("All domains");
    const options = Array.from(domainSelect.querySelectorAll("option")).map(
      (o) => o.textContent,
    );

    expect(options).toEqual([
      "All domains",
      "AI",
      "Energy Transition",
      "Digital Finance",
      "Critical Minerals",
      "Semiconductors",
      "Health",
      "Innovation system",
      "Other",
    ]);
  });

  it("calls onChange when stage filter changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PipelineFilters
        filters={{ sort: "newest" }}
        onChange={onChange}
        users={[]}
      />,
    );

    const stageSelect = screen.getByDisplayValue("All stages");
    await user.selectOptions(stageSelect, "received");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "received" }),
    );
  });
});
