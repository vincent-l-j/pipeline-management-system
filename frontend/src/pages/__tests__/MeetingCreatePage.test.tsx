import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MeetingCreatePage from "../MeetingCreatePage";
import { createApiMocks } from "../../test/mocks/api";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams("")],
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

function setupGet() {
  apiMocks.get.mockResolvedValue({
    data: [
      { id: "p1", title: "Solar Pitch" },
      { id: "p2", title: "Soil Sensors" },
    ],
  });
}

async function renderPage() {
  setupGet();
  render(<MeetingCreatePage />);
  await waitFor(() => screen.getByText("Log New Meeting"));
}

describe("MeetingCreatePage", () => {
  it("labels the pitch and platform selects so they are reachable by name", async () => {
    await renderPage();

    expect(
      screen.getByRole("combobox", { name: "Linked Pitch *" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Platform" }),
    ).toBeInTheDocument();
  });

  it("offers every fetched pitch when the pitch field is opened", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("combobox", { name: "Linked Pitch *" }));

    expect(
      within(screen.getByRole("listbox"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Solar Pitch", "Soil Sensors"]);
  });

  it("narrows the pitches to those matching the typed text", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(
      screen.getByRole("combobox", { name: "Linked Pitch *" }),
      "sens",
    );

    expect(
      within(screen.getByRole("listbox"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Soil Sensors"]);
  });

  it("logs the meeting against the pitch chosen by typing", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({ data: { id: "m1" } });
    await renderPage();
    await user.type(
      screen.getByRole("textbox", { name: "Meeting Title *" }),
      "Discovery call",
    );

    await user.type(
      screen.getByRole("combobox", { name: "Linked Pitch *" }),
      "soil",
    );
    await user.click(screen.getByRole("option", { name: "Soil Sensors" }));
    await user.click(screen.getByRole("button", { name: "Save Meeting" }));

    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/meetings",
      expect.objectContaining({ pitch_id: "p2" }),
    );
  });

  it("does not log a meeting whose pitch was typed but never chosen", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.type(
      screen.getByRole("textbox", { name: "Meeting Title *" }),
      "Discovery call",
    );

    await user.type(
      screen.getByRole("combobox", { name: "Linked Pitch *" }),
      "soil",
    );
    await user.click(screen.getByRole("button", { name: "Save Meeting" }));

    expect(apiMocks.post.mock).not.toHaveBeenCalled();
  });

  it("keeps the platform a native select, its vocabulary being short and fixed", async () => {
    await renderPage();

    expect(screen.getByRole("combobox", { name: "Platform" }).tagName).toBe(
      "SELECT",
    );
  });

  it("announces a failed save to assistive technology", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockRejectedValue({
      response: { status: 500, data: { detail: "Database unavailable" } },
    });
    await renderPage();
    await user.type(
      screen.getByRole("textbox", { name: "Meeting Title *" }),
      "Discovery call",
    );
    await user.type(
      screen.getByRole("combobox", { name: "Linked Pitch *" }),
      "soil",
    );
    await user.click(screen.getByRole("option", { name: "Soil Sensors" }));

    await user.click(screen.getByRole("button", { name: "Save Meeting" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Database unavailable",
    );
  });

  // No blank option: the platform always holds a real value, so offering an
  // empty one would let a meeting be logged with no platform at all.
  it("starts on a real platform and offers no blank option", async () => {
    await renderPage();
    const select = screen.getByRole("combobox", { name: "Platform" });

    expect(select).toHaveValue("teams");
    expect(
      Array.from(select.querySelectorAll("option")).map((o) => o.textContent),
    ).toEqual(["Microsoft Teams", "Zoom", "In Person", "Phone", "Other"]);
  });

  it("requires a linked pitch", async () => {
    await renderPage();
    expect(
      screen.getByRole("combobox", { name: "Linked Pitch *" }),
    ).toBeRequired();
  });
});
