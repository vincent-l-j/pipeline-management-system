# Frontend best practices — React + Vite tests + Tailwind

Conventions for `frontend/` in this repo (React 18, Vite 6, React Router 6,
Tailwind 3, Vitest). Match the existing components.

## Components

- Function components + hooks only. One component per file; `PascalCase.jsx`.
  The single exception is `src/components/ErrorBoundary.tsx`: React 18 exposes
  `getDerivedStateFromError` / `componentDidCatch` to class components only and
  offers no hook equivalent. Don't take it as licence for a second class
  component — anything else belongs in a function component.
- Pages live in `src/pages/`, reusable pieces in `src/components/` (grouped by
  area: `pipeline/`, `pitch/`, `meetings/`, `assessments/`), with the cross-area
  primitives — the `Combobox`, `OptionSelect` and `formStyles` fields share, and
  the `TableScroll` every list table sits in — in `ui/`. A `ui/` primitive depends
  on nothing outside `ui/`; that's what keeps it reusable across areas.
- Keep data-fetching in the page/container; pass plain props to presentational
  children (e.g. `KanbanColumn` → `PitchCard`).
- Wrap page content in the shared `Layout` + `PageHeader`. `Layout` is the app
  shell: it owns the navigation drawer's open/closed state, the mobile app bar
  and the backdrop, and positions the sidebar. `Sidebar` is presentational — it
  renders the nav items and user block, and takes an `onNavigate` callback the
  shell uses to close the drawer on a destination choice. Navigation behaviour
  is tested at the shell seam (`components/__tests__/Layout.test.tsx`, plus
  `Layout.browser.test.tsx` for what only a browser can see); page tests replace
  `Layout` with a plain wrapper, so they never see the drawer.

## Routing

- Routes are declared in `App.jsx`. Authenticated routes are wrapped in
  `ProtectedRoute` (redirects to `/login` when there's no token).
- **Admin-only routes need their own guard**, not just `ProtectedRoute` — a
  client redirect is UX, and must be backed by a server `403` (see security note).
- Use `useNavigate()` for programmatic navigation and `<Link>` for anchors.

## Talking to the backend

- **All HTTP goes through `src/services/api.js`.** It's a preconfigured axios
  instance (`baseURL: '/api'`) with interceptors that attach the bearer token and
  redirect to `/login` on `401`. Never call `fetch`/`axios` directly in a
  component.

```jsx
import api from "../services/api";

useEffect(() => {
  api
    .get("/pitches")
    .then(({ data }) => setPitches(data))
    .catch(() => setError("Could not load pitches"))
    .finally(() => setLoading(false));
}, []);
```

- Always handle three UI states: loading, empty, and error. The existing pages
  show the pattern (`loading ? … : items.length === 0 ? … : <table/>`).
- For optimistic updates (e.g. moving a Kanban card), update local state first,
  fire the request, and **revert on failure** — see `KanbanBoard.handleDragEnd`.

## Errors

Two handled paths, and they don't overlap:

- **A failed API call** inside a component is expected. Catch it, turn it into
  text with `apiErrorMessage(error, fallback)` from `services/apiError`, and
  render it in the page's error state.
- **An uncaught render error** is a bug. `ErrorBoundary`, mounted in `main.tsx`
  above the router and `AuthProvider`, replaces the blank page with a fallback
  and calls `reportClientError` to `POST /api/client-errors`, which _attempts_ to
  put the failure in the backend's log stream. That call never throws, never
  retries and ignores a second report while one is in flight — reporting must not
  be able to cause a second failure. A `401` on that request specifically does
  **not** trigger the usual redirect to `/login`; one render error must not
  become a surprise logout.
- **Neither path covers** a throw from an event handler, a `setTimeout` callback
  or an unhandled promise rejection: a boundary only catches errors thrown during
  render, and those failures currently reach nothing but the browser console.
  Handle them where they happen until window-level listeners exist.

- The report sends `window.location.pathname`, **never `location.href`**: the
  sign-in redirect carries a live JWT in `?token=`, and the report is written to
  the backend log at `ERROR`. That is politeness, not the control — the browser
  cannot be trusted with it, so the backend redacts credential-shaped values from
  every field of the report on the way in (`app/core/redaction.py`). Don't rely on
  it either: a message or stack still shouldn't be built out of secrets.
  Every field is capped to the backend's schema limit
  (message, url, stacks and the correlation id) — over the cap the whole report is
  a `422`, and losing the report is worse than losing its tail.
- `getLastRequestId()` returns the `X-Request-ID` of the most recent response. It
  is **best-effort**: with concurrent requests the last id may not belong to the
  call you have in mind. Good enough for "what happened just before the crash",
  wrong for a per-request banner — don't wire it into `apiErrorMessage`.

The report reaching the log stream is **best-effort, not a guarantee** — the
endpoint is authenticated, so a crash on the login page before a token exists is
rejected, and a report can be dropped by a network failure or by the reload that
follows. So the fallback states the outcome only once observed (reporting /
reported with the reference / could not be reported), never in advance. Its
reference is the id the `202` returns for the record just written, which is why
one shows even when no earlier request had been made; `getLastRequestId()` is
only the fallback for a report that produced none. The fallback's third action
clears `token`/`user` from `localStorage` and navigates to `/login`: reloading
and the dashboard link are both same-origin loads that re-run `AuthProvider`'s
`localStorage` parse, so neither escapes a crash caused by a corrupted session.

**A promise you fire and forget still needs a rejection branch.** `componentDidCatch`
chained `.then()` onto the report with no `.catch()`. Every assertion about it passed —
the session survived, no redirect fired — but the rejection escaped as an unhandled
one, which Vitest reports as an error and which fails `npm test` on the exit code
while every test still reads green. It also left the fallback stuck on "Reporting
this problem…" forever, the one thing that section says it must never do. `void
promise.then(...)` is not fire-and-forget; `void promise.then(...).catch(...)` is.

Testing a boundary needs **two** suppressions, not one: spy `console.error`
(React logs every error it catches) _and_ cancel the window `error` event React's
dev build re-throws. `clearMocks` calls `mockClear()`, which does not uninstall a
spy — restore the console spy explicitly in `afterEach` or it stays stubbed for
the rest of the file.

`mockClear()` doesn't drop an implementation either: a `mockReturnValue` set in
one test survives into the next, so restate each mock's default in `beforeEach`
instead of relying on the following test to overwrite it. Module-level state
(`services/api.ts` keeps the last request id in a module variable) survives too —
`vi.resetModules()` plus a dynamic `import()` in `beforeEach` gives each test a
fresh module. A test file whose result depends on its own order is a trap for
whoever inserts the next test.

## Auth & roles

- Read auth from `useAuth()` (`AuthContext`): `{ user, token, login, logout }`.
  `token`/`user` persist in `localStorage`.
- **Role-based UI gating is UX only, not security.** `user.role` comes from
  `localStorage` and is trivially editable. Hiding a button (`user.role === 'admin'`)
  improves the experience but the backend must independently reject the action.
  Never treat a hidden control as a protected one.

## Tailwind

- Utility-first: compose classes in `className`; avoid custom CSS. The only global
  stylesheet is `src/index.css` (Tailwind directives + print styles) — extend it
  only for cross-cutting concerns like print.
- Use the brand palette from `tailwind.config.js`: `navy` (primary, 50–950) and
  `amber` (accent). Prefer these over raw Tailwind colors for brand surfaces;
  semantic states (red/green) are fine for errors/success.
- Conditional classes via template strings; keep the conditional at the end:
  ```jsx
  className={`px-4 py-2 rounded-lg ${isActive ? 'bg-navy-800 text-white'
                                              : 'text-navy-200 hover:bg-navy-800/50'}`}
  ```
- Match spacing/rounding/border conventions of neighbouring components
  (`rounded-xl border border-navy-100`, `text-sm`, etc.) for visual consistency.
- Use `capitalize` / `line-clamp-*` utilities rather than transforming data.
- A data table goes inside `components/ui/TableScroll`, which scrolls it sideways
  on a narrow screen instead of letting it push the page past the viewport, and
  stops clipping on paper so the print-out is unchanged. Tables are not
  restructured into card stacks — the print stylesheet has table-specific rules.
  A scroll container clips on **both** axes, so anything that opens out of a row
  must claim its own flow room inside the container — `TableScroll` knows nothing
  about its content. `Combobox` does this: it renders a spacer the height of its
  own list while that list is open.

## Unit tests (Vitest + React Testing Library)

- Config: `vitest.config.js` (jsdom, `globals: true`, setup `src/test/setup.js`
  which imports `@testing-library/jest-dom`). Because `globals` is on, `describe`/
  `it`/`expect`/`vi` need no import.
- Location: co-located `__tests__/` next to the component under test.
- **One behaviour per test.** Each test should have one reason to fail; if you're
  rendering multiple times with different state in one test, split it. This applies
  especially to role-gated UI: write one case per role, not one test covering all
  roles. Where cases differ only in data — a list of field labels, nav links or
  stages — use `it.each` rather than a `for` loop inside a single `it`, so the
  report names the failing item instead of the whole test.
- **Assert whole lists, not per-item presence,** when the test claims to cover a
  vocabulary. `getByRole("option", …)` per value still passes once an extra value
  appears, so it can never mean "exactly"; compare the rendered list to an expected
  array instead. Spell that array out rather than deriving it from the constant the
  component renders — a test built from the same source as the code under test
  cannot fail when that source changes.
- **Mock the network** by mocking `src/services/api`:

```jsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import api from "../../services/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

it("removes a row after confirming delete", async () => {
  api.get.mockResolvedValue({ data: [{ id: "1", name: "Acme" }] });
  api.delete.mockResolvedValue({ data: { detail: "deleted" } });
  render(<OrganisationsPage />); // wrap with providers/router as needed

  await screen.findByText("Acme");
  await userEvent.click(screen.getByRole("button", { name: /remove/i }));
  await userEvent.click(screen.getByRole("button", { name: /confirm/i }));

  expect(api.delete).toHaveBeenCalledWith("/organisations/1");
  await waitFor(() =>
    expect(screen.queryByText("Acme")).not.toBeInTheDocument(),
  );
});
```

Guidelines:

- Query the way a user perceives the UI: `getByRole`, `getByText`, `getByLabelText`
  — avoid test-ids unless there's no accessible handle.
- Use `findBy*` / `waitFor` for anything after an async resolve; use
  `queryBy*` to assert absence.
- Drive interactions with `@testing-library/user-event`, not raw `fireEvent`.
- **Testing role-gated UI:** render with a mocked `useAuth` returning each role and
  assert presence/absence of controls (this validates the UX, while the backend
  test validates the actual security boundary).
- **Router-dependent components:** wrap in `<MemoryRouter>` (and `initialEntries`
  for route-guard tests), or mock `useNavigate` from `react-router-dom` to assert
  navigation.
- **Drag-and-drop:** `@hello-pangea/dnd` is aliased to a stub (`src/test/mocks/dnd.js`)
  in `vitest.config.js`; test the stage-change _handler/callback_, not the drag
  physics.
- **Assert on what the component rendered or the helper sent, not on what the test
  arranged.** A mock's own return value, a stubbed prop echoed back, or a fixture's
  own contents will all pass against a gutted implementation. When you assert a
  request was made, assert the payload the code built — not the object the mock was
  primed with. The check to apply: if you deleted the behaviour, would this fail?

## Real-browser tests (Vitest browser mode)

There are two suites, and which one an assertion belongs in is decided by whether
it depends on CSS — not by how important it is.

| The assertion is about                                              | Seam                             |
| ------------------------------------------------------------------- | -------------------------------- |
| Rendered text, roles, accessible names, `aria-*` state              | jsdom (`npm test`)               |
| What a handler did — navigation, a callback, a request payload      | jsdom                            |
| Which items a list contains, and role-gated presence/absence        | jsdom                            |
| Stacking order — whether a control is actually reachable by pointer | browser (`npm run test:browser`) |
| `print:` rules and anything else inside a media query               | browser                          |
| Breakpoint gating: what a 360px viewport shows                      | browser                          |
| Measured geometry — touch-target size, overflow, scroll width       | browser                          |
| What a _touchscreen_ does, as opposed to a mouse                    | browser                          |

- **jsdom has no layout engine and applies no stylesheet.** It cannot see any of
  the right-hand column, so an assertion put there does not fail — it passes
  vacuously. Don't grow the jsdom suite towards layout; move the assertion.
- Config `vitest.browser.config.ts`, Chromium via Playwright, viewport pinned to
  the 360px design floor. Files are `*.browser.test.tsx` beside their jsdom
  neighbours; `vitest.config.ts` excludes that glob so the two run side by side.
- **`css: true` is load-bearing.** Vitest stubs CSS imports out by default, and a
  browser suite without the stylesheet asserts nothing while still passing.
- Drive interaction with `userEvent` from `vitest/browser`, not
  `@testing-library/user-event`. Only the former issues a real click, and a real
  click is what fails when something is painted over the control — the dispatched
  kind flips the handler regardless and is why this class of bug shipped.
- Query with `page.getByRole(...)`; use `expect.element(...)` so assertions retry.
- **Assert what renders, never how long it takes.** The setup file zeroes
  transition and animation durations; no test should wait one out.
- A `scrollWidth` assertion only guards **in-flow** content. Fixed and absolute
  boxes never contribute to it, so it cannot catch an over-wide drawer or modal.
- Don't duplicate the jsdom suite here. The browser suite asserts that navigation
  items are big enough to tap; _which_ destinations exist stays in jsdom.

### Touch

The context sets `hasTouch`, so a tap can be dispatched for real rather than
approximated with a click. This matters wherever a handler is wired to a mouse
event: a tap fires `pointerdown`, `touchstart`, `pointerup`, `touchend` and only
_then_ the compatibility `mousedown`, so anything racing a blur is being asked to
work off an event that arrives after the finger has lifted.

- `commands.tap(selector)` is a real tap. `userEvent.click` is a mouse and will
  pass where a finger fails.
- `commands.touchDrag(from, to)` is a finger that rolls between touchdown and
  lift — a tap Chromium still counts as a tap.
- Both take coordinates **as the test frame measures them**; `touchDrag` adds the
  tester iframe's own offset back before handing them to CDP, because CDP
  addresses the top-level page.
- `hasTouch` on its own is enough. It already reports `pointer: coarse`,
  `hover: none` and `maxTouchPoints: 1`, and the tester page already carries
  `width=device-width`, so adding `isMobile` changes nothing measurable — it does
  not change the user agent either.
- **Playwright cannot emulate Android.** Its device descriptors (`devices['Pixel
5']`) are Chrome device emulation — a user agent, a viewport and these same two
  flags — and its `_android` API is an adb client that drives a real phone or
  emulator rather than providing one. Neither gives a soft keyboard.
- **A finger cannot scroll an `overflow-auto` box inside the page.** Neither raw
  touch drags nor CDP's synthesized scroll gestures reach the tester iframe, so
  the box stays where it is however convincing the gesture looks. Don't read that
  as a component bug.
- **A wheel can.** `commands.scrollX(selector, by)` hovers the element and turns
  a mouse wheel, which Playwright does route into the frame. A wheel is not a
  finger, but a clipped box refuses it exactly as it refuses a finger, so it
  still tells a table that scrolls apart from one that merely hides its last
  columns. Assigning `scrollLeft` tells them apart from nothing: a clipped box
  scrolls from script just as well as a scrolling one.
- There is **no soft keyboard** in headless Chromium, and `page.setViewportSize`
  does not reach the tester iframe either, so neither the keyboard's focus
  behaviour nor the viewport it steals can be asserted. Route those to a manual
  step.

Where behaviour depends on CSS and no test can reach it, write the manual step
down with its viewport and expected result. "Untestable" describes a toolchain,
not a behaviour, and recording it as the latter is what stops the gap closing.

### Manual steps

Checks no suite here can reach. Run them on a real device or the Android
emulator when touching the component named.

| Component     | Step                                                                                                         | Viewport / device       | Expected                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------- |
| `Combobox`    | Tap the field to raise the soft keyboard, then tap an option                                                 | Android, any phone size | The keyboard opening does not close the list; the tapped option is committed     |
| `Combobox`    | With the soft keyboard up, open a list longer than the space above it and scroll to the last row             | Android, any phone size | The list is reachable and scrolls; it is not rendered behind the keyboard        |
| `TableScroll` | Print a list page (pitches, contacts, organisations, assessments, meetings, reports, admin, pipeline) to PDF | Desktop Chrome          | Every page prints exactly as it did before the table gained its scroll container |

## Checklist before handoff

- [ ] All network access via `services/api.js`; loading/empty/error states handled.
- [ ] Role-gated controls hidden appropriately (and known to be UX, not security).
- [ ] Brand palette + neighbouring-component styling matched.
- [ ] Tests co-located, `api` mocked, queried by role/text, and passing via
      `cd frontend && npm test`.
- [ ] Anything CSS-dependent routed by the seam table above — to the browser
      suite, or to a manual step written down with its viewport.
