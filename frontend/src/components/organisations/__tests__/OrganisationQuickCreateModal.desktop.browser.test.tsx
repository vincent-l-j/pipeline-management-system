import { page } from "vitest/browser";
import { render } from "@testing-library/react";
import OrganisationQuickCreateModal from "../OrganisationQuickCreateModal";

describe("the create-organisation dialog above the sm breakpoint", () => {
  it("runs at a width the second column applies at", () => {
    expect(window.innerWidth).toBeGreaterThanOrEqual(640);
  });

  it("puts Type and State/Territory on one row", () => {
    render(
      <OrganisationQuickCreateModal
        initialName=""
        onCreated={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const first = page.getByLabelText("Type").element().getBoundingClientRect();
    const second = page
      .getByLabelText("State/Territory")
      .element()
      .getBoundingClientRect();

    expect(second.top).toBe(first.top);
    expect(second.left).toBeGreaterThanOrEqual(first.right);
  });
});
