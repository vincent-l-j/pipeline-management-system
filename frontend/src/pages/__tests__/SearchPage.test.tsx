import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchPage from "../SearchPage";
import { createApiMocks } from "../../test/mocks/api";

interface SearchResult {
  id: string;
  type: string;
  title: string;
}

interface SearchResults {
  total: number;
  pitches: SearchResult[];
  organisations: SearchResult[];
  contacts: SearchResult[];
  meetings: SearchResult[];
  assessments: SearchResult[];
}

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => mockNavigate };
});

vi.mock("../../services/api", () => ({
  default: { get: vi.fn() },
}));

const apiMocks = createApiMocks();

vi.mock("../../components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// The /api/search response tags each result with a SINGULAR type.
const RESULTS: SearchResults = {
  total: 5,
  pitches: [{ id: "p1", type: "pitch", title: "Solar Pitch" }],
  organisations: [{ id: "o1", type: "organisation", title: "Acme Org" }],
  contacts: [{ id: "c1", type: "contact", title: "Jane Contact" }],
  meetings: [{ id: "m1", type: "meeting", title: "Kickoff Meeting" }],
  assessments: [{ id: "a1", type: "assessment", title: "Q1 Assessment" }],
};

// All result types mapped to their expected detail routes.
const RESULT_ROUTES: [string, string][] = [
  ["Acme Org", "/organisations/o1"],
  ["Jane Contact", "/contacts/c1"],
  ["Kickoff Meeting", "/meetings/m1"],
  ["Q1 Assessment", "/assessments/a1"],
  ["Solar Pitch", "/pitches/p1"],
];

function setup() {
  apiMocks.get.mockResolvedValue({ data: RESULTS });
}

async function search(user: ReturnType<typeof userEvent.setup>, term: string) {
  await user.type(screen.getByRole("textbox"), term);
  // Wait past the 400ms debounce for results to render.
  await screen.findByText("Solar Pitch");
}

function isValidDetailRoute(path: string): boolean {
  return (
    !path.startsWith("/undefined") &&
    path.split("/").filter(Boolean).length === 2
  );
}

describe("SearchPage result navigation", () => {
  it("clicking a pitch result navigates to /pitches/{id}, not the dashboard", async () => {
    const user = userEvent.setup();
    setup();
    render(<SearchPage />);
    await search(user, "solar");

    await user.click(screen.getByText("Solar Pitch"));
    expect(mockNavigate).toHaveBeenCalledWith("/pitches/p1");
    // Regression guard: the pitch must not resolve to the dashboard/home.
    expect(mockNavigate).not.toHaveBeenCalledWith("/p1");
    expect(mockNavigate).not.toHaveBeenCalledWith("/");
  });

  it.each(RESULT_ROUTES)(
    'result "%s" routes to %s',
    async (title, expectedPath) => {
      const user = userEvent.setup();
      setup();
      render(<SearchPage />);
      await search(user, "query");

      await user.click(screen.getByText(title));
      expect(mockNavigate).toHaveBeenCalledWith(expectedPath);
    },
  );

  it.each(RESULT_ROUTES)(
    'result "%s" has a valid detail route (not undefined)',
    async (title) => {
      const user = userEvent.setup();
      setup();
      render(<SearchPage />);
      await search(user, "xy");

      await user.click(screen.getByText(title));
      const navigateCalls = mockNavigate.mock.calls as unknown[][];
      const navigatePath = navigateCalls[0][0];
      expect(isValidDetailRoute(navigatePath as string)).toBe(true);
    },
  );
});
