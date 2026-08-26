import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

  it("offers the fetched pitches behind a placeholder", async () => {
    await renderPage();
    const select = screen.getByRole("combobox", { name: "Linked Pitch *" });

    await waitFor(() => {
      expect(
        Array.from(select.querySelectorAll("option")).map((o) => o.textContent),
      ).toEqual(["Select a pitch...", "Solar Pitch", "Soil Sensors"]);
    });
  });

  it("reports the chosen pitch by id", async () => {
    const user = userEvent.setup();
    await renderPage();
    const select = screen.getByRole("combobox", { name: "Linked Pitch *" });
    await waitFor(() => screen.getByRole("option", { name: "Soil Sensors" }));

    await user.selectOptions(select, "p2");
    expect(select).toHaveValue("p2");
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
