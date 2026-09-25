# ClickStudio: setup and implementation reference

This is the detailed reference for the interview project. Reviewers do **not** need to read it front to back. Start with the [README](../README.md) and [Engineering decisions and tradeoffs](ENGINEERING-NOTES.md), then use this document for setup or implementation details.

## Project boundary

ClickStudio is a **local-first, single-owner ClickHouse SQL editor**. It includes a real ClickHouse/Express connection and a separately labeled fixture driver for the sample workspace.

The application lives in `clickstudio/`; root npm scripts delegate there. SQL execution uses the bounded server API. The single-owner and single-process choices are deliberate scope decisions for this project, not a proposed production architecture.

## First run with a local ClickHouse server

Use Node 22.12 or newer. From the existing repository checkout:

```sh
npm run setup
cd clickstudio
npm run init:env
# Read CLICKSTUDIO_TOKEN in the private .env file for the sign-in screen.
docker compose up -d --wait clickhouse
npm run db:setup
npm run dev
```

Open `http://localhost:5173` (not another hostname unless APP_ORIGIN is updated). Sign in, choose **Test connection**, then **Trust connection** and type its ID (`local`). Run the starter query. Its `numbers(7)` input does not depend on the seeded table.

`init:env` generates random local passwords and an owner token; it refuses to overwrite an existing `.env`. Do not commit that file or paste its values into SQL, screenshots, issue comments, or AI prompts. Reader, writer, and administrator credentials are different. The administrator is used only by the explicit setup command, not by the API.

The bundled setup creates `default.events` with a small deterministic dataset and an empty `default.import_events`. It creates a read-only `clickstudio_reader` and an INSERT-only `clickstudio_writer` for the allowlisted import table. It does not remove or truncate existing tables. The setup command updates those two users' passwords to the configured local values; do not run it against an unrelated production server.

The SQL reader profile is mounted from `docker/clickstudio-reader.xml`. It keeps `readonly=1` and allows only the bounded operational settings required by the application to change in read-only mode. A separately managed ClickHouse server needs equivalent operator configuration. A read-only identity that cannot change these settings will return a capability/permission error; the application does not silently weaken it to a write identity.

The compose file uses ClickHouse 24.6 as the project's compatibility fixture. A real deployment should choose its supported server version independently of this test fixture.

### Containerized application

After dependency resolution has succeeded and the lockfile is committed:

```sh
cd clickstudio
docker compose --profile app up --build
```

Open `http://localhost:8080`. The one-shot setup container waits for ClickHouse; the application waits for setup. Only loopback ports are published. The application container receives the reader, restricted writer, optional OpenAI credentials, and owner token, **not the database administrator password**. The setup service is local infrastructure bootstrapping, not a model tool.

For a local production build without an app container:

```sh
cd clickstudio
npm run build
# Change APP_ORIGIN to http://localhost:8080 in .env before serving the built app.
NODE_ENV=production npm run start:production
```

Do not run development and production servers against the same data directory simultaneously. The file store is single-process; it is not a shared filesystem database.

### UI fixture mode

```sh
cd clickstudio
DEMO_MODE=true npm run dev
```

The two demo profiles exercise switching, progress, errors, cancellation and result rendering. The fixture driver **does not execute or interpret SQL** and cannot import. `SELECT fixture_error` deliberately fails; `SELECT fixture_slow` runs slowly enough to test cancellation. The banner and results are labeled as fixtures. The application never falls back to demo data after a real database failure.

## Ordinary analysis workflow

The editor uses Click UI controls, CodeMirror 6, TanStack Query and ECharts. It has connection-scoped drafts/tabs, a schema explorer, a statement outline, a command palette, selected/current-statement execution, script results, named parameters, query history, result evidence and a right-side assistant/inspection panel. Ctrl/Cmd+Enter runs a selection or statement; adding Shift runs the script. Ctrl/Cmd+K or P opens the command palette. Scripts stop on error in the UI; the API also accepts `stopOnError: false` for an explicit continue policy.

The schema explorer includes the selected database and ClickHouse system tables. Expand a system table and choose **Read ClickHouse documentation** to fetch its documentation from the connected server. The response shows the server version; fixture mode does not simulate native documentation.


### Example workflows

The repository keeps runnable examples in [`clickstudio/examples/analysis.sql`](../clickstudio/examples/analysis.sql). They are intentionally small enough to paste into a fresh tab and inspect statement by statement.

**Table-free smoke test**

```sql
SELECT
    toDate('2026-01-01') + toUInt32(number) AS day,
    toUInt64((number + 1) * 10) AS events
FROM numbers(7)
ORDER BY day;
```

This works against a fresh ClickHouse server and is a good first check for result typing, charts, export, and retained evidence.

**Seeded local data**

After `npm run db:setup`, the bundled fixture has seven rows in `default.events`:

```sql
SELECT
    day,
    events,
    sum(events) OVER (ORDER BY day) AS running_events
FROM default.events
ORDER BY day;
```

This gives the table and chart views multiple numeric series without requiring any writes from the editor.

**Named parameters**

ClickHouse parameter syntax is preserved and values are bound by the server:

```sql
SELECT day, events
FROM default.events
WHERE events >= {minimum:UInt64}
ORDER BY day;
```

Provide `minimum=30` in the editor's parameter control before running it. A missing parameter is rejected explicitly instead of being interpolated into SQL.

**Scripts**

Put multiple read-only statements in one tab and choose **Run script**, or use **Ctrl/Cmd+Shift+Enter**:

```sql
SELECT count() AS days FROM default.events;

SELECT sum(events) AS total_events FROM default.events;
```

Each statement keeps its own result. The UI stops the script on the first error.

**Index, plan, and pipeline inspection**

Keep the current statement as normal `SELECT` SQL and use the Run actions beside **Run statement**:

- **EXPLAIN INDEXES** shows ClickHouse-reported index checks and pruning counts such as parts and granules.
- **EXPLAIN PLAN** shows the logical query plan and supports graph and tree inspection.
- **EXPLAIN PIPELINE** shows the planned processor topology and parallel lanes.

These views describe ClickHouse plan output. They are not measured per-node runtime timings. Retained run metrics remain separate.

**Import fixture**

[`clickstudio/examples/import.csv`](../clickstudio/examples/import.csv) matches the bundled `default.import_events(day Date, events UInt64)` table. Choose **Import**, review the parsed rows and mapping, then confirm the exact `INSERT N ROWS` phrase. Previewing the file does not write to ClickHouse.

For additional connections, [`clickstudio/examples/connections.json`](../clickstudio/examples/connections.json) shows the supported operator-owned profile shape and environment-secret references.

A run always gets a server-generated query ID. Its SQL, parameters, execution identity, limits, timestamps and result state remain available independently of the editor. An edit does not update the old result. Opening historical SQL creates a child draft rather than replacing the current draft. An AI apply, publication, or experiment uses the same document and checkpoint model.

Results preserve column names and ClickHouse type metadata separately from row arrays, including duplicate column names. UInt64 and Decimal output is requested as strings to avoid JavaScript integer precision loss. Table filtering and statistics describe retained rows only. Tables render 200 rows per page; this is bounded pagination, **not a claim of full row virtualization**. Chart coordinates are JavaScript numbers and unsafe integer coordinates are omitted. The table/JSON remains authoritative for exact values.

A chart click or cell double-click creates a child SQL draft using a bound filter parameter; it does not execute. Null filtering uses `isNull`, not the printable word `NULL`. Child filters can still be inappropriate for complex expressions or duplicate result-column names; inspect the generated SQL before executing.

Saving creates a server revision with optimistic concurrency protection. Publishing requires a completed result matching the saved SQL and parameters. Publication freezes the chart and a bounded result. Sharing is a **separate explicit consent** step: anyone with the random bearer URL can read the frozen SQL and snapshot until it expires or is revoked. A share URL is not an account or database credential and offers no execution endpoint.

## Connection and permission configuration

The server accepts profile IDs, never arbitrary database URLs from the browser. For multiple profiles set `CONNECTIONS_FILE` to an operator-owned JSON file; `examples/connections.json` shows the shape. Passwords are environment references. Configure another profile for another database; metadata browsing is scoped to each profile's database.

All signed-in users of this deployment are the **same owner**. The token is a shared single-owner access mechanism, not SSO, tenant isolation, or independently permissioned collaboration. A non-loopback server bind requires a token of at least 32 characters and rejects the ClickHouse `default` identity. Keep this prototype local until the full authorization, deployment and integration review is complete. A reverse proxy must preserve the configured Host and Origin; arbitrary forwarded headers are not trusted.

The native ClickHouse grants remain the real database authorization boundary. SQL classification provides early explanatory denials, not a complete SQL sandbox. Use SELECT-only identities, restricted network egress and server-side settings constraints. Do not assume a SELECT is inexpensive or that a textual denylist replaces database permission enforcement.

The bundled reader is not granted global `system.query_log` access because it can disclose other users' SQL. The query-log evidence panel is capability-gated. Operators may enable it deliberately with an appropriate monitoring identity and permission review. `EXPLAIN`, progress and cancellation also report unavailable capabilities instead of faking success.

## Imports

Choose Import, upload CSV, JSON or NDJSON, inspect the preview, select the explicit allowlisted destination, and review column mapping. No table creation or write occurs during preview. CSV fields remain strings; JSON values are not silently model-coerced. The final confirmation is `INSERT N ROWS` for the exact mapped count.

Imports use the separate writer. Mapping checks the destination schema again immediately before insertion. The mapping ID reserves one import operation; duplicate submissions do not insert twice. A transport failure may leave an **unknown** outcome and a partially completed insert. Inspect the table before taking further action; the application does not automatically replay the write. `examples/import.csv` is suitable for `default.import_events`.

## OpenAI assistant and image input

Set `OPENAI_API_KEY` and `OPENAI_MODEL` only on the server. Choose a model that your account supports for Responses API structured output; image tasks also require image input support. No model name is guessed or silently substituted. Missing configuration disables model actions. No paid model calls were made during this delivery.

The assistant has generate, explain, repair, result, performance and review actions, with versioned instruction/playbook metadata. It prepares and displays the actual context before the provider request. This includes the question, current SQL, schema selection and optional retained result/evidence. Context has a byte budget and visibly reports narrowing. A result is never included just because it exists in the workspace; the user must choose that context. PNG/JPEG/WebP images are private prepared inputs with an explicit send step.

**Inspect/propose → accept into the draft → execute** are separate transitions. A provider response does not receive a query execution tool. Accepting checks the original SQL and connection before recording the decision. The frontend makes a local checkpoint, applies the accepted SQL, and still requires Run. Review/explain actions cannot become unapproved SQL changes.

Every new proposal receives a quality record with four checks: playbook contract, read-only SQL safety, schema grounding, and a static semantic proxy. Unsafe SQL is rejected again at acceptance, so the quality result is not only decoration. Accepted and rejected decisions are retained as bounded proposal metadata and exposed through the Assistant quality panel. The local `eval:assistant` command runs five deterministic benchmark cases covering table grounding, bounded repair, inspect-only responses, review findings, and clarification instead of guessing. These checks do not claim that a query is semantically correct: execution against a known ClickHouse fixture and inspection of retained results remain the semantic gate.

The provider request uses the OpenAI SDK, Responses API, structured output validation, `store: false`, an output cap, a deadline and no automatic retries. `store: false` is not a claim that provider-side retention obligations disappear; review your provider agreement and data policy. Prepared image/raw context expires after five minutes or is removed after use. Proposal metadata is retained until deletion or the bounded proposal cap. Configured credential values are excluded/redacted; configured sensitive columns are omitted from result context. This is **not a general DLP engine**: users must still inspect SQL literals, free text, column names and images for sensitive content.

Voice/WebRTC, full multi-file/hunk editing, autonomous investigations and production organization-level AI budgets are not implemented. Their absence is not hidden behind a fake success UI.

## Monitors and observability

Monitors pin a published revision, identity, parameters and limits. The single server checks fixed UTC intervals (minimum 60 seconds); it does not replay missed intervals. Runs go through the ordinary bounded execution service. First results establish a quiet baseline for change monitors; unchanged results stay quiet. Notifications are owner-only in-app run links. There is no email, webhook, external recipient delivery, distributed scheduler or exactly-once claim.

Optional `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` enables metadata-only API spans. `TRACE_URL_TEMPLATE` can link a recorded trace ID to an existing observability deployment. OpenTelemetry export and trace navigation require verification with your collector. Frontend RUM/session replay, automatic OpenAI span instrumentation, a bundled ClickStack service and operator-level execution profiles are **not** implemented. Query-log rows and EXPLAIN output must not be labeled as measured operator timings.

## Persistence, limits and recovery

Server data is atomic JSON-file storage under `DATA_DIR`, with owner-only directory/file modes on POSIX. It is deliberately single-process, not SQLite/Drizzle, and multi-file operations are not crash-atomic transactions. Workspace imports are validated completely before saving, but a filesystem failure during the subsequent writes can still require operator recovery. Back up this directory while the app is stopped. Browser local drafts are separate from named server revisions.

Run defaults: 5,000 rows, 2 MB, 30 seconds, 512 MiB and four threads. Hard application maxima: 20,000 rows, 5 MB, 120 seconds, 1 GiB and eight threads. Stream parsing checks bounds before loading a giant result cell; cap-limited output is explicitly truncated. Server-side scan/resource ceilings provide another boundary. Cancellation requests a transport abort **and** a server KILL; an unconfirmed server cancellation is a warning, not a false guarantee.

Retained run results expire after 24 hours or earlier under the 50 MB snapshot budget. Published snapshots retain at most 1,000 rows/1 MB for seven days. Import previews expire after one hour. Histories, documents, uploads, proposals, queues, sessions and audit entries have finite capacity limits; some long-lived metadata capacities require operator maintenance. A monitor stops being usable when its source publication expires; publication is not an immortal query lease.

A restart marks active runs/scripts interrupted and imports unknown. No mutation or query is silently retried. The server attempts to cancel previously active query IDs. Receipt tombstones prevent replaying a deleted run with an old request ID. Malformed durable JSON is surfaced, not replaced with an empty database. Avoid editing storage files manually or reusing a live directory across processes.

## Verification commands

```sh
cd clickstudio
npm test
npm run typecheck
npm run build
npm run test:integration
npm run test:e2e:core
```

The browser suite uses the fixture driver. To run integration checks against the local ClickHouse container, set `CLICKHOUSE_INTEGRATION=1` after starting the database. GitHub Actions runs the project checks on pushes and pull requests.
