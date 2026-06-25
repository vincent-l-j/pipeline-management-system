# C4 Level 1 — System Context

Who and what interacts with Rozetta PMS, at the highest level.

```mermaid
C4Context
    title System Context — Rozetta PMS

    Person(staff, "Rozetta staff member", "Admin, Assessor or Viewer. Only @rozettainstitute.com accounts.")

    System(pms, "Rozetta PMS", "Tracks research/innovation pitches through the evaluation pipeline: pitches, meetings, assessments, dashboards, reports.")

    System_Ext(azure, "Microsoft Azure AD", "Organisation identity provider (OAuth/OIDC).")
    System_Ext(claude, "Anthropic Claude API", "LLM that turns raw meeting notes into structured records (AI Notetaker).")

    Rel(staff, pms, "Manages pitches, meetings & assessments; views dashboards", "HTTPS")
    Rel(pms, azure, "Authenticates users", "OAuth/OIDC")
    Rel(pms, claude, "Parses meeting notes", "HTTPS / JSON")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

**Notes**

- Staff are modelled as one *Person* with the three roles; split into separate actors only if a
  diagram's audience needs the distinction.
- Claude is optional at runtime — without `ANTHROPIC_API_KEY` the system falls back to a basic
  text parser (a property of the system, not a separate external dependency).
