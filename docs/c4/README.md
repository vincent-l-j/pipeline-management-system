# C4 Architecture Diagrams

[C4 model](https://c4model.com/) diagrams for Rozetta PMS, written in
[Mermaid](https://mermaid.js.org/syntax/c4.html). Each level zooms one step further in; read
them top to bottom.

| Diagram | Scope |
|---------|-------|
| [Level 1 — System Context](./level1-context.md) | Rozetta PMS in its environment: staff, Azure AD, Claude API |
| [Level 2 — Containers](./level2-container.md) | The SPA, API and database, and how they talk |
| [Level 3 — Components (API)](./level3-component-api.md) | Inside the FastAPI backend: routes, security, services, persistence |
| [Deployment — Development](./deployment-dev.md) | Docker Compose topology |
| [Deployment — Production](./deployment-prod.md) | DigitalOcean App Platform topology |

> Level 4 (Code) is intentionally omitted — class-level detail goes stale quickly and is better
> generated from the IDE on demand.

For the prose companion to these diagrams, see [`../architecture.md`](../architecture.md).

## Rendering

- **GitHub** renders the Mermaid blocks inline — just open each `.md` file.
- **VS Code** — the *Markdown Preview Mermaid Support* extension previews them.
- **Mermaid Live Editor** — paste a code block into <https://mermaid.live> to tweak layout.

Mermaid's C4 support is still marked experimental; auto-layout can be rough. If you outgrow it,
the same model maps cleanly onto [Structurizr DSL](https://structurizr.com/dsl) (one model,
all views) or C4-PlantUML.

## Keeping them current

These diagrams are hand-maintained. When you add/remove a container, an external dependency, or
a backend component (a new `api/routes/*` module or `services/*`), update the matching diagram in
the same PR so they don't drift from the code.
