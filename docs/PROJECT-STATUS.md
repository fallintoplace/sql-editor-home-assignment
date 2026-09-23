# Project status

ClickStudio is a local-first ClickHouse SQL editor with a React and Tailwind interface and a bounded server API.

## Available

- Query and script execution with retained, run-scoped results.
- Schema browsing, ClickHouse metadata, query profiles, and execution-plan views.
- Local SQL drafts and versioned saved documents.
- CSV, JSON, and NDJSON import with destination allowlists and explicit write confirmation.
- Charts, result filtering, export, and query history.
- Optional assistant proposals that require review and an explicit Run action.
- A deterministic sample mode for exploring the interface without a database.

## Project boundaries

The sample driver does not interpret or execute SQL. Live queries use the configured ClickHouse identity and server-side limits. The application is single-owner and single-process; it is not a multi-user production service.

For setup, available commands, and implementation details, see [the ClickStudio guide](CLICKSTUDIO.md). Current validation is recorded by the [ClickStudio GitHub Actions workflow](../.github/workflows/clickstudio.yml).
