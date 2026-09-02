### VAL-CI-002: An unconfigured test database still skips

With no test database configured, the migration suite skips with a stated reason and exits
zero, so the local suite runs without Postgres. Making an unreachable database fail must
not make the ordinary local run fail.
Tool: the migration suite with no `TEST_DATABASE_URL` set
Evidence: the skip reason and the zero exit status
