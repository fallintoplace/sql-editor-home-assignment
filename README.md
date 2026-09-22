# Query Studio · ClickHouse SQL Workbench

A single-owner, local-first SQL workspace extending the original home assignment.
The implementation is in `workbench/`. The ten-stage cathedral roadmap is not a claim
of completed multi-tenant, collaborative or production-ready functionality.

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

## Workflows

Run a selected statement or a script, inspect typed results and charts, cancel a
run, and reopen retained execution evidence. Drafts are scoped to their connection;
closing a tab retains it in a bounded ten-tab recovery list and does not delete a
saved revision or cancel a server query. Edited parameters mark old results as stale.

Saved revisions, explicit publication/share consent, bounded CSV/JSON import and
review-first model proposals are described in the [workbench guide](docs/WORKBENCH.md).
Provider-backed features require operator configuration; they never auto-execute a proposal.

## Validation and delivery status

```sh
cd workbench
npm test
npm run build
CLICKHOUSE_INTEGRATION=1 npm run test:integration
npm run eval
npx playwright install --with-deps chromium
npm run test:e2e
```

The integration/evaluation commands require the local database setup above.
Browser tests use the explicit fixture driver, not a substitute for live ClickHouse.
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
