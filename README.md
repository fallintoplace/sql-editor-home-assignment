# ClickStudio

A local-first ClickHouse SQL workbench built for the frontend assignment. The UI uses
React, Tailwind CSS, and CodeMirror; the server owns connections, execution limits,
retained results, and query evidence.

## Try the demo

Requires **Node.js 22.12+** and npm. The demo is deterministic and does not send SQL
to ClickHouse or evaluate the SQL text.

```sh
cd workbench
npm ci
DEMO_MODE=true npm run dev
```

Open `http://localhost:5173` and choose **Start exploring** for the sample connection.

## Run against local ClickHouse

Docker Compose starts the ClickHouse 24.6 compatibility fixture used by this repo.

```sh
cd workbench
npm ci
npm run init:env
docker compose up -d --wait clickhouse
npm run db:setup
npm run dev
```

Open `http://localhost:5173`, sign in with `WORKBENCH_TOKEN` from `workbench/.env`,
then test and explicitly trust the local connection. Keep `.env` private; database
and optional model-provider credentials stay on the server.

## What works

- Run a SQL statement and inspect typed, paginated retained results.
- Chart retained data, including nullable and negative numeric values.
- Run SQL scripts and inspect each statement's status and result independently.
- Track execution progress, cancel work, and reopen prior query evidence.
- See when an edited query no longer matches the displayed result.
- Explore schema, save local drafts, and review execution details.
- Preview AI context and review a SQL proposal before applying it. AI never runs SQL automatically.

Demo results are fixtures, not live ClickHouse measurements. Real connections require
explicit review and read-only trust before query execution.

## Checks

```sh
cd workbench
npm test
npm run typecheck
npm run build
npm run test:e2e:critical
```

The focused Playwright suite uses the fixture driver and runs in GitHub Actions.
For live ClickHouse integration checks, start the local database above, then run:

```sh
CLICKHOUSE_INTEGRATION=1 npm run test:integration
npm run eval
```

## Assignment

The original task asks for a React SQL editor with query results, charts, SQL script
execution, and an optional file import. The current UI focuses on the first three.
The server APIs and architecture notes are documented in [the workbench guide](workbench/docs/WORKBENCH.md).

## Original assignment

Given the current project, lets elaborate a mini sql web editor in React. When opening the `/` the react application
should render and display a sql editor where we can write our queries.

Implement the following features

- Run a query and display the query results in the UI
- Run a query and display a chart with the results of that query
- Support sql script running and display results

Bonus:

- Insert data from a file

We have our [UI component library](https://click-ui.vercel.app) if you want some help with the components design that can give you some leverage and accelerate speed of development, but you are free to use whatever you would prefer.
