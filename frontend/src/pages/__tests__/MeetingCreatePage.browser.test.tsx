import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingCreatePage from "../MeetingCreatePage";
import { createApiMocks } from "../../test/mocks/api";
import { unobscured } from "../../test/unobscured";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

const mockUser = { id: "u1", display_name: "Alice Assessor", role: "assessor" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

/** Long the way real titles are long, so neither fits a phone's width. */
const PITCHES = [
  {
    id: "p1",
    title: "Rangeland carbon sensing from low-orbit hyperspectral imaging",
  },
  {
    id: "p2",
    title: "Soil moisture telemetry for dryland cropping co-operatives",
  },
];

/** Every field the form lays out in a grid on a wide screen. */
const GRID_FIELDS = [
  "Date *",
  "Time",
  "Platform",
  "Follow-up Date",
  "Recording Link",
];

// See PitchCreatePage.browser.test.tsx: the page settles outside act().
beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

beforeEach(() => {
  apiMocks.get.mockImplementation((url: string) =>
    url === "/pitches"
      ? Promise.resolve({ data: PITCHES })
      : Promise.reject(new Error(`no fixture for ${url}`)),
  );
});

afterEach(async () => {
  cleanup();
  // Media emulation outlives the test that set it; the page is file-wide.
  await commands.emulateMedia("screen");
  window.scrollTo(0, 0);
});

/** Renders the page and waits for the pitch list its picker needs. */
async function showForm() {
  render(
    <MemoryRouter initialEntries={["/meetings/new"]}>
      <Routes>
        <Route path="/meetings/new" element={<MeetingCreatePage />} />
        <Route path="/meetings/:meetingId" element={<p>Meeting detail</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await expect.element(page.getByLabelText("Linked Pitch *")).toBeVisible();
  await apiMocks.get.mock.mock.results[0]?.value;
}

const saveButton = () => page.getByRole("button", { name: "Save Meeting" });

/** Taps by accessible name: the row is found as a user finds it, then touched. */
async function tapOption(name: string) {
  await commands.tap(`#${page.getByRole("option", { name }).element().id}`);
}

describe("logging a meeting on a 360px screen", () => {
  // Guards the file: at the wrong width everything below passes vacuously.
  it("runs at the width the mobile layout was designed for", () => {
    expect(window.innerWidth).toBe(360);
  });

  it("fits the viewport without scrolling sideways", async () => {
    await showForm();

    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    expect(document.body.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  });

  // Wider than half the viewport is what a field cannot be while a second
  // column sits beside it, which is the squeeze the collapse exists to undo.
  it.each(GRID_FIELDS)("gives %s a column to itself", async (label) => {
    await showForm();

    const field = page.getByLabelText(label).element();

    expect(field.getBoundingClientRect().width).toBeGreaterThan(
      window.innerWidth / 2,
    );
  });

  it("keeps a long pitch title inside the screen while choosing it", async () => {
    await showForm();
    await commands.tap("#meeting-pitch");

    const { left, right } = page
      .getByRole("option", { name: PITCHES[0].title })
      .element()
      .getBoundingClientRect();

    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(window.innerWidth);
  });

  it("shows the save action before the form has been scrolled at all", async () => {
    await showForm();
    // Without a form taller than the screen there is nothing to pin.
    expect(document.documentElement.scrollHeight).toBeGreaterThan(
      window.innerHeight,
    );

    const { top, bottom } = saveButton().element().getBoundingClientRect();

    expect(window.scrollY).toBe(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  it("logs a meeting by touch, finding its pitch by typing", async () => {
    apiMocks.post.mockResolvedValue({ data: { id: "m1" } });
    await showForm();
    await userEvent.fill(
      page.getByLabelText("Meeting Title *"),
      "Discovery call",
    );

    await commands.tap("#meeting-pitch");
    await userEvent.fill(page.getByLabelText("Linked Pitch *"), "soil");
    await tapOption(PITCHES[1].title);
    await commands.tap('button[type="submit"]');

    await expect.element(page.getByText("Meeting detail")).toBeInTheDocument();
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/meetings",
      expect.objectContaining({ title: "Discovery call", pitch_id: "p2" }),
    );
  });

  // Tapped from the foot of a form several screens long, the banner above the
  // first field is off-screen; the reason has to come to the user.
  it("shows why a save failed without the form being scrolled back up", async () => {
    apiMocks.post.mockRejectedValue({
      response: { status: 500, data: { detail: "Database unavailable" } },
    });
    await showForm();
    await userEvent.fill(
      page.getByLabelText("Meeting Title *"),
      "Discovery call",
    );
    await commands.tap("#meeting-pitch");
    await tapOption(PITCHES[1].title);
    window.scrollTo(0, document.documentElement.scrollHeight);

    await commands.tap('button[type="submit"]');

    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent("Database unavailable");
    expect(unobscured(alert.element())).toEqual({
      inViewport: true,
      onTop: true,
    });
  });
  it("does not print the save bar", async () => {
    await showForm();
    const bar = page.getByTestId("save-bar").element();

    await commands.emulateMedia("print");

    expect(bar.checkVisibility()).toBe(false);
  });
});
