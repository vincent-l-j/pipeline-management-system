import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Layout from "../Layout";

let mockUser = { display_name: "Alice Admin", role: "admin" };
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

describe("Layout", () => {
  beforeEach(() => {
    mockUser = { display_name: "Alice Admin", role: "admin" };
  });

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
    expect(
      screen.queryByRole("button", { name: /close navigation/i }),
    ).not.toBeInTheDocument();

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
});
