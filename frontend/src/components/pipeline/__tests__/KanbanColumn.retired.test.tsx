import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import KanbanColumn from "../KanbanColumn";
import { STAGE_MAP } from "../PipelineConfig";
import { AuthProvider } from "../../../contexts/AuthContext";

// No inline dnd mock: the shared stub reports isDropDisabled as an attribute.
function renderColumn(stageKey: string) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <KanbanColumn
          stage={STAGE_MAP[stageKey]}
          pitches={[
            { id: "p1", title: "Left behind", current_stage: stageKey },
          ]}
        />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function dropArea(): HTMLElement {
  const area = document.querySelector("[data-drop-disabled]");
  if (!(area instanceof HTMLElement)) throw new Error("no drop area");
  return area;
}

describe("KanbanColumn for a retired stage", () => {
  it.each([["deep_assessment", "Deep Assessment (retired)"]])(
    "says %s is retired and refuses drops",
    (stage, heading) => {
      renderColumn(stage);

      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
      expect(dropArea()).toHaveAttribute("data-drop-disabled", "true");
    },
  );

  it("leaves an active stage's heading and drops alone", () => {
    renderColumn("initial_screen");

    expect(
      screen.getByRole("heading", { name: "Initial Screen" }),
    ).toBeInTheDocument();
    expect(dropArea()).toHaveAttribute("data-drop-disabled", "false");
  });
});
