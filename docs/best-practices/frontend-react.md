# Frontend best practices — React + Vite tests + Tailwind

Conventions for `frontend/` in this repo (React 18, Vite 6, React Router 6,
Tailwind 3, Vitest). Match the existing components.

## Components

- Function components + hooks only. One component per file; `PascalCase.jsx`.
- Pages live in `src/pages/`, reusable pieces in `src/components/` (grouped by
  area: `pipeline/`, `pitch/`, `meetings/`, `assessments/`).
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
import api from '../services/api'

useEffect(() => {
  api.get('/pitches')
    .then(({ data }) => setPitches(data))
    .catch(() => setError('Could not load pitches'))
    .finally(() => setLoading(false))
}, [])
```

- Always handle three UI states: loading, empty, and error. The existing pages
  show the pattern (`loading ? … : items.length === 0 ? … : <table/>`).
- For optimistic updates (e.g. moving a Kanban card), update local state first,
  fire the request, and **revert on failure** — see `KanbanBoard.handleDragEnd`.

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
- **Mock the network** by mocking `src/services/api`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

beforeEach(() => vi.clearAllMocks())

it('removes a row after confirming delete', async () => {
  api.get.mockResolvedValue({ data: [{ id: '1', name: 'Acme' }] })
  api.delete.mockResolvedValue({ data: { detail: 'deleted' } })
  render(<OrganisationsPage />)          // wrap with providers/router as needed

  await screen.findByText('Acme')
  await userEvent.click(screen.getByRole('button', { name: /remove/i }))
  await userEvent.click(screen.getByRole('button', { name: /confirm/i }))

  expect(api.delete).toHaveBeenCalledWith('/organisations/1')
  await waitFor(() => expect(screen.queryByText('Acme')).not.toBeInTheDocument())
})
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
  in `vitest.config.js`; test the stage-change *handler/callback*, not the drag
  physics.

## Checklist before handoff

- [ ] All network access via `services/api.js`; loading/empty/error states handled.
- [ ] Role-gated controls hidden appropriately (and known to be UX, not security).
- [ ] Brand palette + neighbouring-component styling matched.
- [ ] Tests co-located, `api` mocked, queried by role/text, and passing via
      `cd frontend && npm test`.
