/**
 * Which closed pitches the Pipeline page leaves off the board.
 *
 * The threshold is an argument rather than read here, so a per-user setting can
 * supply it later without changing the rule.
 */

import type { Pitch } from "../../types";

/** Days after closing that a pitch leaves the Pipeline page, for now. */
export const CLOSED_PITCH_HIDE_AFTER_DAYS = 90;

const CLOSED_STAGES = new Set(["declined", "completed"]);
const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the pitch closed more than `thresholdDays` before `now`. */
export function isLongClosed(
  pitch: Pitch,
  now: Date,
  thresholdDays: number,
): boolean {
  if (!CLOSED_STAGES.has(pitch.current_stage)) return false;
  const closedFor = now.getTime() - new Date(pitch.stage_entered_at).getTime();
  return closedFor > thresholdDays * DAY_MS;
}
