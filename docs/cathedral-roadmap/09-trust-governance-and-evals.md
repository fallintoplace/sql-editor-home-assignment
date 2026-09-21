# Stage 9: Trust, governance, and evaluations

## Mission

Make the product safe enough for real data and honest enough for technical users. Trust is a feature, not a policy page.

The prototype intentionally allows broad analytical context when the user invokes OpenAI. Production governance must make that choice visible, auditable, and configurable without changing the core artifact model.

## Borrow

- Metabase: permission-scoped AI, provider controls, usage controls, and visible query provenance.
- ClickHouse: read-only settings, query limits, query logs, resource statistics, and server-native authorization.
- Snowflake and Databricks: role-aware context and governed data access.
- Metabase usage controls: group-level access to chat and SQL generation plus token and message caps.
- Databricks dashboards and Snowflake notebooks: governed definitions, draft/published state, version history, and collaboration permissions.

## Trust model

### Database safety

- Read-only exploration identity by default.
- Hard limits on time, memory, bytes, rows, and threads.
- Client-side cancellation plus server-side deadlines.
- Mutations and DDL require a separate explicit mode.
- Every execution has a query ID and audit trail.
- Connection profiles are isolated from workspace artifacts and never expose raw secrets to the browser.
- The starter `default` user is local-demo-only and cannot be the production security model.
- Workspace trust is separate from database permission. A trusted workspace may still be read-only, and an untrusted workspace cannot silently reuse credentials.
- OpenAI edit modes distinguish inspect, propose, apply-to-draft, and execute. Only the user can cross into execution.
- Every applied SQL hunk creates a recoverable history checkpoint before it changes the draft.

### AI safety

- Prototype mode can share broad analytical context after a visible user action.
- Production mode supports schema-only, selected-result, and full-result policies.
- Sensitive columns can be masked from context.
- Prompts and proposals are retained with the artifact when enabled.
- The UI distinguishes model suggestion, server fact, and user decision.
- Context preview, retention, deletion, and organization policy are explicit.

### Governance for meaning and publication

Treat metric contracts and published artifacts as governed data products:

- A metric contract records its definition, grain, source columns, filters, owner, and revision.
- A published answer freezes the SQL, connection reference, result snapshot, freshness, and access policy.
- Drafts can be edited without changing an already shared snapshot.
- Dataset promotion and refresh require an owner, schedule or manual trigger, retention policy, and permissions.
- AI tools can be enabled or disabled independently for a workspace or group, with token and message budgets.
- Audit records distinguish model suggestion, server fact, user edit, user approval, and execution.
- Shared result limits are explicit and configurable; collaborators never mistake a bounded preview for complete data.
- Current-file history and workspace-wide history apply the same connection and permission checks as execution.
- Script support is capability-driven. Each statement has its own status, limits, query ID, and cancellation path.

### Quality evaluation

Create a small ClickHouse benchmark set:

- Correct table and column selection.
- Date and timezone handling.
- Nullable, array, tuple, and nested types.
- Aggregation and grouping correctness.
- Query cost and limit behavior.
- Error repair.
- Ambiguous requests.
- Permission denial.
- Metric contract adherence and definition conflicts.
- Draft versus published snapshot behavior.
- Cross-filter and drill-through lineage.
- Refresh, stale-result, and failed-refresh handling.
- Current-file versus all-file query history isolation.
- Two simultaneous runs with separate query IDs and cancellation.
- Snippet and parameter expansion provenance.
- Shared result row/byte limits and permission changes between snapshot and rerun.

Measure SQL validity, semantic correctness, safety, latency, cost, and user acceptance. Keep failed examples as regression fixtures.

Split evaluation into four gates:

1. **Syntax:** ClickHouse accepts the SQL.
2. **Semantics:** the query answers the intended question on a known fixture.
3. **Safety:** limits, permissions, and mutation policy hold.
4. **Experience:** the user can inspect, correct, and reproduce the result.

Keep model output evaluation separate from ClickHouse execution evaluation. A correct query that the UI hides is still a product failure.

Add an editor-control gate:

5. **Control:** every edit, task, permission transition, and execution is visible, interruptible, reviewable, and recoverable.

Test command-palette actions, keyboard-only navigation, focus return after a run, local-history restore, split-pane state, and untrusted-workspace restrictions. A fast editor that loses work or surprises the user is not a trustworthy editor.

### Documentation

Use ClickHouse server documentation when available, including `system.documentation` on supported versions. Keep a fallback for older servers and show which version supplied the advice.

### Observability and incident response

Use HyperDX/ClickStack to correlate frontend errors, API spans, ClickHouse query IDs, OpenAI latency, and cancellation. Define what is redacted before telemetry leaves the process. Every production incident should have a reproducible artifact or run ID.

## Acceptance gate

- A permission-denied query is explained clearly.
- A long query is cancellable and bounded.
- Sensitive columns can be excluded from AI context.
- Every AI result shows its SQL and source context.
- A small evaluation suite runs in CI or a repeatable local command.
- New ClickHouse versions do not silently break older supported behavior.
- A user can inspect and delete AI context and artifact history according to policy.
- A failed or slow request can be traced from the UI to ClickHouse without searching raw logs manually.
- A group without SQL-generation permission cannot invoke that tool through a follow-up or multimodal path.
- Token and message caps produce a clear product state and an audit event.
- A published answer remains reproducible after its source query becomes a newer draft.
- A metric contract change shows affected artifacts before publication.
- An evaluation fixture catches a semantically wrong but syntactically valid query.
- A proposal cannot execute while the workspace is in inspect, propose, or apply-to-draft mode.
- A failed multi-file edit can restore the previous hunks without reverting unrelated changes.
- Keyboard-only users can open a file, run a selected statement, inspect the error, and restore the draft.
- An untrusted workspace cannot reuse a saved connection without an explicit trust transition.
- A shared bounded result clearly states its row/byte limit and cannot be rerun without permission.
- Query history from one file cannot expose another user’s SQL or result without authorization.
- Two concurrent runs remain independently cancellable and correctly attributed.
- A multi-statement script cannot let one statement bypass the limits or safety mode of the script.
- A shared draft makes its viewer, editor, and executor roles explicit.
- A viewer cannot mistake unsaved edits for the last executed revision.
- Result retention and cache expiration are enforced independently from document version retention.
- A reference and a copied chart have different permissions and lineage behavior.
- Performance profiles require the same query visibility or monitoring permission as the underlying execution.
- Schedules and alerts cannot run drafts, and recipients receive only data allowed by the configured execution identity.

## Sources

- [ClickHouse concurrency and query telemetry](https://clickhouse.com/resources/engineering/high-concurrency-sizing-user-analytics)
- [ClickHouse query telemetry](https://clickhouse.com/resources/engineering/high-concurrency-sizing-user-analytics)
- [Metabase AI controls](https://www.metabase.com/docs/latest/ai/overview)
- [Metabase AI usage controls](https://www.metabase.com/docs/latest/ai/usage-controls)
- [Databricks dashboard concepts](https://docs.databricks.com/gcp/en/dashboards/concepts)
- [Snowflake notebooks in Workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/notebooks-in-workspaces)
- [ClickHouse 26.7 documentation and SQL workspace](https://clickhouse.com/blog/clickhouse-release-26-07)
- [Visual Studio Code terminal and workspace safety](https://code.visualstudio.com/docs/terminal/basics)
- [JetBrains local history](https://www.jetbrains.com/help/idea/local-history.html)
- [Zed tasks](https://zed.dev/docs/tasks)
- [Databricks new SQL editor](https://docs.databricks.com/gcp/en/sql/user/sql-editor/)
- [Snowflake query history](https://docs.snowflake.com/en/user-guide/ui-snowsight-query)
- [Metabase SQL editor](https://www.metabase.com/docs/latest/questions/native-editor/writing-sql)
- [Metabase dashboards and copies](https://www.metabase.com/docs/latest/dashboards/introduction)
- [Databricks run and share queries](https://docs.databricks.com/gcp/en/sql/user/sql-editor/run-queries)
- [Snowflake query history](https://docs.snowflake.com/en/user-guide/ui-snowsight-query)

## Thread pickup

Before calling the product production-ready, add failure fixtures. A polished happy path is not enough for a database tool. Make the evaluation suite run against both the local 24.6 server and at least one newer supported version when possible.
