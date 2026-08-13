export type OrgType =
  | "startup"
  | "university"
  | "ngo"
  | "government"
  | "consortium"
  | "research_centre"
  | "other";

export interface Organisation {
  id: string;
  name: string;
  org_type: OrgType | null;
  sector: string | null;
  state_territory: string | null;
  website: string | null;
  abn: string | null;
  notes: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  organisation_ids: string[];
}

export interface Pitch {
  id: string;
  title: string;
  short_description?: string;
  source?: string;
  funding_pathway?: string;
  domain_tags?: string;
  is_confidential?: boolean;
  submission_date?: string;
  current_stage: string;
  lead_id?: string;
  /** The immediate next action on the pitch, as free text. */
  next_step?: string | null;
  /**
   * Read-only and derived from the pitch's latest assessment, and only once the
   * pitch is in the declined stage. Not settable through the pitch API.
   */
  decline_reason?: DeclineReason | null;
}

export type Recommendation = "proceed" | "park" | "decline";

export type DeclineReason =
  | "not_strategic_priority"
  | "insufficient_scale"
  | "insufficient_capacity_capability"
  | "grant_funding_rejected"
  | "lack_of_rozetta_capacity"
  | "other";

/** Score fields shared by the assessment API shape and the create form. */
export interface AssessmentScores {
  national_impact: number;
  translation_readiness: number;
  team_capability: number;
  ecosystem_fit: number;
  funding_pathway_clarity: number;
  masterplan_alignment: number;
}

export interface Assessment extends AssessmentScores {
  id: string;
  pitch_id: string;
  assessor_id: string;
  assessment_date: string;
  version: number;
  recommendation: Recommendation;
  /** Only ever set alongside a decline recommendation. */
  decline_reason?: DeclineReason | null;
  rationale?: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "assessor" | "viewer";
  is_active: boolean;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
    status?: number;
  };
}
