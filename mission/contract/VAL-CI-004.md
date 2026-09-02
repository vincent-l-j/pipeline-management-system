### VAL-CI-004: An unregistered test marker fails the run

Applying a marker that is not declared causes the run to fail rather than emit a warning,
so a typo in a marker cannot silently exclude tests from the selection that runs in CI.
Tool: the backend suite with a deliberately misspelled marker
Evidence: the non-zero exit status naming the unknown marker
