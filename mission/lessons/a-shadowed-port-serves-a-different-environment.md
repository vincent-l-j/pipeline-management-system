### A shadowed port serves the same code under a different environment

Observed: driving the app from the devcontainer on `localhost:5173`, the "Dev Login
(Admin)" button was absent from `/login`. `docker-compose.yml` sets
`VITE_ENABLE_DEV_LOGIN: "true"` on the `frontend` service, and the served
`import.meta.env` carried no `VITE_` keys at all, so the conclusion drawn — and
reported to the user — was that the running container had drifted from the compose
file and should be recreated. It had not. `localhost:5173` inside `app` was a
second Vite that an agent session had started with `npm run dev`: same
bind-mounted source, none of the compose service's environment. Asking the compose
service directly (`curl -H "Host: localhost:5173" http://frontend:5173/...`)
returned the flag set correctly. The recommendation would have recreated a healthy
container to fix nothing.
Root cause, two layers. The environment one: `forwardPorts` publishes
`frontend:5173` to the **host**, not to `app`'s loopback, so inside the container
that port is unclaimed and the first process to bind it wins, silently. The
reasoning one, which is the reusable half: "the app is on `localhost:5173`" was
carried in from the host workflow and never established, and every later
observation was consistent with it — the page rendered, the API answered, the data
was real. A wrong premise that still produces a working app does not correct
itself; it corrects only against the one observation it cannot explain, and by then
the explanation reached for is a bug somewhere else.
Rule: before attributing a defect to configuration, name the process that answered.
`ss -ltnp` identifies the listener and `/proc/<pid>/environ` identifies who started
it and with what. Compare the suspect response against the service you meant to
reach, not against the config file — a config file says what a container _would_
receive, not what the socket in front of you _did_. The same move applies whenever
a URL is inherited rather than derived.
Check: a claim that a running service has drifted from its declared config, made
without identifying the process that served the response. Also any service reached
over loopback from inside the devcontainer, where `forwardPorts` maps the host and
`localhost` is whatever happens to be bound locally.
Note: the fix for the underlying trap is `server.allowedHosts: ["frontend"]` in
`frontend/vite.config.ts` — sessions started their own dev server because Vite's
host check 403'd the only address `app` could use, and the shadowing followed from
that. A missing affordance is what made the wrong premise reachable.
