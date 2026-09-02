### VAL-DEPLOY-001: A failing build does not reach the deploy step

When a commit on a branch wired to deploy fails any check, the deploy step does not run —
the failure stops the release rather than being reported alongside it.
Tool: a throwaway branch with a deliberately broken check, GitHub Actions
Evidence: the workflow run showing the checks failed and the deploy job skipped
