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
  field primitives — `Combobox`, `OptionSelect`, and the `formStyles` they share
  — in `ui/`. A `ui/` primitive depends on nothing outside `ui/`; that's what
  keeps it reusable across areas.
- Keep data-fetching in the page/container; pass plain props to presentational
  children (e.g. `KanbanColumn` → `PitchCard`).
- Wrap page content in the shared `Layout` + `PageHeader`.

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

## Checklist before handoff

- [ ] All network access via `services/api.js`; loading/empty/error states handled.
- [ ] Role-gated controls hidden appropriately (and known to be UX, not security).
- [ ] Brand palette + neighbouring-component styling matched.
- [ ] Tests co-located, `api` mocked, queried by role/text, and passing via
      `cd frontend && npm test`.
