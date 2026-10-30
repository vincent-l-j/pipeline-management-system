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
  current_stage: "due_diligence",
  stage_entered_at: "2026-03-14T00:00:00Z",
};

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
    Promise.resolve({ data: url === "/pitches" ? [PITCH] : [] }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("the pipeline at and above the md breakpoint", () => {
  it("runs at a width md applies at", () => {
    expect(window.innerWidth).toBeGreaterThanOrEqual(768);
  });

  it("opens on the board", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <PipelinePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await expect.element(page.getByText(PITCH.title)).toBeVisible();
    await expect
      .element(page.getByRole("heading", { name: "Due Diligence" }))
      .toBeVisible();
    expect(page.getByRole("table").query()).toBeNull();
  });

  // The phone's 44px touch sizing stops at md: the desktop toolbar stays compact.
  it("keeps the filter and view controls at their desktop size", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <PipelinePage />
        </AuthProvider>
      </MemoryRouter>,
    );
    await expect.element(page.getByText(PITCH.title)).toBeVisible();

    const controls = [
      ...page.getByRole("combobox").elements(),
      page.getByRole("button", { name: "Board" }).element(),
      page.getByRole("button", { name: "List" }).element(),
    ];
    for (const control of controls) {
      expect(control.getBoundingClientRect().height).toBeLessThan(44);
    }
  });
});
