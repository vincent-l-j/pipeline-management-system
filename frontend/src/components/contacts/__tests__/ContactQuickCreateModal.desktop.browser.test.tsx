import { page } from "vitest/browser";
import { render } from "@testing-library/react";
import ContactQuickCreateModal from "../ContactQuickCreateModal";

describe("the create-contact dialog above the sm breakpoint", () => {
  it("runs at a width the second column applies at", () => {
    expect(window.innerWidth).toBeGreaterThanOrEqual(640);
  });

  it("puts First name and Last name on one row", () => {
    render(
      <ContactQuickCreateModal
        initialQuery=""
        organisationIds={[]}
        onCreated={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const first = page
      .getByLabelText("First name")
      .element()
      .getBoundingClientRect();
    const second = page
      .getByLabelText("Last name")
      .element()
      .getBoundingClientRect();

    expect(second.top).toBe(first.top);
    expect(second.left).toBeGreaterThanOrEqual(first.right);
  });
});
