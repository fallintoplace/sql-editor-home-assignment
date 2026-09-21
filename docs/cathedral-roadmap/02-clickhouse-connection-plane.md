# Stage 2: ClickHouse connection plane

## Mission

Make ClickHouse feel native from connection to execution. A user should always know which server, database, user, settings, and query ID produced a result.

This is the first real engineering stage. Everything after it consumes the execution contract defined here.

## Borrow

- ClickHouse SQL Playground: HTTP execution, explicit query IDs, progress polling, query limits, local saved state.
- ClickHouse Cloud console: table exploration, import flow, visualizations, and collaboration.
- ClickHouse Node client: one official client path for query, execution, and JSONEachRow insertion.
- ClickHouse 26.7 web UI: database, table, and column diagnostics, progressive results, persistent snapshots, and version-matched documentation.
- ClickStack: a shared OpenTelemetry correlation trail from a user action to ClickHouse-backed logs, traces, and metrics.

## Adapt for ClickHouse

### Connection profiles

Store named profiles locally first:

- URL and protocol.
- Database.
- User and secret reference.
- TLS setting.
- Read-only preference.
- Default limits.

Never send secrets to OpenAI. The browser should talk to our server-side connection layer, not expose database credentials.

Each profile also has a visible health and capability record:

- Last successful connection test and server version.
- Database and schema refresh timestamp.
- Available metadata, progress, cancellation, explain, query-log, and documentation capabilities.
- Whether telemetry is enabled and where a trace link will point.
- A safe default limits preset and an advanced override state.

The onboarding path is beginner-friendly: URL, database, and test connection first. TLS, settings, and metadata permissions stay available in an advanced drawer. Switching profiles must invalidate schema, result, run, and assistant context so data from one server cannot leak into another.

### Execution envelope

Every execution returns a stable envelope:

```text
queryId
status
serverVersion
elapsedMs
rows
bytes
columns
progress
warnings
result
```

Support cancellation, client deadlines, and a useful error object with the SQL location when possible.

Add execution identity to the envelope:

```text
requestedBy
executedAs
permissionSnapshot
resultRetention
retryPolicy
queryTags
rowLimit
byteLimit
waitTimeout
```

For a shared artifact, the user must know whether ClickHouse ran it as the current user, a connection service identity, or an explicitly configured owner identity. A rerun rechecks permission rather than trusting an old snapshot.

### Run lifecycle

Use a stable server API rather than making the browser manage a raw database connection:

```text
POST /api/runs
  -> returns runId + queryId immediately
GET  /api/runs/:runId/events
  -> SSE progress, status, warnings, and completion events
GET  /api/runs/:runId/result
  -> typed result page or snapshot
POST /api/runs/:runId/cancel
  -> KILL QUERY by queryId
```

The UI must survive refreshes, duplicate clicks, a dropped SSE connection, and a query that finishes before the progress stream opens. The server is the source of truth for run state.

Make the lifecycle idempotent and inspectable:

- A client request ID prevents a double-click from creating two runs accidentally.
- `query_id` is generated server-side and remains stable across reconnects.
- A reconnect first reads the authoritative run state, then resumes events from the last known sequence.
- Retries never silently rerun a mutation or a non-idempotent request.
- A completed run keeps its result and evidence even if the browser was closed.

Before execution, show a lightweight risk summary: connection, database, selected statement, read-only mode, limits, and whether the query may scan a large amount of data. Do not invent a monetary cost estimate from bytes read.

Limits must be protocol fields, not only SQL decoration. Carry row limit, byte limit, wait timeout, and cancellation policy with the run. Mark a response as truncated when a protocol limit stops output.

### Query history and result lifetime

Separate three kinds of history:

- **Run history:** server facts, query ID, status, timing, and result reference.
- **Workspace history:** edits, revisions, comments, and local recovery checkpoints.
- **Shared snapshot:** bounded data and metadata retained for collaboration.

Each result states its retention deadline and whether it can be reopened without rerunning. If a server result expires, the UI explains why and offers a permission-checked rerun.

### Scheduled execution boundary

Do not bolt scheduling onto the browser. A future schedule or alert must reference a published query revision, connection profile, parameter defaults, limits, and an execution identity. It should produce ordinary run artifacts and failure events that appear in the same history as manual runs.

### ClickHouse capabilities

Detect and record capabilities at connection time:

- Server version.
- Available system tables.
- Explain variants.
- Progress and cancellation support.
- Documentation availability.
- Permission to read metadata and query history.

The UI should degrade a panel with a clear explanation when a capability is unavailable. It should not fail the whole workspace.

Expose connection-backed editor intelligence as capabilities too:

- Completion and hover metadata from `system.tables`, `system.columns`, functions, settings, and data types.
- Go to definition for tables, views, dictionaries, and columns.
- Query-history lookup and trace navigation by `query_id`.
- Explain, pipeline, profile, and documentation actions supported by this server version.
- Import preview and JSONEachRow insertion only when the connection permissions allow it.
- Multi-statement script support and statement-level cancellation semantics.
- Named parameter syntax and server-side parameter binding support.
- Query history visibility and retention available to the current identity.
- Result row/byte limits and whether the server can stream progressive results.
- Performance-profile support: operator-level timing, rows, bytes, memory, and plan export where available.
- Scheduled execution and alert primitives, including the identity and permission used by the scheduler.
- Query tags for workspace, artifact, environment, owner, and cost center.
- Query-history retention and deletion behavior.

The editor should never present a button that the current connection cannot safely perform. Unsupported actions remain discoverable with a reason and a version or permission hint.

Return these facts as a versioned capability manifest. The frontend uses the manifest to enable completion, script controls, parameter widgets, history filters, and result affordances without guessing from a server version string.

### Safe defaults

Use a read-only identity for exploration. Apply bounded execution time, memory, rows, bytes, and threads. Allow an explicit advanced-settings drawer rather than hiding limits in code.

Never use the starter `default` identity for a shared deployment. The local compose setup is intentionally permissive for the assignment; the product path needs a restricted identity and a server-side secret store.

Add a workspace trust boundary before connecting a new profile or enabling data-changing actions. An untrusted workspace can browse documented examples and use a fake connection, but it cannot silently reuse credentials or run a mutation. A trusted workspace can still remain read-only.

### Observability

Attach the same correlation data to the API span and ClickHouse query:

- workspace ID
- run ID
- ClickHouse query ID
- normalized query hash when available
- connection profile ID
- OpenAI response ID when AI initiated the run

Do not put raw credentials in spans. Record query text only under the workspace’s configured data policy.

Treat task execution as a first-class run type. “Run selected,” “Explain,” “Profile,” “Import preview,” and “Open trace” should share request IDs, status, cancellation, output routing, and history. This gives the editor the reliability of an integrated terminal without introducing an unrelated shell surface.

### Version awareness

The starter compose file uses ClickHouse 24.6. Newer features such as searchable server documentation or newer explain behavior must be feature-detected. Never make the app require a newer server accidentally.

When available, expose the same native details that make the current ClickHouse web UI useful: column type, size, compression ratio, table engine, and documentation matched to the server version. Treat these as capability-backed panels, not assumptions in the frontend.

## Acceptance gate

- Connect to the local compose server.
- Browse databases, tables, columns, and types.
- Run a query and display query ID, elapsed time, row count, and progress.
- Cancel a long query.
- Surface ClickHouse errors without losing the editor contents.
- Enforce safe defaults for exploratory queries.
- Recover cleanly when progress polling or SSE is interrupted.
- Show a capability warning instead of crashing on an older ClickHouse server.
- Test a connection and show its version, health, limits, and capability status.
- Switch between two profiles without stale schema, result, or assistant context crossing the boundary.
- Reconnect to a completed run without duplicating execution.
- Follow one run from the browser request to API trace, ClickHouse `query_id`, and HyperDX/ClickStack span.
- An untrusted workspace cannot reuse a saved connection or run a mutation silently.
- Unsupported editor actions are explained by server version or permission.
- Explain/profile/import tasks appear in the same history as query runs and remain cancellable where supported.
- The capability manifest accurately enables or disables multi-statement, parameters, history, streaming, and import controls.
- A shared run displays `requestedBy`, `executedAs`, permission snapshot, and result retention.
- Expired server results are distinguishable from failed queries and stale workspace snapshots.
- History filters never reveal SQL or result data outside the current identity’s permission scope.
- A performance profile is permission-checked, linked to a query ID, and exportable without exposing credentials.
- A scheduled run records its revision, parameter values, execution identity, and failure notification policy.
- Query tags appear in run history and can be filtered without exposing unauthorized SQL.
- A timeout or output cap produces a distinct cancelled or truncated state, not a generic failure.

## Sources

- [ClickHouse Node.js integration](https://clickhouse.com/integrations/nodejs)
- [ClickHouse SQL Playground architecture](https://clickhouse.com/blog/announcing-the-new-sql-playground)
- [ClickHouse 26.7 web workspace](https://clickhouse.com/blog/clickhouse-release-26-07)
- [ClickStack observability](https://clickhouse.com/clickstack)
- [ClickHouse system tables](https://clickhouse.com/docs/operations/system-tables)
- [Databricks query history](https://docs.databricks.com/gcp/en/sql/user/queries/query-history)
- [Databricks statement execution limits and tags](https://docs.databricks.com/aws/en/dev-tools/sql-execution-tutorial)
- [Snowflake query history and tags](https://docs.snowflake.com/en/user-guide/ui-snowsight-activity)
- [ClickHouse concurrency and query telemetry](https://clickhouse.com/resources/engineering/high-concurrency-sizing-user-analytics)

## Thread pickup

Before UI polish, define the execution envelope and test it against the 24.6 compose server. The UI should consume the envelope instead of inventing its own query state. Finish this stage with a small fake-run adapter so the frontend can test loading, progress, completion, cancellation, and failure deterministically.
