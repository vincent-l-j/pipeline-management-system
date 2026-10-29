import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import KanbanBoard from "../KanbanBoard";
import { AuthProvider } from "../../../contexts/AuthContext";
import type { Pitch } from "../../../types";

// The real columns and cards, so the board's headings are what a user sees.
function renderBoard(pitches: Pitch[]) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <KanbanBoard pitches={pitches} onPitchMoved={() => undefined} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function headings(): string[] {
  return screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
}

describe("KanbanBoard and the retired Received stage", () => {
  it("has no Received column while no pitch is in Received", () => {
    renderBoard([{ id: "a", title: "Alpha", current_stage: "initial_screen" }]);

    expect(headings()).not.toContain("Received (retired)");
    expect(headings()[0]).toBe("Initial Screen");
  });

  it("shows a Received (retired) column, first, holding the pitches still there", () => {
    renderBoard([
      { id: "a", title: "Alpha", current_stage: "received" },
      { id: "b", title: "Beta", current_stage: "initial_screen" },
    ]);

    expect(headings()[0]).toBe("Received (retired)");
    const column = screen
      .getByRole("heading", { name: "Received (retired)" })
      .closest("div.flex-col");
    if (!(column instanceof HTMLElement)) throw new Error("no column");
    expect(within(column).getByText("Alpha")).toBeInTheDocument();
    expect(within(column).queryByText("Beta")).not.toBeInTheDocument();
  });
});
