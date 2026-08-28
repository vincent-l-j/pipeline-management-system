### VAL-UI-003: The render error reaches the backend log stream

The same render error produces an error record in the backend's log stream naming the
failure, so an operator sees browser failures without the user reporting them.
Tool: agent-browser, docker compose logs
Evidence: the report request, and the resulting log record
