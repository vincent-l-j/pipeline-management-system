### VAL-CI-001: A configured but unreachable test database fails the run

When a test database is explicitly configured and cannot be reached, the migration suite
exits non-zero and the connection error appears in the output. It does not report success
by skipping the work it was asked to do.
Tool: the migration suite with the database stopped and `TEST_DATABASE_URL` set
Evidence: the non-zero exit status and the driver's error message
