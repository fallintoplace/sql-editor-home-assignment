# Native exploration workflows

ClickStudio connects object metadata, physical storage activity, and query-run evidence without adding another top-level workspace mode.

## Materialized views

Open **Objects → View dependencies** to inspect materialized views in the connection's database. Select a graph node to see its target, refresh schedule, latest successful refresh, duration, next refresh, and available refresh telemetry. Search focuses the graph on matching objects and their immediate neighbors.

The graph distinguishes insert triggers, write targets, explicit refresh ordering (`DEPENDS ON`), and catalog-loading dependencies. Catalog dependencies are not full SQL data lineage. External objects remain identifiable when their metadata is outside the database snapshot. Refresh modes come from the actual CREATE header and telemetry; ClickStudio does not assume a server version or enable experimental settings.

The reader probes optional `system.tables` columns and uses `system.view_refreshes` when accessible. Missing permissions or older versions retain available metadata and explain missing refresh evidence. Up to 250 table records, 500 graph objects, and 1,500 relationships are retained; the interactive graph shows at most 120 objects at once. Metadata outside those bounds is explicitly marked incomplete.

## Parts, merges, and mutations

Open a MergeTree table's **Visualize parts** action, or the existing **MergeTree parts** panel. Its tabs are **Parts | Merges | Mutations**.

Merges display source parts, the resulting part, ClickHouse progress, elapsed time, average uncompressed read rate, and memory. Mutations show commands, creation time, remaining parts, completion state, and the latest failure details. Zero remaining parts is not treated as completion: `is_done` is authoritative, and the UI does not invent a progress percentage.

Live activity refresh is opt-in every five seconds, starts the next timer after the previous request finishes, and pauses while the tab is hidden or the panel is inactive. Closing or changing the view aborts its request. Each view is bounded to 50 records and uses fixed parameterized, read-only queries. No merge, mutation, or refresh commands are issued. Metadata is read from the connected server, not a ClickStudio-issued cluster aggregation.

## Query-run comparison

Use **History → Compare runs** or **Insights → Compare runs**. Choose two completed query runs on the same connection, inspect before/after metrics, and swap their order. Matching terminal query-log evidence is preferred; client duration and run progress are used only when both sides have the same source. Missing counters remain unavailable, exact integer values are retained, and percentage changes handle zero baselines.

The comparison shows SQL, parameters, configured limits, and pipelines previously loaded for those runs in the current workspace session. Pipeline operator inventory changes and side-by-side graphs are inspection evidence, not proof of equivalent results or historical runtime plans. Comparison never re-executes SQL or EXPLAIN; **Load query-log metrics** only reads evidence for selected query IDs. Retained row counts do not establish result equivalence. Individual runs are not controlled benchmarks: cache state, data, and concurrent load may differ.

## Hosted preview

The hosted preview uses the browser Playground reader for live metadata. Permission errors and empty system tables remain explicit. Sample mode includes labelled, static materialized-view, merge, and mutation examples; fixtures are never substituted for failed live reads. Run comparison uses retained history available to the selected connection.

## Reader setup

For the bundled local server, rerun `npm run db:setup` after updating. The setup grants the application reader SELECT on `system.merges`, `system.mutations`, and `system.view_refreshes` in addition to its existing catalog access. The web app continues to use its reader credentials; setup is an operator-only command.

For an existing connection, the administrator can grant access to the specific metadata tables needed for each view. Query-log access remains separately opt-in because it can expose SQL from other users. ClickStudio never changes grants on a connected server.
