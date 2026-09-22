### "jsdom can't see it" is not "it can't be tested"

Observed: the navigation drawer shipped three CSS-dependent defects and the test
suite caught none of them. The backdrop shared a stacking level with the top app
bar and came later in the DOM, so it painted over the menu toggle — a control
reporting `aria-expanded="true"` that no one could tap. The print stylesheet hides
`aside`, which never covered the new app bar, so every printed page gained a navy
bar. And the close animation never played: only `transform` was transitioned while
the `visibility` flip that keeps the closed drawer out of the tab order took effect
immediately. Two were caught by review, the third by a question.
Root cause: the suite runs in jsdom, which has no layout engine and applies no
stylesheet, so the tests assert the state (`aria-expanded`, backdrop present) and
nothing about what that state renders as. That much is a known limit. The damage
came from recording the limit as "not testable", which reads as a property of the
behaviour and stops the search — a real browser observes every one of these:
pointer interception fails an intercepted click, print media can be emulated, the
viewport can be set to the design floor, computed transitions can be read.
Rule: when behaviour depends on CSS — stacking order, print rules, breakpoint
gating, transitions, touch-target size — name the environment that can observe it
and route it there: a real-browser test, or a manual step written down with its
viewport and expected result. "Untestable" describes a toolchain, never a
behaviour, and the distinction decides whether the gap ever closes.
Check: a diff that adds a `z-index`, a `position`, a breakpoint variant, a `print:`
variant or a transition, with neither a browser test nor a named manual step.
