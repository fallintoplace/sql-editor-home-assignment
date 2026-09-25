# Engineering decisions and tradeoffs

This document is the short technical companion to the ClickStudio interview project. It focuses on the decisions that are interesting to discuss in a review: what I optimized for, what I deliberately kept simple, and what I would change for a production system.

## 1. Keep the browser away from database credentials

The browser talks to a small server API instead of connecting directly to ClickHouse.

Why:

- database credentials stay on the server;
- query limits can be applied in one place;
- connection profiles can be reviewed and trusted before execution;
- imports can use a separate, more restricted writer identity.

Tradeoff:

This adds a backend to what could otherwise be a static SQL editor. For an interview project, I preferred the clearer security and execution boundary over a thinner architecture.

## 2. Make query results belong to executions, not editor text

Every run gets its own query ID, SQL, parameters, limits, timestamps, result state, and retained result.

Why:

Editing the SQL after a query finishes should not silently change what an old chart, result, or inspection panel claims to represent. A run is evidence of what actually executed.

Tradeoff:

The data model is more explicit than a simple "editor + latest result" implementation. It is useful here because ClickStudio includes history, saved revisions, charts, EXPLAIN views, and assistant proposals that all need a stable execution reference.

## 3. Use restricted ClickHouse identities as the real authorization boundary

ClickStudio performs read-only checks in the application, but it does not pretend that string inspection is a SQL sandbox.

The bundled setup uses:

- a read-only identity for normal SQL;
- a separate INSERT-only identity for allowlisted import tables;
- an administrator only for the explicit local setup step.

Why:

Database permissions are a stronger boundary than trying to classify every possible ClickHouse statement perfectly in application code.

For a production system I would add organization-level authorization and centrally managed connection policy instead of the single-owner token used by this project.

## 4. Preserve ClickHouse types instead of normalizing everything to JavaScript numbers

Results keep column names and ClickHouse type metadata separately from row values. Large UInt64 and Decimal values are requested as strings.

Why:

JavaScript cannot exactly represent every ClickHouse integer or decimal value. A SQL tool should not silently corrupt a value just to make rendering convenient.

Tradeoff:

Charts still need JavaScript numbers, so unsafe numeric coordinates are omitted from charts while the table and JSON views remain authoritative.

## 5. Keep the demo deterministic and visibly separate from real execution

The sample workspace uses a fixture driver. It does not parse or execute arbitrary SQL and never becomes a fallback after a real database error.

Why:

A deterministic demo is useful for reviewing UI behavior without requiring Docker, but pretending fixture output came from the entered SQL would make the product misleading.

This also makes browser tests stable without turning the test fixture into a second SQL engine.

## 6. Treat EXPLAIN output as structured product data

ClickStudio has dedicated views for:

- EXPLAIN INDEXES;
- EXPLAIN PLAN;
- EXPLAIN PIPELINE.

The UI parses the relevant ClickHouse output into bounded graph structures while retaining the raw result.

Why:

Raw EXPLAIN text is useful but difficult to scan. The graph views make pruning, logical plan shape, and processor topology easier to inspect without hiding the underlying ClickHouse response.

Tradeoff:

These views describe plans and topology. They do not claim to show measured per-node runtime unless ClickHouse actually provides that measurement.

## 7. Prefer small, explicit persistence over introducing a database for the app itself

Local server state is stored as bounded JSON files with atomic replacement. Browser drafts are stored separately.

Why:

For a single-owner interview project, introducing Postgres or another service would add deployment and schema machinery without demonstrating much more of the SQL editor itself.

Tradeoff:

This is intentionally single-process. A production multi-user version should use a transactional database and shared storage rather than extending the JSON store.

## 8. Make risky or irreversible actions visible

Examples:

- a connection must be reviewed and trusted before execution;
- imports have preview, mapping, and exact row-count confirmation;
- assistant suggestions are proposed first and require an explicit Apply and then Run;
- sharing is separate from publishing;
- stale results are visibly distinguished from the current editor state.

Why:

SQL tools often combine powerful actions with ambiguous state. I wanted the UI to make the transition from inspection to mutation obvious.

## 9. Testing strategy

The repository separates different kinds of confidence:

- unit tests for parsing, guards, storage, result handling, and derived views;
- workspace tests for editor state and recovery behavior;
- deterministic Playwright tests against the fixture driver;
- integration tests against the bundled ClickHouse instance;
- TypeScript, ESLint, coverage gates, and production build checks.

The fixture suite answers "does the product workflow behave correctly?" while the live integration suite answers "does this actually work with ClickHouse?"

## What I would do next in a production version

I would prioritize:

1. real multi-user authentication and authorization;
2. transactional server persistence;
3. managed connection secrets and organization policies;
4. stronger observability and operational tooling;
5. larger-result virtualization/streaming;
6. broader ClickHouse-version compatibility testing.

Those are intentionally outside the core interview scope. The implemented version concentrates on the SQL editing and analysis workflow, ClickHouse-specific behavior, and the correctness boundaries around executing and retaining queries.
