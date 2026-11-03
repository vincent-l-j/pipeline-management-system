import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ContactsPage from "../ContactsPage";
import { createApiMocks } from "../../test/mocks/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

const mockUser = { id: "u1", display_name: "Alice Admin", role: "admin" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn() }),
}));

const RESPONSES: Record<string, unknown> = {
  "/contacts": [],
  "/organisations": [],
};

// See PitchCreatePage.browser.test.tsx: the page settles outside act().
beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

beforeEach(() => {
  apiMocks.get.mockImplementation((url: string) => {
    const data = RESPONSES[url];
    return data === undefined
      ? Promise.reject(new Error(`no fixture for ${url}`))
      : Promise.resolve({ data });
  });
});

afterEach(() => {
  cleanup();
});

describe("the add-contact name inputs above the sm breakpoint", () => {
  it("runs at a width the second column applies at", () => {
    expect(window.innerWidth).toBeGreaterThanOrEqual(640);
  });

  it("puts First name and Last name on one row", async () => {
    render(
      <MemoryRouter>
        <ContactsPage />
      </MemoryRouter>,
    );
    await userEvent.click(page.getByRole("button", { name: "+ Add Contact" }));

    const first = page
      .getByPlaceholder("First name", { exact: true })
      .element()
      .getBoundingClientRect();
    const second = page
      .getByPlaceholder("Last name", { exact: true })
      .element()
      .getBoundingClientRect();

    expect(second.top).toBe(first.top);
    expect(second.left).toBeGreaterThanOrEqual(first.right);
  });
});
