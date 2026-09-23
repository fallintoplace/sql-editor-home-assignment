# Stage 10: Launch and ClickHouse moat

## Mission

Turn the strong demo into a product that is hard to replace for ClickHouse users.

The launch story must be one memorable workflow, not a list of disconnected features:

> Investigate a slow or surprising ClickHouse result, understand the evidence, fix the query, and share the proof.

## Borrow

- Snowflake: file-based workspaces and Git-shaped collaboration.
- Mode: shareable reports, run history, and presentation layout.
- Hex: reusable analysis projects and downstream outputs.
- ClickHouse Cloud: native ingestion, exploration, and visualization flow.
- Snowflake and Databricks: files, governed collaboration, semantic context, parameters, and published snapshots.
- Metabase: semantic definitions, provider choice, embedded answers, and usage controls.
- ClickHouse 26.7 web UI: tabs, persistent snapshots, progressive results, richer column diagnostics, and version-matched docs.
- ClickStack: a ClickHouse-native observability surface that correlates logs, traces, metrics, and sessions.
- Claude Code: scoped context, reusable playbooks, deterministic lifecycle hooks, checkpoints, and isolated side work.
- OpenAI coding workspaces: project continuity, read-only review, long-running work, scheduled follow-up, structured tools, and optional UI resources.

## The moat

### 1. Performance copilot

Explain why a query is slow using real ClickHouse evidence:

- `EXPLAIN` output.
- Rows and bytes read.
- Partitions and ordering keys.
- Memory and thread usage.
- Query log history.
- Suggested changes with before-and-after measurements.
- Links to the exact query run, result artifact, and HyperDX trace.
- Safe explanations for `ORDER BY`, partitioning, projections, `PREWHERE`, joins, and approximate functions.

The explanation must link to the exact artifact, not just produce a paragraph. A user can compare two runs, see the changed setting or SQL, and publish the evidence.

### 2. ClickHouse-native examples

Ship a library of small, runnable examples for time series, logs, observability, analytics, arrays, JSON, geospatial data, and approximate aggregation. Every example should include a dataset, SQL, chart, and explanation.

Examples should be runnable against the local Docker setup, link to the relevant ClickHouse documentation, and demonstrate one ClickHouse idea at a time. The catalog becomes a teaching surface for noobs and a shortcut library for experts.

### 3. Metric contracts with visible SQL

Semantic definitions are a useful market expectation, but hidden semantics would weaken the ClickHouse wedge. A metric contract keeps the definition, grain, filters, source columns, time zone, owner, and revision visible beside generated SQL. It can be reused by Ask Data, charts, datasets, and published answers. When the contract changes, affected artifacts are easy to find.

### 4. Self-hosted first, cloud friendly

Keep local Docker support excellent. Add connection profiles for ClickHouse Cloud and remote servers. Do not force data movement into a hosted service to get a good UI.

Package the product as a single application plus ClickHouse for the basic path. Make HyperDX/ClickStack an optional observability profile rather than a mandatory dependency for every evaluator.

### 5. Embed and API surface

Allow a saved chart or result to be embedded. Expose artifact and execution endpoints so teams can build internal workflows around the workspace.

### 6. Product polish

- Light mode default, dark mode complete.
- Accessible keyboard navigation.
- Fast cold start.
- Clear empty and error states.
- Import data from CSV/JSON with preview and explicit mapping.
- Export SQL, result, chart, and workspace bundle.
- Click UI is visually consistent across light and dark mode.
- OpenAI context sharing is visible and reviewable.
- HyperDX links work from query errors and slow-query evidence.
- Draft and published states are obvious in every shareable view.
- A result can be promoted to a refreshable dataset with lineage and permissions.
- Cross-filter and drill-through actions reveal the child SQL.

### 7. ClickHouse IDE ergonomics

The editor is part of the moat because it is where trust is built:

- Command palette and fuzzy navigation across files, schema, results, contracts, runs, and docs.
- SQL language intelligence: completion, hover metadata, diagnostics, outline, go-to-definition, references, formatting, and statement-aware selection.
- Split panes, recent locations, multi-cursor editing, and editable search results.
- Local history with hunk restore before AI edits, formatting, imports, and publication.
- Typed task runner for run, explain, profile, import preview, and trace navigation.
- Clear inspect, propose, apply-to-draft, and execute modes.

This is the best of mature code editors adapted to ClickHouse. It is deliberately not a generic IDE or shell replacement.

### 8. Durable operating system

Make the application repeatable without making it opaque:

- Workspace constitutions and artifact rules are versioned, scoped, and inspectable.
- Playbooks are reusable workflows with typed inputs, tool permissions, limits, and output artifacts.
- Review-only passes report prioritized evidence without changing the source.
- Lifecycle guards protect execute, publish, refresh, export, and notify boundaries.
- Checkpoints and rewind make failed AI edits and performance experiments recoverable.
- Long-running investigations and monitors have explicit done criteria, quiet no-change behavior, notification policy, and a link back to the same evidence bundle.

This is the difference between adding an assistant and building a dependable analytical workspace.

### Competitive borrow-and-beat matrix

| Product pattern | We borrow | We beat it for ClickHouse |
| --- | --- | --- |
| Databricks unified SQL editor | File browser, assistant pane, command palette, comments, version history, collaborative results | Server-native progress, cancellation, plans, query IDs, and performance evidence |
| Snowflake Workspaces | Nested files, database explorer, split panes, current-file history, simultaneous queries | ClickHouse scripts, richer typed results, explicit child lineage, and native diagnostics |
| Metabase questions and snippets | Query-plus-visualization objects, reusable SQL blocks, parameters, collections | Multi-statement support, result snapshots with execution truth, and transparent drill-through |
| Claude Code and OpenAI coding workspaces | Scoped context, reusable playbooks, read-only review, guardrails, checkpoints, and background work | SQL-native evidence, ClickHouse permissions, query IDs, and reproducible result lineage |

The claim is not “more buttons.” It is that every borrowed convenience keeps its SQL, permissions, freshness, query ID, and ClickHouse evidence attached.

### What we should deliberately do differently

- Do not hide behind a generic “saved question.” Show the exact ClickHouse statement, settings, query ID, and result lifetime.
- Do not copy the ambiguity of a shared editor where the latest run silently becomes the visible truth. Label draft, last executed, and published states.
- Do not pretend all result filters are reruns. Mark local result filters separately from child SQL executions.
- Do not silently copy charts into dashboards. Preserve references or label copies and expose lineage.
- Do not treat a 64,000-row or 10 MB-style preview as the complete answer. Make row, byte, and expiration limits part of every result contract.
- Do not hide partial script failure behind one green status. Show every statement’s outcome.
- Do not make workspace instructions one giant prompt. Show the active context layers and load repeatable procedures on demand.
- Do not let a model prompt act as a security boundary. Enforce lifecycle guards in the run and publication path.
- Do not make background work a detached notification. Every notification must reopen the exact revision, run, result, profile, and permission context.

## Release sequence

1. **Core release:** SQL, results, charts, scripts, and file import.
2. **Differentiated demo:** ClickHouse telemetry plus reviewable OpenAI copilot.
3. **Trustworthy analysis:** reusable result objects, metric contracts, draft/published artifacts, and cross-filter lineage.
4. **Wow release:** Ask Data, image input, and shareable evidence bundles.
5. **Serious product:** governance, evaluations, performance copilot, Cloud/ClickStack connections, and self-hosted deployment.
6. **Durable operating system:** scoped playbooks, review lane, lifecycle guards, checkpoints, isolated experiments, and quiet scheduled monitoring.

Each release has a demo test:

- A noob can run a safe example.
- A technical analyst can edit and chart it.
- A data engineer can inspect why it cost what it cost.
- A reviewer can reproduce and share the evidence.

## Final definition of better

ClickHouse’s own web UI is already removing the “basic console” gap. We do not beat Snowflake, Databricks, or Metabase by copying their entire surface area. We beat them for ClickHouse work by combining:

- ClickHouse execution truth.
- Snowflake-level workspace ergonomics.
- Databricks-style conversational analysis.
- Metabase-style reviewable answers.
- Hex/Mode-style reusable artifacts.
- A transparent metric-contract layer with no hidden SQL.
- ClickStack-style analytics and observability correlation.
- OpenAI multimodal interaction.
- Code-editor-grade navigation, history, and review controls.

The winning product is the one where a ClickHouse user can move from question to trusted result with less guessing, less waiting, and less hidden state.

The mature-product lesson is that the winning unit is not a chart. It is a **trusted, runnable, monitorable artifact** with:

- source SQL and parameters;
- execution identity and permission snapshot;
- result and profile retention;
- visualization and lineage;
- revision and owner;
- optional schedule or alert;
- a failure path that returns to the same evidence.

The defensible loop is:

```text
ClickHouse execution truth
  + Click UI workspace
  + OpenAI reviewable assistance
  + HyperDX operational correlation
  = a ClickHouse SQL workspace that teaches, debugs, and proves
```

## Launch scorecard

Measure the wedge with outcomes rather than generated content:

- Time from question to first reviewed result.
- Percentage of shared results with SQL, query ID, freshness, and source context.
- Percentage of accepted SQL proposals that pass syntax and semantic fixtures.
- Time to explain a slow query using a before-and-after run comparison.
- Reopen and rerun success for published artifacts.
- Number of stale or permission failures correctly surfaced instead of hidden.
- p95 workspace responsiveness while receiving progressive results.
- Time to open a saved SQL file and reach the correct statement or result.
- Percentage of editor actions that are discoverable through the command palette.
- Successful recovery rate after a rejected edit, failed run, refresh, or browser restart.
- Percentage of SQL, visual, and explore answers that retain source-query lineage.
- Percentage of snippets and metric contracts with visible owner, revision, and permission state.
- Percentage of shared results whose viewer can correctly identify draft, executed, published, and expired state in usability testing.
- Percentage of chart interactions correctly classified as local view changes versus database reruns.
- Percentage of monitors pointing only to published revisions.
- Percentage of performance explanations backed by an operator profile and a before/after run.
- Alert recipients who can open the linked evidence without encountering an unexplained permission failure.
- Percentage of playbook runs with visible inputs, version, limits, and output artifacts.
- Percentage of blocked actions with a clear rule ID and remediation path.
- Successful draft recovery after an AI edit or isolated performance experiment.
- Percentage of no-change monitor runs that stay quiet while preserving an auditable run record.

Kill or redesign features that increase chat volume but do not improve trusted insight, reproducibility, or ClickHouse performance clarity.

## Sources

- [ClickHouse 26.7 web workspace](https://clickhouse.com/blog/clickhouse-release-26-07)
- [Snowflake notebooks in Workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/notebooks-in-workspaces)
- [Snowflake Copilot](https://docs.snowflake.com/en/user-guide/snowflake-copilot)
- [Databricks AI/BI](https://docs.databricks.com/gcp/en/ai-bi)
- [Databricks dashboard concepts](https://docs.databricks.com/gcp/en/dashboards/concepts)
- [Metabase AI usage controls](https://www.metabase.com/docs/latest/ai/usage-controls)
- [Mode reusable datasets](https://mode.com/help/articles/datasets/)
- [ClickStack observability](https://clickhouse.com/clickstack)
- [Visual Studio Code editor overview](https://code.visualstudio.com/docs/editing/getting-started/overview)
- [Visual Studio Code source control](https://code.visualstudio.com/docs/sourcecontrol/overview)
- [Zed finding and navigating](https://zed.dev/docs/finding-navigating)
- [Zed multibuffers](https://zed.dev/docs/multibuffers)
- [Zed tasks](https://zed.dev/docs/tasks)
- [JetBrains source navigation](https://www.jetbrains.com/help/idea/navigating-through-the-source-code.html)
- [JetBrains local history](https://www.jetbrains.com/help/idea/local-history.html)
- [Sublime Text quick panel](https://www.sublimetext.com/docs/themes.html)
- [Databricks new SQL editor](https://docs.databricks.com/gcp/en/sql/user/sql-editor/)
- [Snowflake Workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces)
- [Metabase SQL editor](https://www.metabase.com/docs/latest/questions/native-editor/writing-sql)
- [Metabase SQL snippets](https://www.metabase.com/docs/latest/questions/native-editor/snippets)
- [Databricks query profile](https://docs.databricks.com/gcp/en/sql/user/queries/query-profile)
- [Snowflake Git workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces-git)
- [Snowflake shared workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces-shared)
- [Metabase permissions and notifications](https://www.metabase.com/docs/latest/permissions/notifications)
- [Claude Code steering: rules, skills, hooks, and subagents](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)
- [Claude Code user FAQ](https://support.claude.com/en/articles/14554922-claude-code-user-faq)
- [OpenAI project workspaces](https://learn.chatgpt.com/docs/projects)
- [OpenAI scheduled tasks](https://learn.chatgpt.com/docs/automations)
- [OpenAI long-running work](https://learn.chatgpt.com/docs/long-running-work)
- [OpenAI code review workflow](https://learn.chatgpt.com/docs/code-review)
- [OpenAI hooks](https://learn.chatgpt.com/docs/hooks)
- [OpenAI MCP](https://learn.chatgpt.com/docs/extend/mcp)

## Thread pickup

Complete the first four stages as one usable product. Build the remaining capabilities on that base, and expand scope only when the previous acceptance gate is green. Launch when the core workflow works with a clean local setup and a reproducible artifact.
