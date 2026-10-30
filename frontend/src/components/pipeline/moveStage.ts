/**
 * The pipeline's one stage-change path, shared by the board's drag-and-drop and
 * right-click menu and the list view's stage picker: move the pitch at once,
 * persist the change, and move it back if the request fails.
 */

import api from "../../services/api";

export async function moveStage(
  pitchId: string,
  fromStage: string,
  toStage: string,
  onPitchMoved: (pitchId: string, newStage: string) => void,
): Promise<void> {
  if (fromStage === toStage) return;

  onPitchMoved(pitchId, toStage);

  try {
    await api.post(`/pitches/${pitchId}/stage`, {
      new_stage: toStage,
      note: `Moved from ${fromStage.replace("_", " ")} to ${toStage.replace("_", " ")}`,
    });
  } catch (err) {
    onPitchMoved(pitchId, fromStage);
    console.error("Failed to update stage:", err);
  }
}
