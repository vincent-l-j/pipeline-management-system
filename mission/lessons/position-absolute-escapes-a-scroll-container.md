### A positioned descendant escapes the scroll container it is not positioned in

Observed: the contacts table gained a horizontal scroll container, and its own
browser test measured no viewport overflow — but on a phone the Actions column
still ran off the page and the whole screen scrolled sideways once a row was
being edited. `documentElement.scrollWidth` read 709 against a 360 viewport while
`body.scrollWidth` read 360, and every element inside the container was clipped
as intended.
Root cause: `sr-only` is `position: absolute`. The organisation picker's hidden
label had no positioned ancestor, so its containing block was the initial one —
the page, not the scroll container. `overflow` clips a descendant only when the
container is also an ancestor of that descendant's containing block, so the label
kept its static position inside the 1147px-wide table, sat at x=708, and widened
the document to fit. One 1px label that nobody can see set the page's scroll
width.
Rule: name a control with `aria-label` on the control itself, not with a visually
hidden `<label>`. The hidden label buys nothing here — it cannot be clicked, so
its one advantage over `aria-label` is spent — and it costs an absolutely
positioned element that any future scroll container will fail to clip. Testing
queries by accessible name, so `getByRole("combobox", { name })` does not notice
the difference. Where a positioned element genuinely must exist inside a scroll
container, it needs a `relative` ancestor within that container; adding one
merely to corral a hidden label is treating the symptom.
Check: naming a control with `sr-only`, or wrapping existing markup in an
`overflow-x-auto` container without grepping the subtree for `sr-only`,
`absolute` or `fixed`.
Note: the shipped test passed because its fixture held a single contact. Editing
the only row replaces every cell's text with inputs, the columns collapse to fit
them, and the far side of the table lands back inside 360px — so the escape had
nothing to stick out past. A second row is what keeps the table its real width
while one row is edited, and it is what makes the assertion bite. A layout test
whose fixture has one row is testing the narrow case, not the real one.
