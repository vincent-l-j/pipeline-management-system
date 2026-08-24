import { describe, it, expect } from "vitest";
import {
  CRITERIA,
  SCORE_LABELS,
  RECOMMENDATION_OPTIONS,
  DECLINE_REASON_LABELS,
  DECLINE_REASON_OPTIONS,
} from "../AssessmentConfig";

describe("AssessmentConfig", () => {
  // The types already guarantee these fields exist and are strings; what this
  // adds is that none of them is blank, which would render an empty control.
  it.each(CRITERIA.map((c) => [c.key, c] as const))(
    "%s has a non-empty label and description",
    (_key, criterion) => {
      expect(criterion.label).toBeTruthy();
      expect(criterion.description).toBeTruthy();
    },
  );

  // Pins the count, the order and the uniqueness of the keys in one assertion.
  it("defines exactly the six scoring criteria, in order", () => {
    expect(CRITERIA.map((c) => c.key)).toEqual([
      "national_impact",
      "translation_readiness",
      "team_capability",
      "ecosystem_fit",
      "funding_pathway_clarity",
      "masterplan_alignment",
    ]);
  });

  it("maps scores 1–5 to ascending labels", () => {
    expect(SCORE_LABELS).toEqual({
      1: "Very Low",
      2: "Low",
      3: "Moderate",
      4: "High",
      5: "Very High",
    });
  });

  it("defines proceed, park, and decline recommendations", () => {
    expect(RECOMMENDATION_OPTIONS.map((o) => o.value)).toEqual([
      "proceed",
      "park",
      "decline",
    ]);
  });

  it.each(RECOMMENDATION_OPTIONS.map((o) => [o.value, o] as const))(
    "%s has a non-empty label and color",
    (_value, option) => {
      expect(option.label).toBeTruthy();
      expect(option.color).toBeTruthy();
    },
  );

  it("labels every decline reason the backend can return", () => {
    // Mirrors DeclineReason in backend/app/models/assessment.py.
    expect(Object.keys(DECLINE_REASON_LABELS)).toEqual([
      "not_strategic_priority",
      "insufficient_scale",
      "insufficient_capacity_capability",
      "grant_funding_rejected",
      "lack_of_rozetta_capacity",
      "other",
    ]);
  });

  it("derives a reason option for every label, in the same order", () => {
    expect(DECLINE_REASON_OPTIONS).toEqual(
      Object.entries(DECLINE_REASON_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    );
  });
});
