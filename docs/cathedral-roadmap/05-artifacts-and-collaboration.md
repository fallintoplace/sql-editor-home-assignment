# Stage 5: Artifacts and collaboration

## Mission

Turn temporary query output into durable, inspectable work. A user should be able to share the insight without sending a screenshot that hides the SQL.

An artifact is the unit of ownership, review, sharing, AI context, and future collaboration.

## Borrow

- Hex: cells and downstream dependencies form a practical analysis graph.
- Mode: report layout, run history, notebook-style outputs, and sharing.
- ClickHouse Playground: saved queries, saved chart configuration, and shareable links.
- Snowflake: files as a natural unit of SQL work.
- Snowflake notebooks: governed collaboration, version history, and files that can be moved through a controlled lifecycle.
- Databricks dashboards: draft edits, published snapshots, parameters, and permission-aware sharing.
- Mode datasets: a successful query can become a reusable, refreshable, permissioned dataset.

## Adapt for ClickHouse

Use a small artifact graph instead of building a full notebook first:

```text
Question
  -> SQL file
  -> execution
  -> result snapshot
  -> chart or table
  -> explanation
```

Use explicit artifact types:

- **Workspace:** connection references, drafts, tabs, and layout.
- **Query document:** SQL, parameters, schema context, and revision history.
- **Run:** execution envelope, query ID, settings, errors, and telemetry links.
- **Result snapshot:** schema, bounded data, freshness, and completeness state.
- **View:** table or chart configuration derived from a result.
- **Narrative:** human or OpenAI explanation linked to evidence.

SQL documents should remain plain, portable files at the center of the graph. Store SQL as text with a small metadata envelope for connection reference, editor layout, parameters, and result links. This keeps the workspace exportable, diffable, and understandable outside the application.

Every artifact stores:

- SQL text and selected statement.
- Connection profile identifier, never its secret.
- Database and schema context.
- Parameters and execution settings.
- Result schema and snapshot timestamp.
- Chart configuration.
- Prompt and model metadata when OpenAI helped.
- A lineage link to its parent artifact.

Never store connection secrets inside an artifact. Store a stable connection profile reference and make access resolution happen on the server.

### Drafts, publication, and dataset promotion

Artifacts need a small but explicit lifecycle:

```text
draft -> reviewed revision -> published snapshot -> refreshed revision
```

- A draft can change SQL and layout freely.
- A reviewed revision records the evidence a reviewer accepted.
- A published snapshot freezes SQL, parameters, result freshness, chart configuration, and access policy.
- A refresh creates a new revision and clearly marks downstream views as current, stale, or failed.
- A query can be promoted to a reusable dataset only after its owner, source, refresh policy, and permissions are explicit.
- Reusable SQL snippets are first-class artifacts with owners, permissions, parameter contracts, and an inspectable expansion preview.
- A live shared draft exposes collaborators and comments, while a published snapshot remains immutable.
- A result or chart added to another artifact is either a reference that follows the source or a labeled copy that can diverge.
- A schedule or alert references a published revision and produces runs; it never executes an uncommitted draft.

Do not silently turn every query into a materialized dataset. Promotion is a deliberate product action with a visible storage and freshness consequence.

### Sharing

Provide a read-only share URL or export file. The recipient should see:

- The result snapshot.
- The SQL behind it.
- The source connection and timestamp.
- Whether the result is stale.
- How to rerun it, if they have access.

Do not imply a snapshot is live data. Label it clearly.

### Collaboration ergonomics

Borrow mature editor collaboration without turning the workspace into a social feed:

- Show a file tree, recent files, open tabs, and last-edited locations.
- Keep a local history timeline that can restore deleted SQL or selected hunks before the next sync.
- Make revisions diffable as SQL and metadata, not only as rendered screenshots.
- Allow a reviewer to comment on a SQL range, result cell, chart mark, or evidence block.
- Let users export a patch or workspace bundle for review in a normal source-control workflow.
- Keep shared artifacts immutable by default; edits create a new draft or revision.
- Organize artifacts into collections or folders, but keep one canonical source. Adding a chart to a report creates a reference or an explicitly labeled copy.
- Comments and live collaboration attach to the file revision, not to a transient browser tab.

Share links should support two modes:

1. **Snapshot mode:** safe to send without database credentials; includes SQL, result metadata, and bounded data if permitted.
2. **Live mode:** reruns only when the recipient has permission for the referenced connection.

If the source query changes, preserve the old snapshot and show the new revision as a separate version.

### Collaboration

Start with comments on a result or SQL range. Add collections and project permissions later. The first collaboration feature should improve review, not become a social feed.

Include an evidence panel in review comments. A comment should be able to point to a SQL range, result column, chart mark, query ID, or HyperDX trace.

### Dependency graph

Show dependencies when one artifact uses another:

```text
query document -> run -> result snapshot -> chart / narrative / follow-up query
```

The graph should explain which revision and snapshot each downstream object used. This borrows Hex’s dependency clarity while keeping the core object model SQL-first.

### Retention and recovery

Keep retention classes separate:

- Local history: frequent checkpoints for accidental edits and hunk restore.
- Revisions: named, shareable states retained according to workspace policy.
- Runs: query facts and result references retained according to connection policy.
- Published snapshots: explicit expiration and deletion controls.

Deletion should move an artifact to recoverable trash first. Permanent purge is a separate, audited action and must explain which downstream links will stop resolving.

### Automation handoff

Scheduling and alerts are downstream of publication:

- A schedule has owner, execution identity, parameter defaults, timezone, frequency, limits, and pause state.
- An alert has a condition, recipient policy, data permissions, and last evaluation result.
- Every evaluation creates a normal run artifact with success, failure, no-match, or permission-denied status.
- Changing the source query creates a draft and does not alter the active schedule until explicitly published.

## Acceptance gate

- Save a query, chart, and result as one reusable artifact.
- Reopen it after a browser restart.
- Export and import a workspace artifact.
- Share a snapshot that includes SQL and freshness metadata.
- Preserve lineage when an artifact is edited into a new version.
- Delete and export behavior is explicit and recoverable.
- A shared snapshot does not accidentally reveal a connection secret.
- AI-generated narratives retain the prompt/context decision and user approval.
- Publishing freezes the evidence bundle and marks later drafts as divergent.
- A dataset refresh creates a new snapshot without destroying the prior one.
- A reviewer can trace a chart or narrative back to its query, run, connection, and result snapshot.
- Permissions prevent a shared artifact from resolving a connection the recipient cannot access.
- Restore and delete actions are recoverable and visible in revision history.
- SQL documents export as readable files with stable metadata and deterministic diffs.
- A reviewer can restore a deleted file or selected hunk from local history without reverting unrelated work.
- A shared revision opens at the same SQL range, result tab, and evidence anchor.
- A snippet consumer can see the snippet revision and expanded SQL before running.
- Moving an artifact between collections does not silently break dashboards or downstream queries.
- A copied chart or result is labeled as a copy and retains a link to its source artifact.
- A collaborator can distinguish live draft, last executed revision, and published snapshot.
- Expiring or deleting a snapshot shows affected charts, narratives, and follow-up queries before confirmation.
- Recovery restores an artifact and its lineage without reviving credentials or bypassing current permissions.
- A schedule cannot target a draft or deleted revision.
- Pausing, resuming, or changing an alert records who changed it and which published revision it uses.
- Notification recipients never receive data outside the execution identity’s permissions.

## Sources

- [Mode notebook workflow](https://mode.com/help/articles/notebook/)
- [Mode report layout and run history](https://mode.com/help/articles/report-layout-and-presentation/)
- [Hex project sharing](https://learn.hex.tech/docs/collaborate/sharing-and-permissions/project-sharing)
- [Mode reusable datasets](https://mode.com/help/articles/datasets/)
- [Snowflake notebooks in Workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/notebooks-in-workspaces)
- [Databricks dashboard concepts](https://docs.databricks.com/gcp/en/dashboards/concepts)
- [Visual Studio Code source control](https://code.visualstudio.com/docs/sourcecontrol/overview)
- [JetBrains local history](https://www.jetbrains.com/help/idea/local-history.html)
- [Databricks SQL editor](https://docs.databricks.com/gcp/en/sql/user/sql-editor/)
- [Metabase questions and collections](https://www.metabase.com/docs/latest/questions/introduction)
- [Metabase SQL snippets](https://www.metabase.com/docs/latest/questions/native-editor/snippets)
- [Metabase dashboards](https://www.metabase.com/docs/latest/dashboards/introduction)
- [Metabase permissions and alerts](https://www.metabase.com/docs/latest/permissions/notifications)
- [ClickHouse SQL Playground](https://clickhouse.com/blog/announcing-the-new-sql-playground)

## Thread pickup

Implement the artifact data model before building a complicated sharing UI. The model is the foundation for reproducibility, AI review, and later collaboration. Use local drafts first, then add SQLite/Drizzle persistence when server-side sharing needs durable ownership.
