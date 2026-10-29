# Quickstart: validate Remove the Received Pipeline Stage

Prerequisites: the stack is up (`docker compose up --build`), with the `db` service running.
Commands are in `services.yaml`. The browser address and viewports are in
`docs/agents/local-testing.md`.

## Suites

- Backend: `cd backend && pytest` (includes the migration suite for the drop release).
- Frontend: `cd frontend && npm test`. Then `npm run lint` and `npm run typecheck` from the
  repo root.

## Retire release, on the running stack

1. Sign in as an admin and create a pitch from **New Pitch**. Its detail page shows
   **Initial Screen**, and its activity shows it was created there (US1-1).
2. Call the API as that user:
   `POST /api/pitches {"title":"x","current_stage":"received"}` → 422 naming Received as
   retired (US1-2). `POST /api/pitches/{id}/stage {"new_stage":"received"}` → 422, and the
   pitch's history is unchanged (US1-3).
3. On `/pipeline`, right-click a card. The menu has no Received (US1-4). The stage filter
   has no Received (US1-5). With no Received pitches, the dashboard breakdown and the reports
   filter have no Received either (US1-5).
4. Put one pitch in Received directly in the local database (the API refuses), e.g.
   `UPDATE pitches SET current_stage='RECEIVED' WHERE id='<id>'`. Reload `/pipeline`. A
   **Received (retired)** column holds it (US2-1). Drag another card onto it: it doesn't
   accept the drop (US2-4). Drag the Received card to Initial Screen: it moves, and the
   column disappears (US2-3, US2-2).
5. With a pitch back in Received: `/pitches`, the pipeline list view, the pitch detail page
   and the reports table all show the **Received** label, and the dashboard breakdown lists
   Received with count 1 (US2-5, US2-6).

## Drop release

1. The migration suite's data-safety test for the drop revision passes (US3-1 to US3-4).
2. On the running stack after `alembic upgrade head`:
   `SELECT count(*) FROM pitches WHERE current_stage::text='RECEIVED'` errors or returns 0,
   and the same goes for `pitch_stage_history`. `POST .../stage {"new_stage":"received"}` → 422
   (US3-5). `/pipeline` shows no Received column.
