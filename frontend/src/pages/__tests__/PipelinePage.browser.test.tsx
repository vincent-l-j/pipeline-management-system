import { page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PipelinePage from "../PipelinePage";
import { AuthProvider } from "../../contexts/AuthContext";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const apiMocks = createApiMocks();

const PITCH = {
  id: "p1",
  title: "Autonomous Remote Sensing for Rangeland Carbon Accounting",
  short_description: "A long-running collaboration with three universities",
  source: "university",
  funding_pathway: "crc_project",
  domain_tags: "agriculture, remote sensing, carbon",
  current_stage: "due_diligence",
  stage_entered_at: "2026-03-14T00:00:00Z",
  submission_date: "2026-03-14",
  lead_id: "u1",
};

const PITCHES = [
  PITCH,
  {
    ...PITCH,
    id: "p2",
    title: "Low-Cost Soil Moisture Telemetry for Smallholder Irrigation",
    current_stage: "initial_screen",
  },
];

const DIRECTORY = [
  { id: "u1", display_name: "Alexandra McConnell-Fitzwilliam" },
];

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

beforeEach(() => {
  localStorage.setItem("token", "t");
  localStorage.setItem(
    "user",
    JSON.stringify({ id: "u1", role: "admin", display_name: "Admin" }),
  );
  apiMocks.get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === "/pitches" ? PITCHES : DIRECTORY }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function showPipeline() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <PipelinePage />
      </AuthProvider>
    </MemoryRouter>,
  );
  await expect.element(page.getByText(PITCH.title)).toBeVisible();
}

describe("the pipeline on a 360px screen", () => {
  it("runs below the md breakpoint", () => {
    expect(window.innerWidth).toBeLessThan(768);
  });

  it("opens on the list", async () => {
    await showPipeline();

    await expect.element(page.getByRole("table")).toBeVisible();
  });
});
