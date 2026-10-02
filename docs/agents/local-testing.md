# Driving the running app

How to use the app the way a person does — from inside the devcontainer, in a real
browser — and what to do with what that turns up. The suites answer "does the code
do what the test says". This answers "what does a user experience", which catches
two things they cannot: a test that is wrong or too small — bad assertion, bad
setup, fixture lighter than production — and whatever nobody thought to assert.
One example: a chart ran 190px past the viewport while a green browser test
asserted the same page did not overflow.

## The address

**`http://frontend:5173`.** The compose service, by name, over `appnet`. Vite
proxies `/api` to `backend:8000`, so one address covers the whole app.

`localhost:5173` is the host-side forward from `devcontainer.json` — it is your
browser's address, not this container's. Inside `app` it is either nothing or
somebody's stray dev server, which serves the same bind-mounted source under a
different environment: no `VITE_ENABLE_DEV_LOGIN`, so the Dev Login button is
missing and looks like an application bug. Use the service name and the question
never arises.

The service name is safe for a structural reason, not by convention: `frontend`
is a DNS name that resolves to the sibling container, so a process bound inside
`app` cannot intercept it however it binds. `localhost` offers no such guarantee
— it is whatever claimed the port first, and for several hours it was a stray.

If that address answers **`Blocked request. This host ("frontend") is not
allowed.`**, the running Vite started before `allowedHosts` reached its config —
the entry is in the file, the server predates it. `touch frontend/vite.config.ts`
trips the config watcher and Vite restarts with it. Reach for that before
concluding the stack is down: a 403 on the one address you were told to use reads
exactly like a dead service, and the app is fine.

## Signing in

`/login` carries a **Dev Login (Admin)** button locally. Click it like a user
would.

To skip straight to a signed-in page, seed what that button's handler writes:

```js
const { access_token, user } = await (
  await page.request.get("http://frontend:5173/api/auth/dev-token")
).json();
await page.evaluate(
  ([t, u]) => {
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u));
  },
  [access_token, user], // the object — AuthContext stringifies it for you
);
```

Pass `user` as the object. Stringify it yourself and it round-trips to a _string_,
`user.role` reads `undefined`, and every role-gated control — New Pitch, Edit,
the admin nav — silently disappears. That looks exactly like an authorization bug.

## The browser

The image bakes in a Chromium for `npm run test:browser` — `services.yaml` has the
why and the rebuild caveat. Drive that same one through
`frontend/node_modules/playwright`; nothing needs installing.

Two things that cost a session each:

- **Import Playwright by absolute path** from a script outside the repo — Node
  resolves packages from the script's own directory, not the cwd:
  `import { chromium } from "/workspace/frontend/node_modules/playwright/index.mjs"`.
- **`browser.close()` on a `connect()`ed browser closes the browser**, not just
  your connection. To carry a session across separate scripts, write
  `context.storageState({ path })` to disk and restore it, rather than keeping a
  browser alive.

A single script per flow, launching its own browser, is the simplest thing that
works:

```js
import { chromium } from "/workspace/frontend/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
page.on("response", (r) => {
  if (r.url().includes("/api/") && r.status() >= 400)
    console.log(r.status(), r.url());
});
await page.goto("http://frontend:5173/pitches");
await page.screenshot({ path: "/tmp/shot.png" });
await browser.close();
```

## Driving it

Walk a whole path — nav, form, submit, result — not one route in isolation. Read
every screenshot you take; a blank frame is a failed launch, not a pass.

Run each path at **390x844**, **768x1024** and **1280x900**. Most layout bugs here
are phone-only and most of the app is built desk-first — but `md:` is the
breakpoint this app leans on hardest and neither 390 nor 1280 lands inside its
band. 1280 does apply `md:` styles, so the flip itself gets covered either way;
what the obvious pair misses is anything sized to overflow at 768 and not at 1280.

Do not sweep widths pixel by pixel. When a change is gated on one breakpoint, drive
the two widths either side of that one — 767 and 768 for `md:` — and if the
behaviour is meant to hold, pin it with a browser test rather than a drive, where
the assertion is exact and the next change cannot quietly undo it.

`document.documentElement.scrollWidth` against the viewport width is the cheapest
real detector in the box — it found a detail page rendering 465px wide at 390px
with its Delete button entirely off-screen. Assert it on every page you visit.

Expect one console error everywhere: `fonts.googleapis.com` →
`ERR_NAME_NOT_RESOLVED`. The DNS allowlist blocks it and the app is fine. Anything
else deserves a look.

## The component checks in the table

`docs/best-practices/frontend-react.md` keeps a table of per-component checks the
automated suite cannot reach. Its rows are not all equal: some need hardware, and
some this loop reaches easily. **Run the ones you can drive** when your change
touches the component named, and report the rest as unrun rather than letting the
heading imply nobody could have looked.

Sort each row by what the check actually needs:

- **Hardware** — a soft keyboard, or an `env(safe-area-inset-*)` that resolves to
  anything but 0. Headless Chromium supplies neither at any viewport, and an
  ordinary Android tab reports the inset as 0 too, so only an installed
  edge-to-edge window is a real pass.
- **Yours** — everything else. Widths above the single 360px viewport the harness
  declares, computed style, stacking, and print, which needs no hardware at all:

```js
await page.emulateMedia({ media: "print" });
await page.pdf({ path: "/tmp/list.pdf" }); // headless Chromium only
```

A **native `<select>`** straddles that hardware/yours split and is worth its own
note, because
headless makes it look settled when it isn't. Set its value with
`selectOption` — that works, and is what a driven flow should do. Do not judge
the open picker from a screenshot: headless paints Chromium's desktop dropdown
even at a 390px touch viewport, while a phone opens the platform picker, which
is the whole reason `OptionSelect` is native rather than a `Combobox`. A
screenshot of the open list is a picture of something your user never sees.
The `Combobox` next to it is an ordinary DOM listbox and drives fine; only its
soft-keyboard behaviour is out of reach.

That table is planned to split along the same hardware/yours boundary into
driver-reachable and hardware-only sections; until it does, judge each row by the
test above.

**A run is not coverage.** Reaching something with a throwaway script says what
the browser can measure; it says nothing about what this repo's suite asserts.
The manual-steps table is scoped to the harness — `vitest.browser.config.ts`
declares one instance, chromium at 360x780 — so a desktop check stays manual
however easily your script reached it. Retire a manual step only by landing the
test that replaces it, in the same commit. Note before you try: two files guard
themselves with `expect(window.innerWidth).toBe(360)` so their assertions cannot
pass vacuously, and a second instance runs the whole `include` glob against them.

## Where findings go

Picking the wrong destination is how a finding evaporates:

| What you found                                        | Where it goes                                   |
| ----------------------------------------------------- | ----------------------------------------------- |
| A defect in the feature this PR builds                | Fix it here, with a test                        |
| A defect elsewhere in the app                         | A GitHub issue — `docs/agents/issue-tracker.md` |
| No test would catch this PR's change regressing       | Write that test here, in this PR                |
| A coverage gap away from what this PR touches         | A GitHub issue                                  |
| A test that passed over a bug you just watched happen | A lesson under `mission/lessons/`               |

A missing test sorts by reach, not by blame. If your change can break the thing
nobody is asserting, the test belongs in your PR — the regression it would catch is
the one you are about to introduce, and a green suite is about to call that fine.
If your change cannot reach it, you have found an unrelated gap, and it files like
any other defect elsewhere.

The last row is the valuable one, the easiest to skip, and orthogonal to the rest —
it rides along with any of them. A test that passes over a bug you just saw with
your own eyes is a reusable lesson about the seam, not a one-off; write it down and
let consolidation promote it into `best-practices/`.
