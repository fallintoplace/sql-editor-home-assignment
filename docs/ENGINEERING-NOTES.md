# Engineering choices

This document highlights the technical decisions that shape ClickStudio and the reasoning behind them.

## 1. Server-mediated ClickHouse access

The browser talks to a small server API for ClickHouse execution.

This keeps:

- database credentials on the server;
- query limits centralized;
- connection profiles reviewable before execution;
- imports on a dedicated writer identity.

The result is a clear execution boundary with room for richer connection policy as the product grows.

## 2. Execution-scoped evidence

Every run gets its own query ID, SQL, parameters, limits, timestamps, result state, and retained result.

This lets ClickStudio keep charts, history, saved revisions, EXPLAIN views, and assistant proposals connected to the exact execution that produced them.

The editor remains flexible while historical evidence stays stable and easy to inspect.

## 3. Database-native permissions

The bundled setup uses:

- a read-only identity for normal SQL;
- a dedicated INSERT identity for configured import tables;
- an administrator identity for local setup.

Application-level SQL checks provide clear feedback, while ClickHouse permissions remain the strongest authorization layer.

This keeps database policy close to the database and makes the security model easy to reason about.

## 4. ClickHouse type fidelity

Results preserve ClickHouse column types alongside row values.

Large `UInt64` and `Decimal` values are transported as strings so exact database values survive the JavaScript boundary.

Charts use numeric coordinates where representation is safe, while table and JSON views retain exact values.

## 5. Deterministic sample mode

The sample workspace uses a deterministic fixture driver.

That gives reviewers and browser tests stable data for:

- editor workflows;
- progress states;
- cancellation;
- charts;
- EXPLAIN views;
- history and retained results.

Live ClickHouse mode exercises the same product flow with real database execution.

## 6. Structured EXPLAIN experiences

ClickStudio includes dedicated views for:

- **EXPLAIN INDEXES**
- **EXPLAIN PLAN**
- **EXPLAIN PIPELINE**
- **EXPLAIN ANALYZE**

The UI turns ClickHouse output into bounded interactive graph structures while also retaining the raw result. Runtime analysis executes the selected query and is capability-gated by the connected server. MergeTree storage uses a capped, read-only `system.parts` query, separate from run history; inactive parts are not described as active merges.

This makes pruning, logical plan shape, processor topology, and measured execution easier to understand at a glance.

## 7. Lightweight local persistence

Server state uses bounded JSON storage with atomic file replacement, while browser drafts use local workspace storage.

This keeps the project easy to run and inspect with very little infrastructure.

The data model already separates runs, documents, publications, imports, and workspace state, which provides a clean path toward transactional shared storage when needed.

## 8. Explicit user actions

Important transitions are visible in the interface:

- connections are reviewed and trusted before execution;
- imports move through preview, mapping, and confirmation;
- assistant suggestions move through review, apply, and run;
- sharing is a separate action from publishing;
- retained results remain connected to their original SQL and parameters.

This makes powerful workflows feel predictable and keeps user intent visible.

## 9. Layered testing

The repository uses several layers of validation:

- unit tests for parsing, guards, storage, results, and derived views;
- workspace tests for editor state and recovery;
- deterministic Playwright workflows;
- integration tests against the bundled ClickHouse instance;
- TypeScript, ESLint, coverage gates, and production build checks.

Together these cover both product behavior and ClickHouse integration.

## 10. Growth path

The architecture has clear extension points for:

1. multi-user authentication and authorization;
2. transactional shared persistence;
3. managed connection secrets and organization policies;
4. richer observability;
5. larger-result virtualization and streaming;
6. broader ClickHouse-version compatibility coverage.

The current implementation already exposes the core abstractions those capabilities can build on.
