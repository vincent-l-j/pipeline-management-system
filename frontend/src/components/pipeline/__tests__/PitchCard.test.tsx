import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DraggableProvidedDraggableProps } from "@hello-pangea/dnd";
import PitchCard from "../PitchCard";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

vi.mock("../PipelineConfig", () => ({
  STAGE_MAP: {
    received: { label: "Received", lightColor: "bg-blue-50 text-blue-700" },
    submitted: { label: "Submitted", lightColor: "bg-green-50 text-green-700" },
  },
  SOURCE_LABELS: {},
  FUNDING_LABELS: {},
  PIPELINE_STAGES: [],
}));

describe("PitchCard", () => {
  it("renders pitch title", () => {
    const pitch = {
      id: "p1",
      title: "Test Pitch",
      current_stage: "received",
      is_confidential: false,
    };
    render(
      <PitchCard
        pitch={pitch}
        innerRef={null}
        draggableProps={
          {
            "data-rbd-draggable-context-id": "1",
            "data-rbd-draggable-id": "test",
          } as unknown as DraggableProvidedDraggableProps
        }
        dragHandleProps={null}
      />,
    );
    expect(screen.getByText("Test Pitch")).toBeInTheDocument();
  });

  it("shows confidential badge when marked", () => {
    const pitch = {
      id: "p1",
      title: "Test Pitch",
      current_stage: "received",
      is_confidential: true,
    };
    render(
      <PitchCard
        pitch={pitch}
        innerRef={null}
        draggableProps={
          {
            "data-rbd-draggable-context-id": "1",
            "data-rbd-draggable-id": "test",
          } as unknown as DraggableProvidedDraggableProps
        }
        dragHandleProps={null}
      />,
    );
    expect(screen.getByText(/Confidential/i)).toBeInTheDocument();
  });
});
