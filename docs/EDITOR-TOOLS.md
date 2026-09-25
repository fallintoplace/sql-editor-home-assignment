# SQL editing tools

ClickStudio includes focused editing tools that make multi-statement ClickHouse work fast and predictable.

## Query navigation

The numbered query navigator previews each SQL statement.

- **Previous / next** moves between statements.
- **Alt+PageUp / Alt+PageDown** provides keyboard navigation.
- **Select query** selects the current statement for the existing run-selection workflow.

Statement boundaries use the same lexer as execution, including comments, escaped quotes, and heredocs. The outline updates with document edits so navigation stays aligned with the current SQL.

## ClickHouse snippets

Choose a snippet and press **Add query** to append a ready-to-edit ClickHouse pattern.

The included templates cover:

- hourly counts;
- top values;
- P50/P95/P99;
- latest value per key with `argMax`;
- conditional counts;
- `EXPLAIN indexes = 1`.

Placeholder fields support **Tab / Shift+Tab**, repeated placeholders stay linked, and standard editor undo integrates naturally with snippet insertion.

The same templates appear in autocomplete under their `ch_` prefixes.

## Completion

Autocomplete combines:

- SQL keywords;
- ClickHouse functions;
- typed schema hints;
- function descriptions;
- table aliases;
- database-qualified tables.

Typing an alias such as `e.` offers columns from the matching table. Typing `database.` offers tables from that database.

Suggestions respect quoted identifiers, comments, strings, and the current statement.

## Sample and live workflows

The deterministic sample workspace is ideal for exploring the editing experience. A live ClickHouse connection adds real query evaluation with the same editor tools.

## Validation

```sh
cd clickstudio
npm run test:core
npm run typecheck
npm run test:e2e -- tests/e2e/editor-tools.spec.ts
```

Coverage includes statement boundaries, snippet insertion, placeholder navigation, alias extraction, completion offsets, large-schema matching, keyboard navigation, undo, and keyword completion.
