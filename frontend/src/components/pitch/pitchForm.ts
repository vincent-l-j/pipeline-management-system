/**
 * Pitch form state and the payload sent to the API.
 *
 * Pure and DOM-free so it can be unit-tested without rendering: the create and
 * edit pages send the same fields, so they share one payload builder and differ
 * only in the request they make with it (POST vs PATCH).
 *
 * One asymmetry is deliberate, not an oversight: `current_stage` is never sent.
 * Stage changes go through the Kanban board so every transition is audited.
 */

/** Controlled state for a pitch form. Every field is a string, so it can be bound. */
export interface PitchFormValues {
  title: string;
  short_description: string;
  submission_date: string;
  source: string;
  request_type: string;
  funding_pathway: string;
  domain_tags: string[];
  masterplan_alignment: string;
  next_step: string;
  is_confidential: boolean;
  organisation_id: string;
  lead_id: string;
  contact_ids: string[];
}

/** The subset of an API pitch the form pre-fills from. */
export interface PitchFormSource {
  title: string;
  short_description?: string | null;
  submission_date?: string | null;
  source?: string | null;
  request_type?: string | null;
  funding_pathway?: string | null;
  domain_tags?: string | null;
  masterplan_alignment?: string | null;
  next_step?: string | null;
  is_confidential?: boolean | null;
  organisation_id?: string | null;
  lead_id?: string | null;
  contact_ids?: string[] | null;
}

export const EMPTY_PITCH_FORM: PitchFormValues = {
  title: "",
  short_description: "",
  submission_date: "",
  source: "",
  request_type: "",
  funding_pathway: "",
  domain_tags: [],
  masterplan_alignment: "",
  next_step: "",
  is_confidential: false,
  organisation_id: "",
  lead_id: "",
  contact_ids: [],
};

/**
 * A blank form for a new pitch, dated today.
 *
 * A factory rather than a constant: the date has to be read when the form opens,
 * not when the module is imported, or a tab left open overnight would submit
 * yesterday's date. It also keeps the array fields fresh per form.
 */
export function newPitchForm(): PitchFormValues {
  return {
    ...EMPTY_PITCH_FORM,
    domain_tags: [],
    contact_ids: [],
    submission_date: new Date().toISOString().split("T")[0],
  };
}

/** Pre-fill a form from an existing pitch, normalising nulls to blanks. */
export function pitchFormFromApi(pitch: PitchFormSource): PitchFormValues {
  return {
    title: pitch.title,
    short_description: pitch.short_description ?? "",
    submission_date: pitch.submission_date ?? "",
    source: pitch.source ?? "",
    request_type: pitch.request_type ?? "",
    funding_pathway: pitch.funding_pathway ?? "",
    domain_tags: pitch.domain_tags
      ? pitch.domain_tags.split(",").map((tag) => tag.trim())
      : [],
    masterplan_alignment: pitch.masterplan_alignment ?? "",
    next_step: pitch.next_step ?? "",
    is_confidential: pitch.is_confidential ?? false,
    organisation_id: pitch.organisation_id ?? "",
    lead_id: pitch.lead_id ?? "",
    contact_ids: pitch.contact_ids ?? [],
  };
}

/**
 * The body of a create or update request. Blank optional fields become null so
 * clearing a field in the UI actually clears it on the server rather than storing
 * "" — and, for the date, so the backend gets a valid null instead of a "" it
 * would reject as a malformed date.
 */
export function pitchPayload(values: PitchFormValues) {
  return {
    title: values.title,
    short_description: values.short_description || null,
    submission_date: values.submission_date || null,
    source: values.source || null,
    request_type: values.request_type || null,
    funding_pathway: values.funding_pathway || null,
    domain_tags:
      values.domain_tags.length > 0 ? values.domain_tags.join(",") : null,
    masterplan_alignment: values.masterplan_alignment || null,
    next_step: values.next_step || null,
    is_confidential: values.is_confidential,
    organisation_id: values.organisation_id || null,
    lead_id: values.lead_id || null,
    // Always sent, empty list included: on a PATCH that is how the last contact
    // is unlinked, and the API replaces the whole set with whatever it is given.
    contact_ids: values.contact_ids,
  };
}
