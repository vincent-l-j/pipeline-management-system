# Mobile support is a responsive PWA, not a native app

Rozetta PMS needs to be usable on phones, primarily for creating pitches, scoring
assessments and logging meetings while away from a desk. We are making the
existing React SPA responsive down to 360px and shipping a web app manifest so it
can be installed to the home screen, rather than building or wrapping a native
app. The deciding factor is that the four priority flows are ordinary forms over
the existing API — they need layout work, not platform capabilities.

## Considered Options

**Native (React Native, or a Capacitor/WebView wrapper).** Rejected for now. It
buys app-store distribution, push notifications and device APIs, none of which
anyone has asked for, and costs a second build/release pipeline plus a second
place for every future feature to land. A wrapper in particular would inherit
every responsive problem we have to fix anyway, so it cannot come first.

**PWA with offline support.** Rejected. True offline means a write queue and
conflict resolution on pitch stage moves, which taxes every feature built
afterwards. No user has reported losing connectivity. Revisit if that changes.

## Consequences

The app is installable but online-only: there is no service worker and no cached
data, so a cold launch without connectivity shows an error state rather than a
shell. Chrome dropped the service-worker requirement for installability (Chrome
89 on Android, 108 on desktop), so a manifest and HTTPS are enough; `vite-plugin-pwa`
is deliberately not a dependency, since without offline support it would only be
generating a JSON file. Note that Chrome's heuristic for _promoting_ the install
prompt is separate from installability and may still want a fetch handler — if the
prompt never appears, a minimal one is a promotion signal, not a caching layer.

iOS never prompts to install, so iPhone users must be told to use Share → Add to
Home Screen. Installed, the app runs without browser chrome and therefore without
a back button, so in-app navigation has to be self-sufficient.

Choosing native later is not blocked by this: the responsive work is a
prerequisite for a WebView wrapper and wasted only if we go fully native.
