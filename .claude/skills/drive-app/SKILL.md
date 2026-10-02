---
name: drive-app
description: Launch and drive Rozetta PMS in a real browser from the devcontainer. Use when asked to run, start, open, click around, or screenshot the app, or to confirm a change works against the running stack rather than only in tests.
---

# Drive the app

The stack is already running — `db`, `backend` and `frontend` come up with the
devcontainer. There is nothing to start.

Read **`docs/agents/local-testing.md`** and follow it. It carries the address
(`http://frontend:5173`, never `localhost`), the dev-login seeding and its
`JSON.stringify` trap, the baked-in Chromium and its two Playwright gotchas, the
viewports to run, and where each kind of finding goes.
