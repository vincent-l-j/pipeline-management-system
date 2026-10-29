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

describe("KanbanBoard and retired stages", () => {
  it("has no retired column while no pitch is in a retired stage", () => {
    renderBoard([{ id: "a", title: "Alpha", current_stage: "initial_screen" }]);

    expect(headings()).not.toContain("Received (retired)");
    expect(headings()).not.toContain("Deep Assessment (retired)");
    expect(headings().slice(0, 3)).toEqual([
      "Initial Screen",
      "Discovery Meeting",
      "Due Diligence",
    ]);
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

  it("shows Deep Assessment (retired) between Discovery Meeting and Due Diligence", () => {
    renderBoard([
      { id: "a", title: "Alpha", current_stage: "deep_assessment" },
      { id: "b", title: "Beta", current_stage: "due_diligence" },
    ]);

    expect(headings().slice(0, 4)).toEqual([
      "Initial Screen",
      "Discovery Meeting",
      "Deep Assessment (retired)",
      "Due Diligence",
    ]);
    const column = screen
      .getByRole("heading", { name: "Deep Assessment (retired)" })
      .closest("div.flex-col");
    if (!(column instanceof HTMLElement)) throw new Error("no column");
    expect(within(column).getByText("Alpha")).toBeInTheDocument();
    expect(within(column).queryByText("Beta")).not.toBeInTheDocument();
  });

  it("shows both retired columns, each in place, when both hold pitches", () => {
    renderBoard([
      { id: "a", title: "Alpha", current_stage: "received" },
      { id: "b", title: "Beta", current_stage: "deep_assessment" },
    ]);

    expect(headings().slice(0, 4)).toEqual([
      "Received (retired)",
      "Initial Screen",
      "Discovery Meeting",
      "Deep Assessment (retired)",
    ]);
  });
});
