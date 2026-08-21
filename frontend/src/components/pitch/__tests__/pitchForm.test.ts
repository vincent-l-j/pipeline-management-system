import { describe, it, expect } from "vitest";
import {
  EMPTY_PITCH_FORM,
  newPitchForm,
  pitchFormFromApi,
  pitchPayload,
} from "../pitchForm";

describe("newPitchForm", () => {
  it("starts blank apart from today's submission date", () => {
    const form = newPitchForm();
    expect(form).toEqual({
      ...EMPTY_PITCH_FORM,
      submission_date: form.submission_date,
    });
    expect(form.submission_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a fresh object each call so one form cannot mutate another", () => {
    const a = newPitchForm();
    const b = newPitchForm();
    a.domain_tags.push("AI");
    a.contact_ids.push("c1");
    expect(b.domain_tags).toEqual([]);
    expect(b.contact_ids).toEqual([]);
  });
});

describe("pitchFormFromApi", () => {
  it("fills every field from the pitch", () => {
    expect(
      pitchFormFromApi({
        title: "Soil Sensors",
        short_description: "A summary",
        submission_date: "2026-01-01",
        source: "referral",
        request_type: "sponsored_research",
        funding_pathway: "rdti",
        domain_tags: "AI,Health",
        masterplan_alignment: "Aligned",
        next_step: "Call the CSIRO lead",
        is_confidential: true,
        organisation_id: "org-1",
        lead_id: "user-1",
        contact_ids: ["c1", "c2"],
      }),
    ).toEqual({
      title: "Soil Sensors",
      short_description: "A summary",
      submission_date: "2026-01-01",
      source: "referral",
      request_type: "sponsored_research",
      funding_pathway: "rdti",
      domain_tags: ["AI", "Health"],
      masterplan_alignment: "Aligned",
      next_step: "Call the CSIRO lead",
      is_confidential: true,
      organisation_id: "org-1",
      lead_id: "user-1",
      contact_ids: ["c1", "c2"],
    });
  });

  it("turns absent and null fields into blanks rather than undefined", () => {
    expect(pitchFormFromApi({ title: "Bare" })).toEqual({
      ...EMPTY_PITCH_FORM,
      title: "Bare",
    });
    expect(
      pitchFormFromApi({
        title: "Nulls",
        short_description: null,
        source: null,
        request_type: null,
        funding_pathway: null,
        domain_tags: null,
        masterplan_alignment: null,
        next_step: null,
        is_confidential: null,
        organisation_id: null,
        lead_id: null,
        contact_ids: null,
      }),
    ).toEqual({ ...EMPTY_PITCH_FORM, title: "Nulls" });
  });

  it("splits domain tags on commas and trims the surrounding whitespace", () => {
    expect(
      pitchFormFromApi({ title: "T", domain_tags: "AI, Health ,Energy" })
        .domain_tags,
    ).toEqual(["AI", "Health", "Energy"]);
  });

  it("treats an empty tag string as no tags, not one blank tag", () => {
    expect(
      pitchFormFromApi({ title: "T", domain_tags: "" }).domain_tags,
    ).toEqual([]);
  });
});

describe("pitchPayload", () => {
  it("sends the submission date, which both create and update accept", () => {
    const payload = pitchPayload({
      ...EMPTY_PITCH_FORM,
      title: "T",
      submission_date: "2026-02-03",
    });
    expect(payload.submission_date).toBe("2026-02-03");
  });

  it("turns blank optional fields into null and joins the domain tags", () => {
    expect(
      pitchPayload({
        title: "T",
        short_description: "",
        submission_date: "",
        source: "",
        request_type: "",
        funding_pathway: "",
        domain_tags: ["AI", "Health"],
        masterplan_alignment: "",
        next_step: "",
        is_confidential: false,
        organisation_id: "",
        lead_id: "",
        contact_ids: [],
      }),
    ).toEqual({
      title: "T",
      short_description: null,
      submission_date: null,
      source: null,
      request_type: null,
      funding_pathway: null,
      domain_tags: "AI,Health",
      masterplan_alignment: null,
      next_step: null,
      is_confidential: false,
      organisation_id: null,
      lead_id: null,
      contact_ids: [],
    });
  });

  it("sends no domain tags rather than an empty string when none are chosen", () => {
    expect(
      pitchPayload({ ...EMPTY_PITCH_FORM, title: "T" }).domain_tags,
    ).toBeNull();
  });

  it("sends a cleared submission date as null so the server clears it too", () => {
    expect(
      pitchPayload({ ...EMPTY_PITCH_FORM, title: "T", submission_date: "" })
        .submission_date,
    ).toBeNull();
  });

  it("sends the picked contacts as ids", () => {
    expect(
      pitchPayload({ ...EMPTY_PITCH_FORM, title: "T", contact_ids: ["c1"] })
        .contact_ids,
    ).toEqual(["c1"]);
  });

  it("sends an empty contact list rather than omitting it, so a PATCH can unlink the last one", () => {
    const payload = pitchPayload({ ...EMPTY_PITCH_FORM, title: "T" });
    expect(payload).toHaveProperty("contact_ids");
    expect(payload.contact_ids).toEqual([]);
  });

  it("omits the pipeline stage, which only the board may change", () => {
    expect(
      pitchPayload({ ...EMPTY_PITCH_FORM, title: "T" }),
    ).not.toHaveProperty("current_stage");
  });
});
