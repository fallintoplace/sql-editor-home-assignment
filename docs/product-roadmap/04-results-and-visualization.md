# Stage 4: Results laboratory

## Mission

Make a query result useful before a user writes another query. The table, chart, filters, and diagnostics should share one typed result model.

The result viewer is not a passive response body. It is the product’s evidence surface.

## Borrow

- ClickHouse charts: SQL-first chart definitions and useful time macros.
- Databricks Genie: table result, automatic summary, visualization, and filters.
- Hex: preview fast, compile full results downstream, and let later outputs depend on earlier outputs.
- Metabase: easy chart creation and visible links back to the underlying query.
- Databricks dashboards: parameters, field filters, cross-filtering, drill-through, and explicit published snapshots.
- ClickHouse 26.7 web UI: column bars or heatmaps, categorical coloring, pinned columns, and progressive results.
- Mode: promote a successful query into a reusable dataset with refresh and permissions.
- Databricks SQL editor: explore, visualize, download, and filter results while keeping the query in the same editor.
- Snowflake Workspaces: pin or split result panes and compare query-history rows with their results.
- Metabase questions: query plus visualization as one saved unit, with an optional child exploration from SQL results.

## Adapt for ClickHouse

### Typed result model

Each result column should retain:

- Name.
- ClickHouse type.
- Nullable state.
- Display formatter.
- Sample values.

Preserve dates, decimals, UUIDs, arrays, tuples, maps, and nested values instead of flattening everything to strings.

The protocol should distinguish:

- `preview`: bounded rows fetched for immediate inspection.
- `complete`: all rows that the server chose to return.
- `truncated`: the server or client stopped at a limit.
- `cached`: reused from a known result snapshot.
- `stale`: displayed from an earlier run.

Every table and chart must show this state.

Also show result lifetime:

- **Live:** streaming or actively executing.
- **Reopenable:** retained by the server or product and viewable without rerun.
- **Snapshot:** bounded data intentionally frozen for sharing.
- **Expired:** metadata remains, but the data requires a permission-checked rerun.

Never use “cached” as a synonym for “current.” A cached result needs the original query ID, execution time, settings, and expiration state.

### Table experience

- Virtualized rows for large responses.
- Sticky headers.
- Type-aware formatting.
- Search and filter controls that show whether filtering is local or server-side.
- Column pinning, copy, CSV/JSON export, and row inspection.
- A clear distinction between a preview and a complete result.
- Column-level type and null treatment are inspectable.
- Local filters never pretend to reduce database cost.
- Server-side filters create a new child query and preserve lineage.
- Copying or exporting a result includes the query ID and timestamp when possible.
- Offer optional column bars, heatmaps, categorical coloring, and pinned columns for fast shape recognition. These decorations never replace the raw value or type.
- A selected cell, column, or chart mark can become a filter action. Cross-filtering must show the child query and preserve parent lineage.
- Column inspectors can show mini histograms, null distribution, cardinality, and representative values when the data contract permits it.
- Any result transformation that triggers a server-side child query shows that it may consume compute; local formatting stays clearly free of database cost.

### Result as an editor surface

The result pane should have editor-grade navigation rather than behave like a screenshot:

- `Cmd/Ctrl+F` searches values and columns without losing the current query selection.
- `Cmd/Ctrl+P` can jump between result tabs, snapshots, and the source query.
- Column and row inspectors show type, nullability, source expression when known, and formatting decisions.
- A result outline lists columns, filters, aggregates, and chart encodings.
- Keyboard navigation, copy-as-SQL/CSV/JSON, and pinned columns work without forcing a mouse workflow.
- Errors and stale states are inline and linked back to the exact run or revision.

Do not turn the result view into a spreadsheet clone. Its job is to help a user inspect evidence, make a deliberate child query, and return to the source SQL.

### Chart experience

Start with number, table, line, bar, stacked bar, area, pie, and scatter. Recommend a chart from column types, but keep the recommendation editable.

Use Apache ECharts behind a small chart adapter. Store a chart as declarative configuration, not as an opaque rendered image. The first recommendation should explain why it chose the x-axis, y-axis, grouping, and aggregation.

Store chart configuration beside the SQL. A chart must be reproducible from the query, connection, parameters, and config.

### Reusable result objects

Treat a result as a typed object that can be used again:

- A result can feed a chart, a narrative, a follow-up query, or a metric contract.
- A user can promote a stable query to a named dataset with owner, refresh policy, permissions, and upstream revision.
- Refresh creates a new snapshot and keeps the old snapshot available for comparison.
- A CSV or JSON upload can become a temporary input object with an explicit lifetime and no implicit database write.
- Downstream objects show whether they use a preview, a full result, or a published snapshot.

This borrows the strongest idea from Hex and Mode without prematurely building a notebook or a hidden materialization engine.

### Execution insight

Show elapsed time, rows read, bytes read, rows returned, and progress when available. Give the user an “inspect query” view with settings and explain options.

Add a “why is this expensive?” entry point that opens the evidence panel from query metadata, `EXPLAIN`, and `system.query_log`. Do not make performance advice part of the chart renderer.

### Performance profile artifact

When the connection supports it, save an operator-level profile beside the run:

- Operator or pipeline shape.
- Time, rows, bytes, memory, and spill indicators.
- Top expensive operators.
- Query text and settings used for the run.
- Permission required to view the profile.
- Before-and-after comparison when a proposed fix is rerun.

Profiles can be exported as a portable JSON evidence bundle and re-imported for review without pretending the imported profile is a live run.

A profile may be unavailable for a cached run. Explain that limitation and offer a deliberate fresh rerun with the same parameters and a new query ID.

### Query-to-result continuity

Preserve editor context across the run:

- The selected statement, cursor location, and revision remain available beside the result.
- Opening a diagnostic returns to the exact SQL range that produced it.
- Opening a chart mark creates a visible child-filter task rather than mutating the parent query.
- Comparing two runs opens a split evidence view with SQL, settings, result state, and timing aligned.

### Question object, ClickHouse edition

Use the useful Metabase idea of a saved question, but make the object richer:

```text
SQL document + selected statement + parameters
  -> run history + query ID
  -> result snapshot
  -> table / chart / child exploration
```

Saving a result view never detaches it from its SQL. A child exploration creates a new query document or view with parent lineage. The product supports multi-statement scripts where each statement gets its own result object instead of flattening the script into one question.

Each result tab supports explicit actions: rename, duplicate as a new view, download, add by reference to a report, or create a labeled copy. A copy inherits provenance but can change its visualization without changing the source view.

## Acceptance gate

- The original query requirement is complete: table result plus at least one useful chart.
- A script can show multiple result tabs.
- Large results do not freeze the browser.
- A chart can be saved and reopened with its SQL.
- The user can see whether the chart is based on a preview or a full result.
- Local filtering is clearly labeled as local, and reruns preserve parent-child lineage.
- Result rendering stays responsive with a large bounded response.
- A failed chart recommendation never hides the usable table result.
- Column profiling and visual decorations remain responsive on wide and nested result sets.
- Cross-filtering creates an inspectable child query with parent lineage.
- A published result snapshot remains stable while a draft query changes.
- A query can be promoted to a reusable dataset with an explicit refresh and permission state.
- CSV/JSON upload previews mapping before any insert or table creation is attempted.
- Keyboard search and navigation remain responsive for large bounded results.
- A result diagnostic can jump back to the source SQL range and then return to the same result tab.
- Two runs can be compared without losing the parent query or evidence lineage.
- A saved table or chart always opens its source SQL, parameters, run, and result history.
- A child exploration is a new inspectable artifact with parent lineage and its own query ID.
- Multiple statement results can be pinned and compared side by side.
- Expired, cached, stale, and live results have different labels and actions.
- Adding a result to a report records whether it is a reference or a copy.
- A partial script result shows per-statement status and does not pretend the whole script succeeded.
- A query profile is linked to the run and distinguishes cached execution from a fresh profile.
- A profile can be shared or imported with its source query, query ID, permissions, and non-live status intact.
- Column statistics identify whether they describe the returned preview, a full result, or a server-side analysis.
- A cached run cannot be presented as a fresh performance profile.

## Sources

- [ClickHouse SQL Playground](https://clickhouse.com/blog/announcing-the-new-sql-playground)
- [ClickHouse SQL charts and macros](https://clickhouse.com/blog/whats-new-in-clickstack-march-2026)
- [Databricks Genie responses](https://docs.databricks.com/aws/en/genie/talk-to-genie)
- [Metabase native SQL editor](https://www.metabase.com/docs/latest/questions/native-editor/writing-sql)
- [Hex SQL cells](https://learn.hex.tech/docs/explore-data/cells/sql-cells/sql-cells-introduction)
- [Mode reusable datasets](https://mode.com/help/articles/datasets/)
- [Databricks dashboard concepts](https://docs.databricks.com/gcp/en/dashboards/concepts)
- [ClickHouse 26.7 web workspace](https://clickhouse.com/blog/clickhouse-release-26-07)
- [Visual Studio Code editor overview](https://code.visualstudio.com/docs/editing/getting-started/overview)
- [JetBrains source navigation](https://www.jetbrains.com/help/idea/navigating-through-the-source-code.html)
- [Databricks new SQL editor](https://docs.databricks.com/gcp/en/sql/user/sql-editor/)
- [Snowflake Workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces)
- [Metabase questions](https://www.metabase.com/docs/latest/questions/introduction)

## Thread pickup

Finish this stage before adding elaborate AI. AI should produce or explain the same query, result, and chart objects that a human can build. Use recorded result fixtures to test empty, wide, nested, null-heavy, and truncated outputs.
