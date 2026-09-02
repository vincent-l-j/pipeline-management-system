### VAL-ALERT-002: The running app carries the alert rules the repo declares

The alert rules fetched from the live app match the ones committed in its spec, for both
environments. The committed spec is the effective one, so a rule added in review is a rule
that is actually armed.
Tool: the platform CLI's spec fetch, diffed against the committed spec
Evidence: the diff showing no drift in the alert rules
