# Project scope

ClickStudio is a local-first ClickHouse SQL editor built as an interview project. The implementation focuses on the parts of a SQL workspace that are technically interesting to make correct: execution boundaries, ClickHouse-specific result handling, editor state, query evidence, imports, and explainability.

## Implemented

- Read-only query execution with server-side limits and query IDs.
- Multi-statement scripts with statement-level results.
- CodeMirror SQL editing, formatting, validation, parameters, tabs, and recovery.
- Schema and object exploration, including ClickHouse system-table documentation.
- Typed results, filtering, export, charts, and retained query history.
- ClickHouse-specific EXPLAIN INDEXES, EXPLAIN PLAN, and EXPLAIN PIPELINE views.
- CSV, JSON, and NDJSON import with preview, mapping, an allowlisted writer, and explicit confirmation.
- Saved query revisions and bounded published snapshots.
- Optional assistant proposals that are reviewed before they can change SQL and never execute automatically.
- Deterministic sample mode for UI review without a database.
- Unit, workspace, browser, and live ClickHouse integration coverage.

## Deliberate boundaries

This is not intended to demonstrate every subsystem needed by a commercial multi-user SQL platform.

The current version is:

- **single-owner**, rather than organization/role based;
- **single-process**, with small local persistence rather than a transactional application database;
- **bounded-result**, rather than an unlimited streaming analytics client;
- **explicitly configured**, rather than a hosted connection/secret-management service;
- **local-first**, rather than a production SaaS deployment.

Those choices keep the project centered on the editor and ClickHouse workflow while still making the boundaries visible in the implementation.

## What I would discuss in a review

The most useful technical areas to inspect are:

1. why database execution is mediated by the server instead of the browser;
2. why runs and retained results are modeled independently from mutable editor text;
3. how ClickHouse UInt64 and Decimal values avoid JavaScript precision loss;
4. why application SQL checks complement rather than replace ClickHouse permissions;
5. how fixture mode stays deterministic without pretending to execute arbitrary SQL;
6. how raw EXPLAIN results are preserved while also producing interactive graph views;
7. why the persistence model is intentionally simpler than the one I would choose for a multi-user production system.

See [Engineering decisions and tradeoffs](ENGINEERING-NOTES.md) for the short version of those choices.

## Running and validating

Start with the [repository README](../README.md). The longer [setup and implementation reference](CLICKSTUDIO.md) contains detailed behavior and operational notes.

The GitHub Actions workflow at [`.github/workflows/clickstudio.yml`](../.github/workflows/clickstudio.yml) runs the project quality and integration checks.
