### VAL-DEPLOY-002: A passing build still deploys

A green commit on a deploy branch reaches the deploy step and the app updates. The gate
blocks bad releases without blocking good ones.
Tool: staging deploy from `develop`
Evidence: the workflow run showing checks passed and the deploy job ran; the new version
served by the app
