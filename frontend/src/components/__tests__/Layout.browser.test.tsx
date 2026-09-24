import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Layout from "../Layout";

// An admin, so the drawer reaches the role-gated admin section.
const mockUser = { display_name: "Alice Admin", role: "admin" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

function renderLayout() {
  render(
    <MemoryRouter>
      <Layout>
        <p>Page content</p>
      </Layout>
    </MemoryRouter>,
  );
}

function openDrawer() {
  return userEvent.click(page.getByRole("button", { name: "Menu" }));
}

// React Testing Library turns the act environment on in its own beforeAll, for
// jsdom's benefit. Registered after it, so this wins: a real click updates state
// outside act() by design, and that is the rendering a user actually gets.
beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(async () => {
  cleanup();
  // Media emulation outlives the test that set it; the page is file-wide.
  await commands.emulateMedia("screen");
});

describe("Layout in a browser at the 360px design floor", () => {
  // Guards the file: at the wrong width everything below passes vacuously.
  it("runs at the width the mobile layout was designed for", () => {
    expect(window.innerWidth).toBe(360);
  });

  it("closes the drawer from the same toggle that opened it", async () => {
    renderLayout();
    const toggle = page.getByRole("button", { name: "Menu" });

    await openDrawer();
    await expect.element(toggle).toHaveAttribute("aria-expanded", "true");

    // A real click: anything painted over the toggle fails pointer interception.
    await userEvent.click(toggle);

    await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("prints neither the app bar nor the drawer", async () => {
    renderLayout();
    await openDrawer();
    const appBar = page.getByRole("banner").element();
    // Not the <aside> inside it, whose print rule predates the drawer.
    const drawer = document.getElementById("app-navigation");
    expect(drawer).not.toBeNull();

    await commands.emulateMedia("print");

    expect(appBar.checkVisibility()).toBe(false);
    expect(drawer?.checkVisibility()).toBe(false);
  });

  // Only in-flow content can widen the document; the drawer is fixed, and a
  // fixed box never contributes to scrollWidth however wide it gets.
  it("fits the viewport without scrolling sideways", () => {
    renderLayout();

    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  });

  it("gives every navigation item a 44px touch target", async () => {
    renderLayout();
    await openDrawer();

    // Named rather than counted, so a failure says which item is too small.
    const items = page.getByRole("link").elements();
    expect(items.length).toBeGreaterThan(0);
    expect(
      items
        .filter((item) => item.getBoundingClientRect().height < 44)
        .map((item) => item.textContent),
    ).toEqual([]);
  });
});
