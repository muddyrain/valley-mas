# Domain Docs

This file records the domain-docs configuration created by `setup-matt-pocock-skills`.

Valley MAS has not yet implemented real domain docs: there is currently no root `CONTEXT-MAP.md`, no root or context `CONTEXT.md`, and no ADR directory. Treat this file as compatibility configuration for Matt Pocock engineering skills, not as a default Valley MAS development entry point.

For ordinary Valley MAS development, use `AGENTS.md`, `docs/PROJECT_GUIDE.md`, the relevant subproject `AGENTS.md`, and the current code as the source of truth.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root if it exists. It points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`CONTEXT.md`** at the repo root if the repo is later collapsed to a single-context layout.
- **`docs/adr/`** for system-wide decisions.
- **Context-scoped ADRs**, such as `apps/<app>/docs/adr/`, `server/docs/adr/`, or `packages/<package>/docs/adr/`, for decisions local to a subproject or package.

If any of these files don't exist, **proceed silently**. Don't flag their absence and don't suggest creating them upfront unless the user explicitly asks to establish domain docs or ADRs. Do not reference `/domain-modeling` or other unavailable skills as if they already exist in this repo.

## File structure

If Valley MAS later chooses to maintain domain docs, the intended multi-context layout is:

```
/
|-- CONTEXT-MAP.md
|-- docs/adr/                         # system-wide decisions
|-- apps/
|   |-- web/
|   |   |-- CONTEXT.md
|   |   `-- docs/adr/
|   |-- admin/
|   |   |-- CONTEXT.md
|   |   `-- docs/adr/
|   `-- life-trace/
|       |-- CONTEXT.md
|       `-- docs/adr/
|-- server/
|   |-- CONTEXT.md
|   `-- docs/adr/
`-- packages/
    `-- <package>/
        |-- CONTEXT.md
        `-- docs/adr/
```

## Use the glossary's vocabulary

When a relevant `CONTEXT.md` exists and your output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined there. Don't drift to synonyms the glossary explicitly avoids.

If no glossary exists yet, do not invent one during ordinary implementation. Note the gap only when the task is explicitly about domain modeling, ADRs, or long-term architecture documentation.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because..._
