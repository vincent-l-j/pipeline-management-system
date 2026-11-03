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
