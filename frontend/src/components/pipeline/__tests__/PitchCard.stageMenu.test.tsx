import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PitchCard from "../PitchCard";
import { PIPELINE_STAGES } from "../PipelineConfig";
import { AuthProvider } from "../../../contexts/AuthContext";
import type { Pitch } from "../../../types";

// The real config and auth: the menu's contents are the behaviour under test,
// so they must come from the shipped stage list, not a fixture.
function renderCard(pitch: Pitch) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <PitchCard
          pitch={pitch}
          innerRef={() => undefined}
          draggableProps={{} as never}
          dragHandleProps={null}
          onStageSelect={() => undefined}
        />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function openMenu(title: string): HTMLElement {
  fireEvent.contextMenu(screen.getByText(title));
  return screen.getByRole("menu");
}

describe("PitchCard stage menu", () => {
  beforeEach(() => {
    localStorage.setItem("token", "t");
    localStorage.setItem(
      "user",
      JSON.stringify({ id: "u1", role: "admin", display_name: "Admin" }),
    );
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("offers every other stage and marks the current one", () => {
    renderCard({
      id: "p1",
      title: "Alpha",
      current_stage: "initial_screen",
      stage_entered_at: "2026-01-01T00:00:00Z",
    });

    const menu = within(openMenu("Alpha"));

    expect(menu.getAllByRole("button")).toHaveLength(
      PIPELINE_STAGES.length - 1,
    );
    expect(menu.getByText("Current")).toBeInTheDocument();
    for (const stage of PIPELINE_STAGES) {
      expect(menu.getByText(stage.label)).toBeInTheDocument();
    }
  });
});
