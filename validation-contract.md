# Validation Contract

Behavioral assertions that define correctness for Rozetta PMS. Each assertion is a black-box test exercised by validators against the running system.

## Sources

### VAL-SOURCE-001: RIAC source can be set on pitch creation
A pitch is created with `source: "riac"`. The pitch record is fetched and the source field is present and equals "riac".
Tool: agent-api
Evidence: POST /api/pitches returns `source: "riac"` in response; GET /api/pitches/{id} returns same value.

### VAL-SOURCE-002: Foundry source can be set on pitch creation
A pitch is created with `source: "foundry"`. The pitch record is fetched and the source field is present and equals "foundry".
Tool: agent-api
Evidence: POST /api/pitches returns `source: "foundry"` in response; GET /api/pitches/{id} returns same value.

### VAL-SOURCE-003: Board source can be set on pitch creation
A pitch is created with `source: "board"`. The pitch record is fetched and the source field is present and equals "board".
Tool: agent-api
Evidence: POST /api/pitches returns `source: "board"` in response; GET /api/pitches/{id} returns same value.

### VAL-SOURCE-004: RIAC student source can be set on pitch creation
A pitch is created with `source: "riac_student"`. The pitch record is fetched and the source field is present and equals "riac_student".
Tool: agent-api
Evidence: POST /api/pitches returns `source: "riac_student"` in response; GET /api/pitches/{id} returns same value.

## Funding Pathway

### VAL-FUNDING-001: No funding identified pathway can be set on pitch creation
A pitch is created with `funding_pathway: "no_funding_identified"`. The pitch record is fetched and the funding_pathway field is present and equals "no_funding_identified".
Tool: agent-api
Evidence: POST /api/pitches returns `funding_pathway: "no_funding_identified"` in response; GET /api/pitches/{id} returns same value.

### VAL-FUNDING-002: Internal funding pathway can be set on pitch creation
A pitch is created with `funding_pathway: "internal_funding"`. The pitch record is fetched and the funding_pathway field is present and equals "internal_funding".
Tool: agent-api
Evidence: POST /api/pitches returns `funding_pathway: "internal_funding"` in response; GET /api/pitches/{id} returns same value.

## Domains

### VAL-DOMAIN-001: AI Energy Transition domain can be set on pitch
A pitch is created with `domain_tags: "AI Energy Transition"`. The pitch record is fetched and the domain_tags field is present and contains "AI Energy Transition".
Tool: agent-api
Evidence: POST /api/pitches returns `domain_tags: "AI Energy Transition"` in response; GET /api/pitches/{id} returns same value.

### VAL-DOMAIN-002: Health domain can be set on pitch
A pitch is created with `domain_tags: "Health"`. The pitch record is fetched and the domain_tags field is present and contains "Health".
Tool: agent-api
Evidence: POST /api/pitches returns `domain_tags: "Health"` in response; GET /api/pitches/{id} returns same value.

### VAL-DOMAIN-003: Semiconductors domain can be set on pitch
A pitch is created with `domain_tags: "Semiconductors"`. The pitch record is fetched and the domain_tags field is present and contains "Semiconductors".
Tool: agent-api
Evidence: POST /api/pitches returns `domain_tags: "Semiconductors"` in response; GET /api/pitches/{id} returns same value.

## Submission Date

### VAL-SUBMISSION-001: Submission date can be not set
A pitch is created without providing a `submission_date` (null). The pitch record is fetched and the submission_date field is null.
Tool: agent-api
Evidence: POST /api/pitches returns `submission_date: null` in response; GET /api/pitches/{id} returns same value.

### VAL-SUBMISSION-002: Submission date can be set to a future date
A pitch is created with a future `submission_date`. The pitch record is fetched and the submission_date field equals the provided date.
Tool: agent-api
Evidence: POST /api/pitches with `submission_date: "2026-12-31"` returns that date; GET /api/pitches/{id} returns same date.

### VAL-SUBMISSION-003: Submission date can be set to a past date
A pitch is created with a past `submission_date`. The pitch record is fetched and the submission_date field equals the provided date.
Tool: agent-api
Evidence: POST /api/pitches with `submission_date: "2024-01-01"` returns that date; GET /api/pitches/{id} returns same date.

## Domain Options Migration

### VAL-DOMAIN-OPTS-001: Frontend domain selector updated to AI Energy Transition
The pitch creation and edit forms present "AI Energy Transition" as one of the available domain options.
Tool: agent-ui
Evidence: PitchCreatePage, PitchEditPage, and PipelineFilters components all display "AI Energy Transition" in their domain option pills.

### VAL-DOMAIN-OPTS-002: Frontend domain selector updated to Health
The pitch creation and edit forms present "Health" as one of the available domain options.
Tool: agent-ui
Evidence: PitchCreatePage, PitchEditPage, and PipelineFilters components all display "Health" in their domain option pills.

### VAL-DOMAIN-OPTS-003: Frontend domain selector updated to Semiconductors
The pitch creation and edit forms present "Semiconductors" as one of the available domain options.
Tool: agent-ui
Evidence: PitchCreatePage, PitchEditPage, and PipelineFilters components all display "Semiconductors" in their domain option pills.

### VAL-DOMAIN-OPTS-004: Old domain options removed from frontend
The pitch creation and edit forms no longer present the old domain options (climate, digital, forestry, agri, education, other).
Tool: agent-ui
Evidence: PitchCreatePage, PitchEditPage, and PipelineFilters components do not display old domain options.
