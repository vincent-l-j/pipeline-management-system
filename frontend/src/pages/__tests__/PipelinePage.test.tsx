import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import PipelinePage from "../PipelinePage";
import { AuthProvider } from "../../contexts/AuthContext";
import { createApiMocks } from "../../test/mocks/api";
import type { Pitch } from "../../types";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const apiMocks = createApiMocks();

vi.mock("../../components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}

function pitch(id: string, title: string, stage: string, days: number): Pitch {
  return {
    id,
    title,
    current_stage: stage,
    stage_entered_at: daysAgo(days),
  };
}

const LONG_DECLINED = pitch("1", "Long declined", "declined", 100);
const LONG_COMPLETED = pitch("2", "Long completed", "completed", 100);
const RECENT_DECLINED = pitch("3", "Recently declined", "declined", 5);
const LONG_PARKED = pitch("4", "Long parked", "parked", 400);
const PITCHES = [LONG_DECLINED, LONG_COMPLETED, RECENT_DECLINED, LONG_PARKED];

function respondWith(pitches: Pitch[]) {
  apiMocks.get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === "/pitches" ? pitches : [] }),
  );
}

function Location() {
  return <p data-testid="search">{useLocation().search}</p>;
}

function renderPage(path = "/pipeline") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/pipeline"
            element={
              <>
                <PipelinePage />
                <Location />
              </>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.setItem("token", "t");
  localStorage.setItem(
    "user",
    JSON.stringify({ id: "u1", role: "admin", display_name: "Admin" }),
  );
  respondWith(PITCHES);
});

afterEach(() => {
  localStorage.clear();
});

describe("PipelinePage hides long-closed pitches", () => {
  it("leaves pitches closed more than 90 days ago off the board", async () => {
    renderPage();

    expect(await screen.findByText("Recently declined")).toBeInTheDocument();
    expect(screen.getByText("Long parked")).toBeInTheDocument();
    expect(screen.queryByText("Long declined")).not.toBeInTheDocument();
    expect(screen.queryByText("Long completed")).not.toBeInTheDocument();
    expect(
      screen.getByText("2 initiatives in the pipeline"),
    ).toBeInTheDocument();
  });

  it("leaves them out of the list view too", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Recently declined");

    await user.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByText("Recently declined")).toBeInTheDocument();
    expect(screen.queryByText("Long declined")).not.toBeInTheDocument();
  });

  it("keeps them hidden under the stage filter", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Recently declined");

    await user.selectOptions(
      screen.getByDisplayValue("All stages"),
      "declined",
    );

    expect(screen.getByText("Recently declined")).toBeInTheDocument();
    expect(screen.queryByText("Long declined")).not.toBeInTheDocument();
  });

  it("offers to show the hidden pitches, and keeps that choice in the URL", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Recently declined");

    const toggle = screen.getByRole("button", { name: "Show 2 hidden" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(screen.getByText("Long declined")).toBeInTheDocument();
    expect(screen.getByText("Long completed")).toBeInTheDocument();
    expect(
      screen.getByText("4 initiatives in the pipeline"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("search")).toHaveTextContent("?closed=show");
    const hide = screen.getByRole("button", {
      name: "Hide closed over 90 days",
    });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    await user.click(hide);

    expect(screen.queryByText("Long declined")).not.toBeInTheDocument();
    expect(screen.getByTestId("search")).toHaveTextContent("");
  });

  it("shows the hidden pitches from the start when the URL asks for them", async () => {
    renderPage("/pipeline?closed=show");

    expect(await screen.findByText("Long declined")).toBeInTheDocument();
  });

  it("has no toggle when nothing is hidden", async () => {
    respondWith([RECENT_DECLINED, LONG_PARKED]);
    renderPage();
    await screen.findByText("Recently declined");

    expect(
      screen.queryByRole("button", { name: /hidden|Hide closed/ }),
    ).not.toBeInTheDocument();
  });

  it("still offers the toggle when every pitch is hidden", async () => {
    respondWith([LONG_DECLINED, LONG_COMPLETED]);
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Show 2 hidden" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("0 initiatives in the pipeline"),
    ).toBeInTheDocument();
  });

  it("keeps a shown pitch on the board after moving it to the other closed stage", async () => {
    apiMocks.post.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage("/pipeline?closed=show");
    await screen.findByText("Long completed");

    fireEvent.contextMenu(screen.getByText("Long completed"));
    await user.click(
      within(screen.getByRole("menu")).getByRole("button", {
        name: "Declined",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Hide closed over 90 days" }),
    );

    expect(screen.getByText("Long completed")).toBeInTheDocument();
    expect(screen.queryByText("Long declined")).not.toBeInTheDocument();
  });
});

describe("PipelinePage loading states", () => {
  it("says it is loading before the pitches arrive", () => {
    apiMocks.get.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(screen.getByText("Loading pipeline...")).toBeInTheDocument();
  });

  it("asks for the pitches with a timeout", async () => {
    renderPage();
    await screen.findByText("Recently declined");

    expect(apiMocks.get.mock).toHaveBeenCalledWith(
      "/pitches",
      expect.objectContaining({ timeout: expect.any(Number) as number }),
    );
  });

  it("shows an empty board with no pitches at all", async () => {
    respondWith([]);
    renderPage();

    expect(
      await screen.findByText("0 initiatives in the pipeline"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("No pitches").length).toBeGreaterThan(0);
  });

  it("offers a retry when the pitches can't be loaded, and recovers", async () => {
    apiMocks.get.mockRejectedValue(new Error("timeout of 15000ms exceeded"));
    const user = userEvent.setup();
    renderPage();

    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getByText(/couldn't load the pipeline/i)).toBeInTheDocument();
    expect(screen.queryByText("No pitches")).not.toBeInTheDocument();

    respondWith(PITCHES);
    await user.click(retry);

    expect(await screen.findByText("Recently declined")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
