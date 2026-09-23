# SQL editing tools

The editor has a compact query navigator and a ClickHouse snippet picker. Both are
local editing actions: they use the existing editor state, draft persistence, and
undo history. Neither sends a query to the server.

## Query navigation

The numbered picker previews each SQL statement. Previous/next buttons and
**Alt+PageUp / Alt+PageDown** move the cursor between statements. **Select query**
selects the current statement for the existing run-selection workflow.

Boundaries use the same lexer as execution, including comments, escaped quotes,
and heredocs. An unfinished quote or block comment temporarily disables navigation
and snippet insertion; typing stays available. This is boundary detection, not SQL
validation. The outline is recomputed on document edits, not cursor movement.

## ClickHouse snippets

Choose a snippet and press **Add query** to append it without replacing existing
SQL or the selection. A missing statement delimiter and trailing line comments
are handled explicitly. Edit placeholder fields with **Tab / Shift+Tab**; repeated
fields are linked. Use normal undo to remove the insertion.

The six templates cover hourly counts, top values, P50/P95/P99, latest value per
key with `argMax`, conditional counts, and `EXPLAIN indexes = 1`. Table and column
names are examples and must be reviewed for the connected schema. Templates also
appear in autocomplete under their `ch_` prefixes. Autocomplete inserts at the
cursor, while **Add query** appends a separate statement.

The fixture demo does not evaluate arbitrary SQL. Use a real ClickHouse connection
to evaluate an edited template; adding or navigating a query never runs it.

## Completion

SQL keywords are available alongside typed schema hints and function descriptions.
Typing `e.` after declaring a table alias offers that table's columns; `database.`
offers tables. Aliases are scoped to the current statement. Suggestions quote
inserted identifiers, ignore strings/comments, and filter before the 300-item
schema cap. Alias hints are best-effort, not a full SQL name resolver.

## Checks

```sh
cd workbench
npm run test:core
npm run typecheck
npm run test:e2e -- tests/e2e/editor-tools.spec.ts
```

The regression tests cover statement boundaries, incomplete editing, snippet
separators, alias extraction, completion offsets, and large-schema matching.
The focused browser tests cover navigation, snippet fields/undo, incomplete input,
and keyword completion. These commands describe how to validate the feature, not
a claim that a particular environment has run every suite.
