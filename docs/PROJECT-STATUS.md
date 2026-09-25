# Project highlights

ClickStudio is a local-first ClickHouse SQL editor built as an interview project. It focuses on a rich SQL workflow, ClickHouse-specific behavior, and clear execution evidence.

## Implemented capabilities

- Read-only query execution with server-side limits and query IDs.
- Multi-statement scripts with statement-level results.
- CodeMirror SQL editing, formatting, validation, parameters, tabs, and recovery.
- Schema and object exploration, including ClickHouse system-table documentation.
- Typed results, filtering, export, charts, and retained query history.
- ClickHouse-specific EXPLAIN INDEXES, EXPLAIN PLAN, EXPLAIN PIPELINE, and EXPLAIN ANALYZE views.
- MergeTree part storage explorer with treemap and circle-pack layouts.
- CSV, JSON, and NDJSON import with preview, mapping, a dedicated writer, and explicit confirmation.
- Saved query revisions and bounded published snapshots.
- Optional assistant proposals with review, apply, and run steps.
- Deterministic sample mode for fast UI exploration.
- Unit, workspace, browser, and live ClickHouse integration coverage.

## Technical focus

The most interesting areas to inspect are:

1. server-mediated database execution;
2. execution-scoped retained results;
3. exact ClickHouse numeric handling across the JavaScript boundary;
4. ClickHouse-native permission layering;
5. deterministic fixture architecture;
6. structured EXPLAIN graph views;
7. lightweight local persistence;
8. layered validation from unit tests through live ClickHouse integration.

See [Engineering choices](ENGINEERING-NOTES.md) for the reasoning behind these areas.

## Product shape

The project currently uses a local-first, single-owner architecture with lightweight persistence and explicit connection configuration.

That shape keeps setup simple and makes the core SQL workflow easy to evaluate. The architecture also provides clear extension points for shared persistence, organization-level authorization, managed connections, and larger-result workflows.

## Running and validating

Start with the [repository README](../README.md). The [setup and implementation reference](CLICKSTUDIO.md) contains detailed behavior and configuration.

The GitHub Actions workflow at [`.github/workflows/clickstudio.yml`](../.github/workflows/clickstudio.yml) runs the project quality and integration checks.
