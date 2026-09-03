### VAL-UI-006: Normal use is unaffected

With nothing thrown, every existing page loads and behaves as before — navigation, data
loading, forms, and the redirect to login on an expired session are unchanged.
Tool: agent-browser walking the main routes; cd frontend && npm test
Evidence: screenshots of the main pages; the existing suite passing
