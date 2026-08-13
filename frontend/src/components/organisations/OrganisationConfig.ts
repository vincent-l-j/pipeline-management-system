/**
 * Organisation vocabulary shared by the organisations page and the quick-create
 * dialog on the pitch form.
 */

import type { OrgType } from "../../types";

/** Mirrors OrgType in backend/app/models/organisation.py. */
export const ORG_TYPES: readonly OrgType[] = [
  "startup",
  "university",
  "ngo",
  "government",
  "consortium",
  "research_centre",
  "other",
] as const;

/** The label shown for an org type — the stored value with its underscores opened up. */
export function orgTypeLabel(type: string): string {
  return type.replace(/_/g, " ");
}
