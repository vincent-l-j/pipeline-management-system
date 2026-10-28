import { describe, it, expect } from "vitest";
import { isLongClosed } from "../closedPitches";
import type { Pitch } from "../../../types";

const NOW = new Date("2026-10-28T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function pitch(stage: string, daysInStage: number): Pitch {
  return {
    id: "p",
    title: "A pitch",
    current_stage: stage,
    stage_entered_at: new Date(NOW.getTime() - daysInStage * DAY).toISOString(),
  };
}

describe("isLongClosed", () => {
  it.each(["declined", "completed"])(
    "hides a pitch %s more than the threshold ago",
    (stage) => {
      expect(isLongClosed(pitch(stage, 91), NOW, 90)).toBe(true);
    },
  );

  it.each([90, 1])("keeps a pitch declined %i days ago", (days) => {
    expect(isLongClosed(pitch("declined", days), NOW, 90)).toBe(false);
  });

  it.each(["initial_screen", "due_diligence", "parked"])(
    "keeps a pitch in %s however long it has been there",
    (stage) => {
      expect(isLongClosed(pitch(stage, 365), NOW, 90)).toBe(false);
    },
  );

  it("doesn't need an entry time for a pitch that isn't closed", () => {
    const open = { id: "p", title: "Open", current_stage: "parked" } as Pitch;

    expect(isLongClosed(open, NOW, 90)).toBe(false);
  });

  it("uses the threshold it is given", () => {
    expect(isLongClosed(pitch("declined", 31), NOW, 30)).toBe(true);
    expect(isLongClosed(pitch("declined", 31), NOW, 90)).toBe(false);
  });
});
