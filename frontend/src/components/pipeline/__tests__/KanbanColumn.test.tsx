import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import KanbanColumn from "../KanbanColumn";

interface DroppableProvided {
  innerRef: () => void;
  droppableProps: Record<string, unknown>;
  placeholder: null;
}

interface DroppableSnapshot {
  isDraggingOver: boolean;
}

interface DraggableProvided {
  innerRef: () => void;
  draggableProps: Record<string, unknown>;
  dragHandleProps: Record<string, unknown>;
}

interface DraggableSnapshot {
  isDragging: boolean;
}

// Mock the drag-and-drop library
vi.mock("@hello-pangea/dnd", () => ({
  Droppable: ({
    children,
  }: {
    children: (
      provided: DroppableProvided,
      snapshot: DroppableSnapshot,
    ) => React.ReactNode;
  }) =>
    children(
      {
        innerRef: () => {
          /* ref not needed in test */
        },
        droppableProps: {},
        placeholder: null,
      },
      { isDraggingOver: false },
    ),
  Draggable: ({
    children,
  }: {
    children: (
      provided: DraggableProvided,
      snapshot: DraggableSnapshot,
    ) => React.ReactNode;
  }) =>
    children(
      {
        innerRef: () => {
          /* ref not needed in test */
        },
        draggableProps: {},
        dragHandleProps: {},
      },
      { isDragging: false },
    ),
}));

// Mock useNavigate and useAuth
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "viewer" } }),
}));

vi.mock("../PipelineConfig", () => ({
  STAGE_MAP: {},
  SOURCE_LABELS: {},
  FUNDING_LABELS: {},
  PIPELINE_STAGES: [],
}));

describe("KanbanColumn", () => {
  it("renders column with title", () => {
    const stage = {
      key: "received",
      label: "Received",
      color: "bg-blue-400",
      lightColor: "bg-blue-100 text-blue-700",
    };
    render(<KanbanColumn stage={stage} pitches={[]} />);
    expect(screen.getByText("Received")).toBeInTheDocument();
  });

  it("renders pitch cards", () => {
    const stage = {
      key: "received",
      label: "Received",
      color: "bg-blue-400",
      lightColor: "bg-blue-100 text-blue-700",
    };
    const pitches = [
      { id: "p1", title: "Test Pitch", current_stage: "received" },
    ];
    render(<KanbanColumn stage={stage} pitches={pitches} />);
    expect(screen.getByText("Test Pitch")).toBeInTheDocument();
  });
});
