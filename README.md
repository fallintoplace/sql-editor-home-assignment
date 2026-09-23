# ClickStudio

A local-first ClickHouse SQL editor built with React, Tailwind CSS, and CodeMirror. ClickStudio runs queries through a bounded server API and keeps result evidence tied to each execution.

## Try the sample workspace

Requires **Node.js 22.12+** and npm. The sample mode uses deterministic fixtures; it does not send SQL to ClickHouse or interpret query text.

```sh
npm run setup
cd clickstudio
DEMO_MODE=true npm run dev
```

Open `http://localhost:5173` and choose **Start exploring**.

## Run with local ClickHouse

Docker Compose starts the ClickHouse 24.6 compatibility fixture used by this project.

```sh
npm run setup
cd clickstudio
npm run init:env
docker compose up -d --wait clickhouse
npm run db:setup
npm run dev
```

Open `http://localhost:5173`, sign in with `CLICKSTUDIO_TOKEN` from `clickstudio/.env`, then review and trust the local connection. Keep `.env` private. Database and optional model-provider credentials stay on the server.

## What it includes

- Run SQL and inspect typed, paginated results.
- Format and validate ClickHouse SQL in the editor.
- Run scripts and inspect each statement separately.
- Inspect the selected database and ClickHouse system tables, including native system-table docs from the connected server.
- Import CSV, JSON, or NDJSON through preview, mapping, and explicit row-count confirmation.
- Track execution progress, cancel queries, and reopen retained evidence.
- Save query documents, build charts, and inspect execution plans.
- Review assistant context and SQL proposals before applying them. The assistant never runs SQL automatically.

Sample results are fixtures, not live ClickHouse measurements. Real connections require explicit review and trust before query execution.

## Checks

```sh
cd clickstudio
npm test
npm run typecheck
npm run build
npm run test:e2e:core
```

The focused browser suite uses the fixture driver. For live ClickHouse checks, start the database above, then run:

```sh
CLICKHOUSE_INTEGRATION=1 npm run test:integration
npm run eval
```

See [the ClickStudio guide](docs/CLICKSTUDIO.md) for setup, security boundaries, and API behavior.
