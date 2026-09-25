# ClickStudio

A local-first ClickHouse SQL workbench built with React, Click UI, CodeMirror, and a bounded server API. ClickStudio keeps SQL, parameters, execution limits, results, and query evidence tied to each run instead of treating the editor as disposable text.

## Reviewer tour

If you are reviewing this as an interview project, the shortest useful path is:

1. Start the **sample workspace** below and run through the editor, results, charts, and EXPLAIN views.
2. Read [Engineering decisions and tradeoffs](docs/ENGINEERING-NOTES.md) for the reasoning behind the server boundary, result model, ClickHouse permissions, exact numeric handling, fixtures, and persistence choices.
3. Use [Project scope](docs/PROJECT-STATUS.md) to see what is implemented and what is intentionally left out.
4. Use the longer [setup and implementation reference](docs/CLICKSTUDIO.md) only when you want a specific detail.

The project is intentionally broader than a bare text editor, but the core idea is simple: make ClickHouse query execution **inspectable, bounded, and tied to durable evidence** without hiding the underlying SQL or database behavior.

## Quick start

Requires **Node.js 22.12+**, npm, and Docker only for the live ClickHouse path.

### Sample workspace

Use this when you want to explore the interface without starting a database:

```sh
npm run setup
cd clickstudio
DEMO_MODE=true npm run dev
```

Open `http://localhost:5173` and choose **Start exploring**.

Sample mode uses deterministic fixtures. It does not execute or interpret the SQL you type, and it never replaces a failed real database connection with fake data.

### Local ClickHouse

The bundled Docker Compose setup starts the ClickHouse 24.6 compatibility fixture used by this project:

```sh
npm run setup
cd clickstudio
npm run init:env
docker compose up -d --wait clickhouse
npm run db:setup
npm run dev
```

Open `http://localhost:5173`, sign in with `CLICKSTUDIO_TOKEN` from `clickstudio/.env`, choose **Test connection**, then **Trust connection** and enter `local`.

The setup seeds `default.events`. A first live query is:

```sql
SELECT day, events
FROM default.events
ORDER BY day;
```

Use the Run actions beside **Run statement** to inspect **EXPLAIN INDEXES**, **EXPLAIN PLAN**, or **EXPLAIN PIPELINE** for the current statement.

Keep `.env` private. Database credentials and optional model-provider credentials stay on the server.

## Examples

The repository includes copy-pasteable examples that match the bundled local setup:

- [`clickstudio/examples/analysis.sql`](clickstudio/examples/analysis.sql) covers a table-free query, the seeded dataset, exact ClickHouse numeric values, schema inspection, parameters, and plan/pipeline workflows.
- [`clickstudio/examples/import.csv`](clickstudio/examples/import.csv) can be imported into the allowlisted `default.import_events` table.
- [`clickstudio/examples/connections.json`](clickstudio/examples/connections.json) shows the operator-owned multi-connection configuration format.

In the editor, **Ctrl/Cmd+Enter** runs the selection or current statement. **Ctrl/Cmd+Shift+Enter** runs the script. **Ctrl/Cmd+K** or **Ctrl/Cmd+P** opens the command palette.

## What it includes

- Run read-only SQL and inspect typed, paginated results.
- Format and validate ClickHouse SQL in the editor.
- Run scripts and inspect each statement separately.
- Inspect the selected database and ClickHouse system tables, including native system-table documentation from the connected server.
- Import CSV, JSON, or NDJSON through preview, mapping, and explicit row-count confirmation.
- Track execution progress, cancel queries, and reopen retained evidence.
- Save query documents, build charts, and inspect query history.
- Inspect index pruning, logical plans, and execution pipelines with interactive graph views where the connected server supports them.
- Review assistant context and SQL proposals before applying them. The assistant never runs SQL automatically.

Real connections require explicit review and trust before query execution. Sample results are fixtures, not live ClickHouse measurements.

## Validation

For the main local quality gate:

```sh
npm run check
```

That delegates to the ClickStudio review suite, including syntax checks, TypeScript, ESLint, coverage gates, and the production build.

For focused browser coverage:

```sh
cd clickstudio
npm run test:e2e:core
```

For live ClickHouse integration checks, start the bundled database and run:

```sh
cd clickstudio
CLICKHOUSE_INTEGRATION=1 npm run test:integration
npm run eval
```

## Documentation

- [Documentation index](docs/README.md) - reviewer-oriented map of the repository docs.
- [Engineering decisions and tradeoffs](docs/ENGINEERING-NOTES.md) - the recommended technical interview read.
- [Project scope](docs/PROJECT-STATUS.md) - implemented features and deliberate boundaries.
- [Setup and implementation reference](docs/CLICKSTUDIO.md) - detailed reference for setup and behavior.

The project is intentionally local-first and single-owner. A production multi-user deployment would need a different auth and persistence model; those boundaries are discussed in the engineering notes rather than presented as unfinished interview requirements.
