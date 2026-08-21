import { describe, it, expect } from "vitest";
import {
  PIPELINE_STAGES,
  STAGE_MAP,
  SOURCE_LABELS,
  FUNDING_LABELS,
  REQUEST_TYPE_LABELS,
  SOURCE_OPTIONS,
  FUNDING_OPTIONS,
  REQUEST_TYPE_OPTIONS,
} from "../PipelineConfig";

describe("PIPELINE_STAGES", () => {
  // Pins the count, the order and the uniqueness of the keys in one assertion.
  it("defines the expected ordered set of stages", () => {
    expect(PIPELINE_STAGES.map((s) => s.key)).toEqual([
      "received",
      "initial_screen",
      "discovery_meeting",
      "deep_assessment",
      "due_diligence",
      "decision_pending",
      "active_support",
      "parked",
      "declined",
      "completed",
    ]);
  });

  // The types already guarantee these fields exist and are strings; what this
  // adds is that none of them is blank, which would render an empty badge.
  it.each(PIPELINE_STAGES.map((stage) => [stage.key, stage] as const))(
    "%s has a non-empty label, color and lightColor",
    (_key, stage) => {
      expect(stage.label).toBeTruthy();
      expect(stage.color).toBeTruthy();
      expect(stage.lightColor).toBeTruthy();
    },
  );
});

describe("STAGE_MAP", () => {
  it("is keyed by stage key, with no extra or missing entries", () => {
    expect(Object.keys(STAGE_MAP).sort()).toEqual(
      PIPELINE_STAGES.map((s) => s.key).sort(),
    );
  });

  it.each(PIPELINE_STAGES.map((stage) => [stage.key, stage] as const))(
    "%s looks up the stage object itself",
    (key, stage) => {
      expect(STAGE_MAP[key]).toBe(stage);
    },
  );
});

/*
 * The label maps are the frontend's copy of two backend enums, so these use
 * toEqual rather than toMatchObject: a subset match cannot fail when a value is
 * added, which is the drift worth catching. An unlabelled value falls back to
 * the raw enum key in the UI, e.g. "riac_student".
 */
describe("label maps", () => {
  it("labels exactly the sources PitchSource can return", () => {
    // Mirrors PitchSource in backend/app/models/pitch.py.
    expect(SOURCE_LABELS).toEqual({
      referral: "Referral",
      website: "Website",
      event: "Event",
      cold_outreach: "Cold Outreach",
      internal: "Internal",
      riac: "RIAC",
      foundry: "Foundry",
      board: "Board",
      riac_student: "RIAC Student",
      rozetta_network: "Rozetta Network",
    });
  });

  it("labels exactly the pathways FundingPathway can return", () => {
    // Mirrors FundingPathway in backend/app/models/pitch.py.
    expect(FUNDING_LABELS).toEqual({
      crc_bid: "CRC Bid",
      rdti: "RDTI",
      philanthropic: "Philanthropic",
      government_grant: "Government Grant",
      private: "Private",
      other: "Other",
      no_funding_identified: "No Funding Identified",
      internal_funding: "Internal Funding",
    });
  });

  it("labels exactly the requests RequestType can return", () => {
    // Mirrors RequestType in backend/app/models/pitch.py.
    expect(REQUEST_TYPE_LABELS).toEqual({
      advise: "Advise",
      convene: "Convene",
      sponsored_research: "Sponsored Research",
      thought_leadership: "Thought Leadership",
      catalyse: "Catalyse",
      direct_investment: "Direct Investment",
      other: "Other",
    });
  });
});

/*
 * The options are derived from the maps above, so pinning the transform is
 * enough — the vocabulary itself is already pinned against a literal, and
 * spot-checking individual options here would only restate that.
 */
describe.each([
  ["SOURCE_OPTIONS", SOURCE_LABELS, SOURCE_OPTIONS],
  ["FUNDING_OPTIONS", FUNDING_LABELS, FUNDING_OPTIONS],
  ["REQUEST_TYPE_OPTIONS", REQUEST_TYPE_LABELS, REQUEST_TYPE_OPTIONS],
])("%s", (_name, labels, options) => {
  it("derives one option per label, in map order", () => {
    expect(options).toEqual(
      Object.entries(labels).map(([value, label]) => ({ value, label })),
    );
  });
});
