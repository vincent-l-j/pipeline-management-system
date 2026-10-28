# Contract: `stage_entered_at` on `PitchOut`

Every route that returns a `PitchOut` (`GET /api/pitches`, `GET /api/pitches/{id}`,
`POST /api/pitches`, `PATCH /api/pitches/{id}`, `POST /api/pitches/{id}/stage`) adds:

```json
{ "stage_entered_at": "2026-07-30T04:12:09.123456Z" }
```

- Always present and never null (falls back to `created_at`).
- After `POST /api/pitches/{id}/stage`, it equals the new history row's `changed_at`.
- After `PATCH`, it is unchanged.
- A client cannot set it; sending it in a request body is ignored like any unknown field.
- Visible to every role that can read the pitch. It reveals nothing beyond what
  `GET /api/pitches/{id}/history` already shows the same roles.
