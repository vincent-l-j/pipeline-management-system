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

  function renderCard(pitch: Record<string, unknown>) {
    render(
      <PitchCard
        pitch={pitch as never}
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
  }

  it("shows why a declined pitch was declined", () => {
    renderCard({
      id: "p1",
      title: "Declined Pitch",
      current_stage: "received",
      is_confidential: false,
      decline_reason: "insufficient_scale",
    });
    expect(screen.getByText("Insufficient scale")).toBeInTheDocument();
  });

  it("shows no reason chip when the pitch has none", () => {
    renderCard({
      id: "p1",
      title: "Open Pitch",
      current_stage: "received",
      is_confidential: false,
    });
    expect(screen.queryByText("Insufficient scale")).not.toBeInTheDocument();
  });

  it("falls back to the raw value for a reason it has no label for", () => {
    renderCard({
      id: "p1",
      title: "Odd Pitch",
      current_stage: "received",
      is_confidential: false,
      decline_reason: "some_future_reason",
    });
    expect(screen.getByText("some_future_reason")).toBeInTheDocument();
  });
});
