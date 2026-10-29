# Quickstart: validate Hide Long-Closed Pitches from the Pipeline

Prerequisites and the browser setup are as in `docs/agents/local-testing.md`; commands are in
`services.yaml`.

## Suites

`cd backend && pytest`, `cd frontend && npm test`, `npm run test:browser`, then `npm run
lint`, `npm run typecheck` and `npm run format:check`.

## On the running stack

1. Create four pitches and move them to Declined, Completed, Declined and Parked. Backdate the
   first two pitches' latest history rows, and the Parked pitch's, to 91 days ago in the local
   database (`UPDATE pitch_stage_history SET changed_at = now() - interval '91 days' WHERE
pitch_id = '<id>' AND to_stage = '<STAGE>'`). Backdate the third pitch's `created_at` by
   200 days but leave its decline recent.
2. `GET /api/pitches`: each pitch has `stage_entered_at`, and the backdated ones are 91 days
   old (contract).
3. Open `/pipeline`: the first two are on neither the board nor the list view, and the third
   and the Parked one are shown (US1-1 to US1-5). The header count matches what's shown
   (US1-7). A "Show old pitches" button is there (US2-1).
4. Press it: both appear, the URL has `?closed=show`, and a reload keeps them (US2-3, US2-4).
   Press it again to hide them.
5. Search for a hidden pitch's title, open it by its link, and check `/pitches`, the dashboard
   and the reports: it's in all of them (US2-5).
6. With hidden pitches shown, drag the hidden Declined pitch to Initial Screen: after hiding
   again it stays visible (US1-6).
7. In the driven browser, make `/api/pitches` fail (Playwright `page.route`) and reload
   `/pipeline`: an error with "Try again" shows rather than an empty board, and "Try again"
   recovers once the route is let through (A5).
