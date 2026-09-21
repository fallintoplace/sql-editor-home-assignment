# Stage 3: Workspace and SQL editor

## Mission

Create a calm, fast SQL workspace that feels closer to a serious IDE than a form with a Run button.

The workspace should welcome a new ClickHouse user in under one minute while giving an experienced data engineer keyboard-first control.

## Borrow

- Snowflake Workspaces: SQL files, tabs, file-oriented flow, inline suggestions, and Git-friendly thinking.
- Snowflake worksheets: object explorer, autocomplete, query history, and quick insertion of table or column names.
- ClickHouse web UI: multiple tabs, saved titles and parameters, schema-aware completion, inline errors, and progressive execution.
- Snowflake notebooks: governed files, version history, and collaboration around a workspace rather than a disposable worksheet.
- Databricks dashboards: a clear draft-versus-published boundary and reusable parameters.
- Databricks’ new SQL editor: file browser, schema browser, assistant pane, command palette, code folding, comments, version history, and query results in one surface.
- Snowflake Workspaces: nested folders, file upload, database explorer, split editor/results, current-file versus all-file query history, and two simultaneous queries from one file.
- Metabase SQL editor: selection execution, formatting, snippets, parameters, saved question history, and a direct path from SQL results to a child visual exploration.

## Adapt for ClickHouse

### UI system

Use Click UI for product components, theme tokens, focus states, and accessible interaction patterns. Use Tailwind for layout and responsive composition. Do not create a second design system beside Click UI.

### Layout

- Left: connection and schema explorer.
- Center: tabs with SQL editors.
- Bottom: execution status and result tabs.
- Right: assistant drawer, documentation, or query inspector.

The right drawer must be resizable and dismissible. The SQL editor remains the primary surface.

The shell should feel file-oriented without pretending to be a full notebook runtime:

- Workspaces contain folders, SQL documents, saved views, and examples.
- A document can have multiple editor tabs and a visible revision history.
- Draft changes are local and fast; publishing creates a named revision that can be shared or scheduled later.
- A command palette supports open, rename, duplicate, restore, move, publish, and compare actions.

The file tree is not decoration. It answers “where did my query go?” and becomes the foundation for reproducible links.

### Editor behavior

- Cmd/Ctrl+Enter runs the selected statement or current statement.
- Shift+Cmd/Ctrl+Enter runs the script.
- Cmd/Ctrl+K opens a command palette.
- Table and column completion is schema-aware.
- Errors underline the relevant token when the server reports a position.
- Long scripts show statement boundaries and per-statement status.
- Code folding collapses CTEs, nested expressions, and long statement blocks without changing SQL.
- Named parameters have a visible editor-side form with type, default, and connection scope.
- Reusable snippets show their source, permissions, and expanded SQL before execution.
- Formatting never changes the query unless the user accepts it.
- The default sample query must run against the local compose database.
- A new user can discover schema, run a safe example, and understand the result without knowing ClickHouse internals first.
- Advanced settings, query IDs, plans, and raw metadata remain one click away.
- A right-side OpenAI proposal or explanation always references the selected document and selection; it never silently replaces editor text.
- A documentation drawer can search server-provided ClickHouse documentation when the connection supports it and falls back to bundled links otherwise.

### Navigation and language intelligence

Make the editor fast even for users who never learn every shortcut:

- `Cmd/Ctrl+P`: fuzzy-open files, tabs, tables, columns, results, and docs.
- `Cmd/Ctrl+Shift+P`: command palette for every action, with searchable keybindings.
- `Cmd/Ctrl+Shift+F`: search across SQL documents, metric contracts, and saved examples.
- `Cmd/Ctrl+Shift+O`: show the current script’s statement and CTE outline.
- `F12` or an equivalent action: go to table, view, dictionary, or column definition.
- `Shift+F12` or an equivalent action: find references in saved SQL and contracts.
- A recent-location stack returns the cursor to the previous query, result, error, or documentation location.
- Multiple cursors and rectangular selection work for repetitive column edits.

ClickHouse SQL intelligence should include completion, hover type/metadata, alias-aware diagnostics, function signatures, formatting, and a statement boundary map. A missing language-server feature must degrade to safe text editing, not disable the editor.

### Editor surfaces

- A breadcrumb shows connection, database, file, statement, and CTE context.
- An outline panel shows statements, CTEs, tables, joins, filters, and aggregations.
- Inline diagnostics link directly to the server error, query plan, or documentation explanation.
- Split panes allow SQL beside results, schema beside SQL, or two revisions side by side.
- Search results can open as an editable multi-buffer of SQL excerpts, with a clear save target for each edit.
- The minimap is optional; the statement map and diagnostic markers are more valuable for SQL.

### Editor model

Use CodeMirror 6 with a small adapter around:

- SQL text and selections.
- Statement boundaries.
- Diagnostics and server error locations.
- Completion sources from `system.columns` and `system.tables`.
- Run and cancel commands.

Keep the editor independent from the execution transport so a future voice or image request can propose an edit without owning the editor state.

### Workspace state

Persist locally:

- Tab order and names.
- SQL text.
- Selected connection and database.
- Panel sizes.
- Theme.
- Result snapshot references.

Keep the state exportable as a small workspace file so a result is not trapped in one browser.

Separate state into three layers:

1. **Draft state:** SQL text, cursor, tabs, panel layout, theme.
2. **Server state:** schema, query history, active runs, result snapshots.
3. **Artifact state:** saved documents, charts, explanations, and lineage.

Draft state can be local-first. Server and artifact state must use the APIs from Stage 2 rather than direct component storage.

### History and task runner

Keep a local recovery timeline independent of Git or server persistence. Checkpoint before an OpenAI patch, formatting operation, publish, import, or destructive-looking edit. Let the user restore a whole document or selected hunks and label important checkpoints.

The command palette exposes a small ClickHouse task runner:

- Run current statement.
- Run selected text.
- Run script.
- Explain query.
- Profile query.
- Preview file import.
- Open the run, result, or trace.

Each task has visible scope, connection, limits, and output destination. Tasks are not a generic shell; they are safe, typed operations on workspace objects.

### Query history

History has two useful scopes:

- **Current file:** every statement, duration, status, query ID, result snapshot, and revision run from this document.
- **All workspace files:** searchable history across the connection, with filters for owner, file, status, time, and query hash.

Selecting a history row restores its SQL selection and result without overwriting the current draft. Running two statements at once is allowed only as two visible runs with separate limits, progress, cancellation, and query IDs.

### Draft, revision, and published state

Use explicit state transitions:

```text
local draft -> saved revision -> published revision -> new draft
```

Published means the SQL, parameters, connection reference, chart configuration, and evidence policy are frozen as a shareable revision. A new edit creates a draft and shows which published revision it diverges from.

### Collaboration state

Use explicit labels instead of one vague “saved” state:

- **Private draft:** only the owner sees edits and no run is shared automatically.
- **Live shared draft:** collaborators can see edits and comments; only permitted editors can modify it.
- **Last executed revision:** the SQL and result currently shown to viewers.
- **Published revision:** an immutable evidence bundle for reuse or sharing.

Running a shared draft creates a new execution record. The UI must not make a collaborator think that editing the text changed the result they are looking at.

### Workspace modes

Make storage and collaboration mode explicit:

- **Private:** local-first drafts and personal history.
- **Shared:** role-scoped files, live comments, and runs using each user’s permissions.
- **Git-synced:** portable SQL files, branches, pull/push, conflict resolution, and reviewable diffs.

Do not imply that local revision history is Git, or that a shared workspace has one universal database identity. Branch changes and unsaved edits need a deliberate conflict decision before switching.

## Acceptance gate

- A user can open three SQL tabs and switch without losing state.
- Schema navigation inserts identifiers into the editor.
- Selected statement execution works.
- Script execution produces separate statement statuses and result sets.
- Theme switching is instant and accessible.
- Empty, loading, error, and stale-result states are explicit.
- A first-time user can reach a successful local query without reading documentation.
- Keyboard navigation and focus visibility work in both themes.
- Click UI remains the source for interactive components and theme behavior.
- A user can organize files, rename and restore a revision, and compare a draft with the last published revision.
- A query-document link reopens the exact tab, selection, connection reference, and revision state.
- The documentation drawer identifies the ClickHouse server version used for its result.
- Quick Open finds a file, table, column, result, contract, or documentation page in one flow.
- Command palette actions work without requiring the user to memorize shortcuts.
- Completion, hover, diagnostics, outline, go-to-definition, and formatting use the selected connection’s capabilities.
- An OpenAI edit, formatter, or import preview can be undone at hunk level through local history.
- Split panes and recent-location navigation preserve focus while moving between SQL, results, and evidence.
- Code folding, statement outline, and selected execution remain correct for multi-statement scripts.
- Query history distinguishes current-file runs from workspace-wide history and never hides the executed SQL.
- Snippet expansion and parameter binding are previewable before the query runs.
- A shared draft clearly distinguishes unsaved text from the last executed revision.
- Read-only collaborators can inspect the draft and history without receiving edit or execution controls.
- Two users editing the same file receive conflict or live-cursor behavior; silent last-write-wins is not acceptable.
- Switching a Git branch or shared workspace explains what happens to unsaved drafts before changing context.
- A shared run uses the executing user’s permission snapshot unless a separately configured service identity is visible.
- A Git-synced file can be pulled, diffed, and exported without losing result lineage.

## Sources

- [Snowflake Workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces)
- [Snowflake notebooks in Workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/notebooks-in-workspaces)
- [Snowflake SQL worksheets](https://docs.snowflake.com/en/user-guide/ui-snowsight-query)
- [Databricks dashboard concepts](https://docs.databricks.com/gcp/en/dashboards/concepts)
- [ClickHouse 26.7 web SQL workspace](https://clickhouse.com/blog/clickhouse-release-26-07)
- [Visual Studio Code basic editing](https://code.visualstudio.com/docs/editing/codebasics)
- [Visual Studio Code code navigation](https://code.visualstudio.com/docs/editing/editingevolved)
- [Zed finding and navigating](https://zed.dev/docs/finding-navigating)
- [Zed multibuffers](https://zed.dev/docs/multibuffers)
- [JetBrains source navigation](https://www.jetbrains.com/help/idea/navigating-through-the-source-code.html)
- [JetBrains local history](https://www.jetbrains.com/help/idea/local-history.html)
- [Databricks new SQL editor](https://docs.databricks.com/gcp/en/sql/user/sql-editor/)
- [Snowflake Workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces)
- [Metabase SQL editor](https://www.metabase.com/docs/latest/questions/native-editor/writing-sql)
- [Metabase SQL snippets](https://www.metabase.com/docs/latest/questions/native-editor/snippets)
- [Snowflake Git workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces-git)
- [Snowflake shared workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces-shared)

## Thread pickup

Build the shell around real execution states. Do not spend the stage on visual polish while tab persistence, selected execution, and script boundaries are uncertain. Use the fake-run adapter from Stage 2 before wiring every screen to a live server.
