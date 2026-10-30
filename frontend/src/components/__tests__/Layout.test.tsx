import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Layout from "../Layout";

// An admin throughout: the drawer has to reach the role-gated admin section,
// and role gating itself is covered at the sidebar seam.
const mockUser = { display_name: "Alice Admin", role: "admin" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

// jsdom has no matchMedia. This stands in for the medium-breakpoint query, so a
// test can widen the viewport past it the way rotating a phone does.
let viewportListeners: ((event: MediaQueryListEvent) => void)[] = [];
let viewportIsDesktop = false;

function widenPastMediumBreakpoint() {
  viewportIsDesktop = true;
  act(() => {
    for (const listener of viewportListeners) {
      listener({ matches: true } as MediaQueryListEvent);
    }
  });
}

beforeEach(() => {
  viewportListeners = [];
  viewportIsDesktop = false;
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    get matches() {
      return viewportIsDesktop;
    },
    addEventListener: (
      _type: "change",
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      viewportListeners.push(listener);
    },
    removeEventListener: (
      _type: "change",
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      viewportListeners = viewportListeners.filter((l) => l !== listener);
    },
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderLayout() {
  render(
    <MemoryRouter>
      <Layout>
        <p>Page content</p>
        <button type="button">Page action</button>
      </Layout>
    </MemoryRouter>,
  );
}

// As in the app, each page is its own component rendering its own shell, so
// navigating swaps the whole shell for a new one. Two routes rendering `Layout`
// directly would not: React keeps an element of the same type in place.
function DashboardPage() {
  return (
    <Layout>
      <h1>Dashboard page</h1>
    </Layout>
  );
}

function PitchesPage() {
  return (
    <Layout>
      <h1>Pitches page</h1>
    </Layout>
  );
}

function renderPages() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/pitches" element={<PitchesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function menuToggle() {
  return screen.getByRole("button", { name: "Menu" });
}

describe("Layout", () => {
  it("renders the page content", () => {
    renderLayout();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("offers a named menu toggle that starts collapsed", () => {
    renderLayout();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens the drawer over the page when the toggle is pressed", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "Menu" }));

    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /close navigation/i }),
    ).toBeInTheDocument();
  });

  it("closes the drawer when the backdrop is tapped", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Menu" }));

    await user.click(screen.getByRole("button", { name: /close navigation/i }));

    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("reaches every destination from the drawer, admin section included", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: "Menu" }));

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual([
      "/",
      "/pipeline",
      "/pitches",
      "/organisations",
      "/contacts",
      "/meetings",
      "/assessments",
      "/search",
      "/reports",
      "/admin/users",
    ]);
  });

  it("closes the drawer when a destination is chosen", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Menu" }));

    await user.click(screen.getByRole("link", { name: /Pitches/ }));

    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("closes the drawer when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Menu" }));

    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("moves focus into the drawer when it opens", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(menuToggle());

    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveFocus();
  });

  it("wraps Tab from the last drawer item back to the first", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(menuToggle());
    screen.getByRole("button", { name: "Sign out" }).focus();

    await user.tab();

    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveFocus();
  });

  it("wraps Shift+Tab from the first drawer item round to the last", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(menuToggle());

    await user.tab({ shift: true });

    expect(screen.getByRole("button", { name: "Sign out" })).toHaveFocus();
  });

  it("keeps Tab inside the drawer for a full lap", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(menuToggle());
    // Ten destinations and Sign out: one more press than the drawer holds.
    const reached = new Set<Element | null>();
    for (let press = 0; press < 12; press++) {
      await user.tab();
      reached.add(document.activeElement);
    }

    expect(
      [...reached].filter(
        (element) =>
          !document.getElementById("app-navigation")?.contains(element),
      ),
    ).toEqual([]);
  });

  it.each([
    [
      "Escape",
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.keyboard("{Escape}");
      },
    ],
    [
      "the backdrop",
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(
          screen.getByRole("button", { name: /close navigation/i }),
        );
      },
    ],
    [
      "choosing the page it is already on",
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole("link", { name: /Dashboard/ }));
      },
    ],
  ])("returns focus to the menu toggle when closed by %s", async (_, close) => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(menuToggle());

    await close(user);

    expect(menuToggle()).toHaveAttribute("aria-expanded", "false");
    expect(menuToggle()).toHaveFocus();
  });

  it("hands focus to the next page's menu toggle when a destination is chosen", async () => {
    const user = userEvent.setup();
    renderPages();
    await user.click(menuToggle());

    await user.click(screen.getByRole("link", { name: /Pitches/ }));

    expect(
      await screen.findByRole("heading", { name: "Pitches page" }),
    ).toBeInTheDocument();
    expect(menuToggle()).toHaveFocus();
  });

  it("leaves focus alone when a page's shell mounts without a drawer navigation", () => {
    renderPages();

    expect(menuToggle()).not.toHaveFocus();
  });

  it("leaves Tab alone while the drawer is closed", async () => {
    const user = userEvent.setup();
    renderLayout();
    screen.getByRole("button", { name: "Sign out" }).focus();

    await user.tab();

    expect(screen.getByRole("button", { name: "Page action" })).toHaveFocus();
  });

  // Rotating a phone can carry it past the breakpoint, where there is no drawer
  // to hold the page behind.
  it("closes the drawer when the viewport widens past the medium breakpoint", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(menuToggle());

    widenPastMediumBreakpoint();

    expect(menuToggle()).toHaveAttribute("aria-expanded", "false");
  });
});
