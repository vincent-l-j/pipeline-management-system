### VAL-CI-003: Checks run with a read-only repository token

The token available to the check workflow can read the repository and nothing more, so a
third-party action cannot write to the repo from a check run.
Tool: a check workflow run
Evidence: the run log's token permission summary showing read scope only
