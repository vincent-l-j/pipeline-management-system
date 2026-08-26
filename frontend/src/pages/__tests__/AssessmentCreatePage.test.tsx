import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssessmentCreatePage from "../AssessmentCreatePage";
import { createApiMocks } from "../../test/mocks/api";

interface Assessment {
  id: string;
  pitch_id: string;
  version: number;
  recommendation: string;
  rationale: string;
  national_impact: number;
  translation_readiness: number;
  team_capability: number;
  ecosystem_fit: number;
  funding_pathway_clarity: number;
  masterplan_alignment: number;
}

const mockNavigate = vi.fn();
let mockSearch = "pitch_id=p1&from=a2";
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(mockSearch)],
  };
});

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const apiMocks = createApiMocks();

vi.mock("../../components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const LATEST: Assessment = {
  id: "a2",
  pitch_id: "p1",
  version: 2,
  recommendation: "proceed",
  rationale: "Strong national impact",
  national_impact: 4,
  translation_readiness: 4,
  team_capability: 4,
  ecosystem_fit: 4,
  funding_pathway_clarity: 4,
  masterplan_alignment: 4,
};

function setupGet() {
  apiMocks.get.mockImplementation((url: string) => {
    if (url === "/pitches")
      return Promise.resolve({ data: [{ id: "p1", title: "Solar Pitch" }] });
    if (url === "/assessments/a2") return Promise.resolve({ data: LATEST });
    return Promise.resolve({ data: [] });
  });
}

describe("AssessmentCreatePage (amend)", () => {
  beforeEach(() => {
    mockSearch = "pitch_id=p1&from=a2";
  });

  it("pre-fills the form from the version being amended", async () => {
    setupGet();
    render(<AssessmentCreatePage />);
    // Rationale is copied from the latest version.
    await waitFor(() => {
      expect(
        screen.getByDisplayValue("Strong national impact"),
      ).toBeInTheDocument();
    });
    // All six criteria pre-filled at 4 -> average 4.0 is shown.
    expect(screen.getByText("4.0")).toBeInTheDocument();
  });

  it("saving posts to /assessments and navigates to the new version", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.post.mockResolvedValue({ data: { id: "a3", version: 3 } });
    render(<AssessmentCreatePage />);
    await waitFor(() => screen.getByDisplayValue("Strong national impact"));

    await user.click(
      screen.getByRole("button", { name: /submit assessment/i }),
    );

    // When amending, the query parameter is passed to validate the pitch hasn't changed
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/assessments?amending_from_id=a2",
      expect.objectContaining({
        pitch_id: "p1",
        recommendation: "proceed",
        national_impact: 4,
        masterplan_alignment: 4,
      }),
    );
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/assessments/a3");
    });
  });

  it("cancelling makes no api.post call", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<AssessmentCreatePage />);
    await waitFor(() => screen.getByDisplayValue("Strong national impact"));

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(apiMocks.post.mock).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/assessments");
  });

  it("a plain create (no from param) starts blank", async () => {
    mockSearch = "pitch_id=p1";
    setupGet();
    render(<AssessmentCreatePage />);
    await waitFor(() =>
      screen.getByRole("button", { name: /submit assessment/i }),
    );
    expect(
      screen.queryByDisplayValue("Strong national impact"),
    ).not.toBeInTheDocument();
    expect(apiMocks.get.mock).not.toHaveBeenCalledWith("/assessments/a2");
  });
});

describe("AssessmentCreatePage decline reason", () => {
  beforeEach(() => {
    mockSearch = "pitch_id=p1";
    apiMocks.get.mockImplementation((url: string) => {
      if (url === "/pitches")
        return Promise.resolve({ data: [{ id: "p1", title: "Solar Pitch" }] });
      return Promise.resolve({ data: [] });
    });
  });

  async function scoreEverything(
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> {
    // Each criterion offers buttons 1-5; take the first "3" of each row.
    const threes = screen.getAllByRole("button", { name: "3" });
    for (const button of threes) await user.click(button);
  }

  it("offers no reason field until Decline is chosen", async () => {
    const user = userEvent.setup();
    render(<AssessmentCreatePage />);
    await waitFor(() => screen.getByText("Recommendation *"));

    expect(
      screen.queryByLabelText(/Reason for declining/),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Proceed" }));
    expect(
      screen.queryByLabelText(/Reason for declining/),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Decline" }));
    expect(screen.getByLabelText(/Reason for declining/)).toBeInTheDocument();
  });

  it("offers the six reasons", async () => {
    const user = userEvent.setup();
    render(<AssessmentCreatePage />);
    await waitFor(() => screen.getByText("Recommendation *"));
    await user.click(screen.getByRole("button", { name: "Decline" }));

    for (const label of [
      "Not a strategic priority",
      "Insufficient scale",
      "Insufficient capacity or capability",
      "Grant funding rejected",
      "Lack of Rozetta capacity",
      "Other",
    ]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("keeps the optional-reason note with the reason field", async () => {
    const user = userEvent.setup();
    render(<AssessmentCreatePage />);
    await waitFor(() => screen.getByText("Recommendation *"));
    await user.click(screen.getByRole("button", { name: "Decline" }));

    expect(
      screen.getByText(/Optional — it can be saved without one/),
    ).toBeInTheDocument();
  });

  it("sends the chosen reason", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({ data: { id: "new" } });
    render(<AssessmentCreatePage />);
    await waitFor(() => screen.getByText("Recommendation *"));

    await scoreEverything(user);
    await user.click(screen.getByRole("button", { name: "Decline" }));
    await user.selectOptions(
      screen.getByLabelText(/Reason for declining/),
      "insufficient_scale",
    );
    await user.click(
      screen.getByRole("button", { name: /Submit Assessment/i }),
    );

    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/assessments",
      expect.objectContaining({
        recommendation: "decline",
        decline_reason: "insufficient_scale",
      }),
    );
  });

  it("sends null, not an empty string, when no reason is chosen", async () => {
    // An empty string is not a valid enum member; the backend answers 422.
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({ data: { id: "new" } });
    render(<AssessmentCreatePage />);
    await waitFor(() => screen.getByText("Recommendation *"));

    await scoreEverything(user);
    await user.click(screen.getByRole("button", { name: "Decline" }));
    await user.click(
      screen.getByRole("button", { name: /Submit Assessment/i }),
    );

    const posted = (apiMocks.post.mock.mock.calls as unknown[][])[0][1] as {
      decline_reason: unknown;
    };
    expect(posted.decline_reason).toBeNull();
  });

  it("does not block saving a decline that has no reason", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({ data: { id: "new" } });
    render(<AssessmentCreatePage />);
    await waitFor(() => screen.getByText("Recommendation *"));

    await scoreEverything(user);
    await user.click(screen.getByRole("button", { name: "Decline" }));
    await user.click(
      screen.getByRole("button", { name: /Submit Assessment/i }),
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/assessments/new");
    });
  });

  it("drops a reason already chosen when the recommendation moves off Decline", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({ data: { id: "new" } });
    render(<AssessmentCreatePage />);
    await waitFor(() => screen.getByText("Recommendation *"));

    await scoreEverything(user);
    await user.click(screen.getByRole("button", { name: "Decline" }));
    await user.selectOptions(
      screen.getByLabelText(/Reason for declining/),
      "other",
    );
    await user.click(screen.getByRole("button", { name: "Proceed" }));
    await user.click(
      screen.getByRole("button", { name: /Submit Assessment/i }),
    );

    // A reason alongside Proceed is a contradiction the backend rejects.
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/assessments",
      expect.objectContaining({
        recommendation: "proceed",
        decline_reason: null,
      }),
    );

    // And choosing Decline again starts from blank, not the discarded value.
    await user.click(screen.getByRole("button", { name: "Decline" }));
    expect(screen.getByLabelText(/Reason for declining/)).toHaveValue("");
  });
});
