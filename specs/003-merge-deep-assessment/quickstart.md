# Quickstart: validate Merge Deep Assessment into Due Diligence

Prerequisites, commands and the browser setup are as in
[#160's quickstart](../002-remove-received-stage/quickstart.md).

## Retire release, on the running stack

1. `POST /api/pitches {"title":"x","current_stage":"deep_assessment"}` → 422 naming Deep
   Assessment as retired (US1-1). `POST /api/pitches/{id}/stage
{"new_stage":"deep_assessment"}` → 422, history unchanged (US1-2).
2. On `/pipeline`, a card's stage menu offers Due Diligence and no Deep Assessment, and the
   stage filter has no Deep Assessment (US1-3, US1-4).
3. Put one pitch in Deep Assessment in the local database
   (`UPDATE pitches SET current_stage='DEEP_ASSESSMENT' WHERE id='<id>'`) and note the
   dashboard's "advanced to assessment". Reload `/pipeline`: a **Deep Assessment (retired)**
   column sits between Discovery Meeting and Due Diligence (US2-1). A drop onto it is refused
   (US2-4). The reports filter still has no Deep Assessment (US1-4). The pitches list, list
   view, detail page and reports table say Deep Assessment, the dashboard lists it with
   count 1, and "advanced to assessment" counts it (US2-5 to US2-7).
4. Drag it to Due Diligence: it moves, and the column disappears (US2-2, US2-3).

## Drop release

1. The migration suite's data-safety test for the drop revision passes (US3-1 to US3-4).
2. After `alembic upgrade head`: no `DEEP_ASSESSMENT` in either table, a request naming it →
   422, no retired column (US3-5), and "advanced to assessment" is unchanged (US3-6).
