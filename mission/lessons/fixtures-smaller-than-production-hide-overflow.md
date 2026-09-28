### A fixture smaller than production data hides the bug it was written to catch

Observed: the dashboard's "Pitches Received per Month" chart ran 190px past the
viewport and well outside its card at 360px — reported from the running app, while
`ListPages.browser.test.tsx` held a green "the dashboard does not overflow the
viewport" test over the same page.
Root cause, two layers. The layout one: the bars row is `flex` and each column is
`flex-1`, but a flex item's default `min-width: auto` refuses to shrink below its
content's intrinsic width, and the month label was `whitespace-nowrap`. Each column
took a 35px floor `flex-1` could not undercut, so twelve of them measured 509px
inside a 278px card. The test one, which is the reusable half: the velocity fixture
carried **two** months where `/reports/velocity` returns up to twelve
(`sorted_months[-12:]`). Two bars fit any width. The assertion was right and the
arrangement never reached the condition it asserted about.
Rule: size a fixture from the endpoint that fills it, not from what is convenient to
type — read the route for the bound (`[-12:]`, a page size, a limit) and use it. A
list fixture with one or two rows is the shape most likely to pass a test about
crowding, which is exactly what such a test exists to fail on.
Check: a test named for a limit — overflow, wrapping, truncation, pagination — whose
fixture holds fewer items than the endpoint's own cap. Also `flex-1` on an item that
must shrink: it needs `min-w-0`, or a child narrow enough to stay under the floor.
Note: `-rotate-45` on the label was a red herring both ways. Transforms do not affect
layout, so it never caused the overflow, and removing it did not fix one — the labels
shrank to `Jan`/`Feb` and the row fit. Reach for the measurement (`scrollWidth` vs
`clientWidth`) before the stylesheet. The `sr-only` rule already in
`docs/best-practices/frontend-react.md` (Components) is the sibling case: there too
the culprit was a property that looks inert until something wraps it.
