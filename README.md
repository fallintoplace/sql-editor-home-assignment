# SQL / Pro · ClickHouse SQL Workbench

A local-first ClickHouse SQL workspace with a dense, keyboard-friendly interface.
The frontend was rebuilt from scratch with Tailwind CSS utilities and CodeMirror.
The implementation is in `workbench/`.

## Start with a real local ClickHouse database

Requires **Node.js 22.12 or newer**, npm, and Docker Compose. Run these commands from
the repository root; the workbench has its own locked dependency graph and Compose file.

```sh
cd workbench
npm ci
npm run init:env
docker compose up -d --wait clickhouse
npm run db:setup
npm run dev
```

Open `http://localhost:5173`. Sign in with `WORKBENCH_TOKEN` from your local
`workbench/.env`. Select the local profile, test the connection, and explicitly
trust `local` before running SQL. Database and model-provider credentials stay on
the server. Do not commit `.env` or paste database credentials into the browser.

The Compose database is the project's ClickHouse 24.6 compatibility fixture, not
a recommendation for a new production deployment. Fixture/demo mode is separately
labelled and does not evaluate SQL or provide live database evidence.

## Current workspace

- Dark SQL editor with ClickHouse syntax, autocomplete, folding, and keyboard run.
- Connection test and explicit trust flow before a query can execute.
- Schema explorer, query history, cancelable runs, and row/time limits.
- Table and JSON result views with local filtering and CSV export.

The server still retains execution evidence and exposes the broader backend APIs
described in the [workbench guide](docs/WORKBENCH.md). The rebuilt UI intentionally
keeps the first screen focused on query work.

## Validation and delivery status

```sh
cd workbench
npm test
npm run typecheck
npm run build
CLICKHOUSE_INTEGRATION=1 npm run test:integration
npm run eval
npx playwright install --with-deps chromium
npm run test:e2e
```

The typecheck, build, and unit test commands are the fast frontend/backend checks.
The integration/evaluation commands require the local database setup above.
Browser tests use the explicit fixture driver, not a substitute for live ClickHouse.
The GitHub Actions browser step is temporarily paused while the dense workbench
layout selectors are repaired; the backend, build, ClickHouse, and SQL checks remain active.
See the [hardening and verification note](docs/WORKBENCH-HARDENING.md) for the reviewed
base commit, what was actually run, and the checks still required for this patch.
The older implementation status documents describe the initial delivery baseline.

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
