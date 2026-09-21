# Stage 1: Product thesis and scorecard

## The decision

Build a **ClickHouse intelligence workbench**, not another generic SQL editor with a chat panel.

The product promise is:

> From question to trusted ClickHouse insight, every step is fast, explainable, and reproducible.

The moat is not “we have AI.” The moat is that the product understands ClickHouse execution deeply enough to explain what happened, why it cost what it cost, and whether the answer deserves trust.

## Ambition level

The ambition is **maximum**. We should design the cathedral, not artificially limit the product to the take-home checklist.

Delivery still happens through vertical gates so each release works end to end. The assignment is the first usable floor. It is not the ceiling, and no early shortcut should block:

- Multiple ClickHouse connections.
- Rich execution and performance analysis.
- OpenAI SQL, chart, and result assistance.
- Reusable artifacts and collaboration.
- Image and voice input.
- Governance, evaluations, and self-hosted deployment.

The rule is: **maximum product ambition, staged implementation, no throwaway architecture**.

## Editor bar

The workspace should borrow the best habits of mature editors and IDEs:

- A command palette is the universal fallback for every action.
- Quick Open finds SQL files, tabs, tables, columns, saved results, metric contracts, and documentation.
- The editor has language intelligence: completion, hover metadata, diagnostics, outline, go-to-definition, references, formatting, and selection-aware execution.
- Split panes, recent locations, multi-cursor editing, and project-wide search keep experts in flow.
- Every meaningful run, AI proposal, and publish action creates a recoverable history checkpoint.
- Run modes are explicit: inspect, propose, apply to draft, and execute. Nothing silently executes.
- A task runner handles ClickHouse-native work such as run selected SQL, explain, profile, import preview, and open the query trace. A generic terminal is optional later, not a core dependency.

The goal is not to imitate every editor feature. It is to make SQL feel like a first-class programming language while preserving ClickHouse’s data and execution model.

## Hero user

The hero user is a **technical analyst or data engineer** who wants to move quickly between SQL, performance investigation, and explanation.

The product must also be noob-friendly through progressive disclosure:

- Start with a clear connection, schema browser, editor, Run button, and result table.
- Explain ClickHouse concepts when they matter instead of showing every setting immediately.
- Let beginners ask OpenAI for a query, explanation, or chart.
- Let experienced users inspect SQL, plans, settings, query IDs, and raw metadata.
- Never force a beginner through an advanced workflow, and never hide the advanced workflow from an expert.

This is a two-speed product: **simple on entry, deep on demand**.

## OpenAI context decision

For the prototype, OpenAI may receive broad analytical context when the user invokes it:

- Full schema metadata.
- Current SQL and workspace context.
- Query errors, execution metadata, and query plans.
- Full result data when the user asks for result analysis.
- Uploaded files and screenshots when the user asks for interpretation.

The UI must state what context is being shared and show the user which action triggered it. Connection credentials, API keys, cookies, and secret values are never part of the model context.

For a production release, this broad mode becomes a visible workspace setting with audit history, masking controls, and an organization policy. The prototype optimizes for maximum capability; the product still makes the boundary legible.

## Technology constitution

These are deliberate choices, not placeholders:

- **React + TypeScript + Vite:** a fast single-page workspace with no unnecessary server-rendering layer.
- **Tailwind CSS + Click UI:** Click UI is the primary ClickHouse design system. Tailwind handles layout and composition; we do not introduce a second competing button, input, dialog, or theme system.
- **CodeMirror 6:** the embedded SQL editor.
- **Express 5:** retained from the starter because the framework difference is not the product bottleneck. We keep it modular with typed route contracts, validation, request IDs, SSE, and centralized errors.
- **TanStack Query + lightweight client state:** server state and workspace state stay separate.
- **Apache ECharts:** interactive result visualizations with room for larger datasets.
- **`@clickhouse/client`:** the native Node.js connection layer.
- **OpenAI JavaScript SDK + Responses API:** server-side SQL, explanation, chart, image, and result assistance.
- **OpenTelemetry + HyperDX/ClickStack:** observe our own frontend, API, ClickHouse queries, and OpenAI calls. HyperDX is an observability surface, not a replacement for our SQL workspace.
- **Docker Compose:** local ClickHouse and optional observability services.
- **Playwright plus unit tests:** verify the full question-to-result path, not just isolated components.

The assignment remains compatible with Node 20+. For the ambitious product, Node 22.12+ is the preferred development baseline because current Click UI and testing tooling target newer Node versions.

## ClickHouse-native substrate

The product moat is built on ClickHouse internals rather than a generic database abstraction:

- `system.databases`, `system.tables`, and `system.columns` power schema navigation and completion.
- Explicit `query_id` values connect UI actions, progress, logs, traces, and support links.
- `system.processes` powers live progress, rows/bytes read, and cancellation.
- `KILL QUERY` powers the visible Stop action.
- `system.query_log` powers history, performance comparison, errors, and query cost explanations.
- `EXPLAIN`, `EXPLAIN indexes = 1`, and `EXPLAIN PIPELINE` power plan and performance views.
- `system.query_thread_log`, `ProfileEvents`, `system.parts`, and `system.merges` become advanced diagnostics.

The first supported server is the starter’s ClickHouse 24.6. Newer internals are feature-detected. We do not make the product depend on a newer server just to make the demo easier.

## HyperDX boundary

HyperDX/ClickStack is part of the cathedral, but it has a clear job:

1. Observe this product’s browser errors, API requests, SQL executions, OpenAI calls, and user-facing latency.
2. Correlate a failed or slow workspace action with its backend trace and ClickHouse query.
3. Later provide an optional Observability mode for logs, traces, metrics, and sessions.

We do not copy HyperDX’s UI into the SQL workspace. We link to it from evidence panels and keep the query editor, result explorer, and ClickHouse diagnostics in our own Click UI experience.

## The first vertical slice

The take-home assignment remains the first proof, not a detour:

1. Write and run SQL.
2. Show typed tabular results.
3. Turn results into a chart.
4. Run a SQL script and show each result.
5. Optionally insert data from a file.

Everything later must compose on those same primitives. AI, voice, image input, and sharing should produce ordinary SQL, result, chart, and artifact objects rather than parallel special cases.

## What current products prove

### ClickHouse

The official SQL Playground already demonstrates query progress, saved queries, chart configuration, and shareable links. We cannot win by stopping at “run SQL and draw a chart.” We need to add durable workspaces, richer ClickHouse diagnostics, and evidence-backed assistance on top of that foundation.

### Snowflake

Snowflake Workspaces sets a high bar for files, folders, database exploration, side-by-side editors, results, query history, and inline suggestions. Borrow the workspace ergonomics. Beat it for ClickHouse by exposing execution details and performance reasoning as first-class UI, not an afterthought.

### Databricks

Genie shows the expected conversational answer shape: governed context, generated SQL, a result table, a useful visualization, editable examples, and a way to inspect the code. Borrow the response composition. Beat it with a smaller, more transparent system where the SQL, settings, evidence, and ClickHouse cost are always visible.

### Metabase

Metabot has the right interaction discipline: generate or edit SQL, fix errors, analyze charts, accept or reject changes, and do not run generated SQL automatically. Metabase also treats permissions and usage limits as product features. Borrow all of that. Beat it with ClickHouse-aware repair, query-plan explanation, and bytes/rows/read-cost feedback.

### Hex and Mode

Hex makes SQL results reusable downstream as query or dataframe objects and exposes a dependency graph. Mode makes SQL results available to notebooks, reports, and shareable layouts. Borrow the idea that a result is an object, not a dead table at the bottom of the editor. Adapt it to a SQL-first ClickHouse artifact graph before building a full notebook runtime.

### Fresh opponent lessons

The current market raises the bar above a good SQL editor:

- Snowflake now combines files, folders, database exploration, side-by-side work, query history, inline Copilot, governed notebooks, version history, and scheduling. We need the same sense of workspace continuity, but with ClickHouse execution evidence visible in the main flow.
- Databricks AI/BI makes reusable semantic context, metric views, filters, cross-filtering, drill-through, and draft-versus-published dashboards part of the product. We should add a transparent metric contract without hiding SQL behind it.
- Metabase treats semantic context, zero data movement, provider choice, embedded answers, permission-scoped tools, and usage caps as product features. We should borrow the controls and keep OpenAI assistance grounded in the same ClickHouse permission boundary.
- ClickHouse itself is shipping tabs, persistent result snapshots, progressive results, schema diagnostics, and version-matched documentation in its web UI. “SQL editor plus chart” is now table stakes.
- Hex and Mode show that a result should become a reusable variable or dataset with dependencies, refresh behavior, permissions, and provenance. Our result snapshot needs a clear promotion path instead of becoming a dead endpoint.
- ClickStack shows a compelling ClickHouse-native bridge between analytics data and logs, traces, metrics, and sessions. Performance investigation should be a first-class path, not a future integration tile.
- Databricks’ new SQL editor puts the file browser, schema browser, assistant, code folding, command palette, comments, version history, and results in one workbench. The editor should feel like one place, not a stack of routes.
- Snowflake Workspaces makes the file/editor/database/results/history relationship explicit, supports side-by-side views, and can run two queries from one SQL file. Query history must be scoped to the current file and also searchable globally.
- Metabase treats a saved question as query plus result visualization, adds reusable snippets and parameters, and preserves question history. We should make the SQL, result, and view one inspectable object while retaining ClickHouse script support.
- Metabase also exposes an important boundary: native SQL has weaker drill-through than its visual builder. Our SQL-first product should make child queries explicit instead of pretending every chart interaction has the same semantics.
- Databricks turns performance into a shareable query profile with operator graphs, top operators, memory, rows processed, and an approved optimization path. Performance analysis should be an artifact, not a tooltip.
- Snowflake connects workspaces to Git branches and separates private, Git-synced, and role-shared workspaces. We need an explicit storage mode before collaboration becomes confusing.
- Metabase completes the loop with caching, alerts, subscriptions, collection permissions, and dependency warnings. A saved answer should have a clear path to monitoring, with the creator’s data permissions never hidden.
- Databricks attaches query tags to history for team and cost attribution, and its statement API makes row limits, byte limits, truncation, wait timeouts, and cancellation explicit.
- Snowflake surfaces query tags, query insights, cost views, and column-level distribution statistics. “Why is this slow?” should include operational context and data shape, not only elapsed time.
- Metabase has a useful trust signal: verified questions, models, metrics, and dashboards lose verification when their query changes. Dependency checks warn before an upstream change breaks downstream content.
- Metabase also promotes curated questions into models or persisted transforms. We should distinguish a live saved query from a deliberately materialized ClickHouse dataset.

### Editor opponent synthesis

| Borrow | Adapt for ClickHouse | Beat with |
| --- | --- | --- |
| Databricks unified editor and collaboration | File browser, comments, version history, assistant pane, and result tabs | Query IDs, `EXPLAIN`, settings, bytes read, and server truth in the same flow |
| Snowflake Workspaces | Nested SQL files, database explorer, side-by-side editor/results, current-file history | Native ClickHouse scripts, progressive results, cancellation, and performance comparison |
| Metabase questions, snippets, parameters | Query-plus-view artifacts, reusable SQL blocks, typed parameters, collections | Multi-statement scripts, ClickHouse dialect intelligence, and transparent child-query lineage |

The product decision is **one workbench with several inspectable panes**, not three separate products for editor, BI, and AI.

### Coding-workbench lessons

Claude Code and OpenAI's coding workspace expose a second competitive bar: the assistant is not just a chat box. It has durable project context, reusable procedures, review-only passes, recoverable checkpoints, explicit permissions, and background work.

Adapt those ideas without importing a coding product's vocabulary:

- **Context layers:** workspace constitution, connection or schema rules, artifact-specific rules, and on-demand playbooks. The context inspector shows which layer affected a proposal or run.
- **Playbooks:** versioned SQL workflows such as explain-latency, import-file, publish-dashboard, and investigate-error. A playbook declares its inputs, tools, limits, output artifacts, and permission needs.
- **Review lane:** a read-only pass can inspect a draft, result, profile, or published revision and return prioritized findings with evidence. It never edits or executes by itself.
- **Lifecycle guards:** deterministic checks run before execute, publish, refresh, export, and notify. A natural-language instruction can explain a policy, but it cannot replace the policy enforcement point.
- **Checkpoints and rewind:** every AI edit, formatting pass, publish, import, and destructive-looking action creates a named restore point. A failed experiment can be discarded without touching the main draft.
- **Isolated experiments:** alternative SQL proposals and performance trials run as child artifacts with their own query IDs, limits, and lineage, then can be compared or promoted.
- **Durable work:** a monitor or long-running investigation has a definition of done, a saved revision, an execution identity, and a quiet no-change state. It does not depend on a browser tab staying open.

### Deeper product contracts

The opponents also reveal the parts users feel when a workspace becomes real:

- **Draft visibility:** an unsaved draft is private, shared live, or published. The UI must say which one it is.
- **Execution identity:** every run states whether it uses the current user, a connection service identity, or an owner-approved identity.
- **Result lifetime:** cached, replayable, expired, and rerun-required are different states.
- **History retention:** local recovery history, shareable revisions, and server query history have separate retention policies.
- **Copy versus reference:** adding a chart to a report either references the source or creates a labeled copy. It must never silently fork.
- **Partial scripts:** each statement can succeed, fail, or be cancelled independently, with the overall script status explaining the mix.
- **Operational tags:** every run can carry workspace, owner, artifact, environment, and cost-center tags.
- **Trust status:** verified, unverified, stale, broken, and retired are first-class artifact states.
- **Impact analysis:** changing a column, metric contract, snippet, or dataset shows downstream objects before publication.
- **Materialization boundary:** live query, cached snapshot, and persisted table are different products with different freshness and cost.
- **Context provenance:** every proposal and automated run can show the active workspace rules, artifact instructions, playbook version, and schema snapshot that influenced it.
- **Guard decision:** a blocked action records which deterministic rule denied it, what would satisfy the rule, and who can change that policy.
- **Review isolation:** review and analysis may inspect evidence, but only an explicit user action can modify a draft or launch a query.

These contracts are more important than matching any competitor’s button placement. They are where our ClickHouse evidence, permissions, and reproducibility become defensible.

### The complete product loop

The cathedral ends at a monitored, reproducible artifact:

```text
write -> run -> inspect profile -> explain or fix -> publish -> schedule or alert -> review next run
```

Scheduling and alerts are later-stage capabilities, but their ownership, permission, freshness, and failure semantics must exist in the artifact model from the beginning.

### New strategy decisions

1. **Query-first, not chat-first.** The editor, result, and query ID remain the spine. OpenAI accelerates the work around them.
2. **Metric contracts, not a hidden semantic layer.** A definition records metric name, grain, filters, time zone, source columns, and owner. SQL remains visible and authoritative.
3. **Draft and published are different states.** Drafts are flexible and personal; published artifacts freeze the SQL, result freshness, permissions, and version used for sharing.
4. **Every answer is an evidence bundle.** A chart or explanation links to the exact SQL, connection, parameters, query ID, result state, and optional HyperDX trace.
5. **Analytics and operations meet in ClickHouse.** A slow analytical query can link to its request trace, and observability data can be queried with the same workspace primitives.
6. **Two speeds, one model.** Beginners get guided defaults and explanations. Experts get raw SQL, plans, settings, logs, and keyboard control without switching products.

## Our wedge

The winning loop is:

```text
Ask or write
  -> inspect schema and assumptions
  -> propose or edit ClickHouse SQL
  -> inspect limits and plan
  -> run with live progress
  -> understand result and cost
  -> create chart or explanation
  -> save the evidence as a reusable artifact
```

The key word is **evidence**. An answer is incomplete if it hides the SQL, schema context, query ID, freshness, limits, or result snapshot behind a confident paragraph.

## Weighted scorecard

We score ourselves by evidence, not by the number of features. The product is ready for the next stage only when the current stage can pass its gate.

| Dimension | Weight | Target | Proof |
| --- | ---: | ---: | --- |
| ClickHouse execution truth | 23% | 95/100 | Query ID, progress, cancellation, rows/bytes, settings, errors, plans |
| SQL workspace quality | 17% | 90/100 | Files/tabs, schema explorer, completion, history, selected SQL, scripts |
| AI reviewability | 17% | 95/100 | Grounded context, SQL diff, assumptions, accept/reject, no silent run |
| Results and visual analysis | 13% | 90/100 | Typed table, preview/full distinction, chart config, filters, export |
| Reproducibility and sharing | 10% | 90/100 | SQL, settings, prompt, snapshot, freshness, lineage, share link |
| Operational visibility | 10% | 90/100 | OpenTelemetry traces, HyperDX correlation, query IDs, errors, latency |
| Semantic context and metric contracts | 5% | 85/100 | Definitions, source columns, grain, filters, ownership, versioning |
| Multimodal accessibility | 5% | 80/100 | Image and voice use the same reviewed SQL path |
| Generic warehouse breadth | 0% | 0/100 initially | Do not dilute ClickHouse quality for connector count |

The editor bar is a quality gate inside SQL workspace, AI reviewability, and reproducibility. It is not a separate feature bucket that can be traded for superficial breadth.

### North-star measures

- **Time to trusted insight:** from question to a reviewed result with visible SQL and evidence.
- **Evidence coverage:** percentage of results with SQL, schema context, query ID, execution metadata, and freshness.
- **AI acceptance quality:** accepted proposals that run successfully and answer the intended question.
- **ClickHouse performance clarity:** users can explain why a query is slow without opening a separate admin tool.
- **Reproducibility:** another user can rerun or inspect the exact artifact without guessing hidden state.

Avoid vanity metrics such as chat messages, generated SQL count, or chart count. More generated output is not better if users cannot verify it.

## Product laws

1. **ClickHouse first.** A generic abstraction must not erase useful ClickHouse concepts.
2. **Review before execution.** Generated SQL is a proposal until the user runs it.
3. **Evidence over prose.** Every answer links to SQL, result, and execution facts.
4. **Preview is not truth.** Clearly label sampled, cached, partial, and live data.
5. **One object model.** Human SQL, AI SQL, charts, scripts, and voice/image requests produce the same artifact types.
6. **Fast path first.** Keyboard-first users should never need the assistant or chart builder.
7. **Light first, dark complete.** Light mode is the default; dark mode is a complete theme, not a black repaint.
8. **Safe defaults.** Read-only exploration, bounded resources, cancellation, and visible connection identity.
9. **One observability trail.** A user action should be traceable from browser to API to ClickHouse query and back.
10. **Editor flow over feature theater.** Keyboard, navigation, diagnostics, history, and review must stay coherent as features grow.
11. **No framework churn.** We change infrastructure only when a measured product problem requires it.

## Non-goals for the first release

- A general-purpose multi-warehouse BI suite.
- A hidden semantic layer that guesses business meaning without showing its sources.
- A dashboard clone that hides SQL, source freshness, or draft-versus-published state.
- A full notebook/Python runtime.
- A generic local IDE or operating-system terminal in the first release.
- Automatic mutations, DDL, or data movement from a natural-language request.
- Voice as the core interaction model.

## Stage gates

### Gate A: assignment-complete

The app can run SQL, show results, chart results, run scripts, and attempt file import with a clean React + Tailwind + Click UI interface.

### Gate B: differentiated

The app adds ClickHouse-native progress, cancellation, query metadata, explain/diagnostic views, a reviewable OpenAI SQL copilot, and first-party OpenTelemetry/HyperDX instrumentation.

### Gate C: product-shaped

The app adds reusable artifacts, Ask Data, shareable evidence, image input, and optional voice input without creating a second execution path.

### Gate D: defensible

The app has permission-aware context, usage limits, evaluations, version compatibility, performance explanations, and reliable self-hosted plus ClickHouse Cloud connections.

## Thread pickup

Treat this file as the product constitution. Before implementing any later stage, answer three questions:

1. Which ClickHouse-specific user pain does this solve?
2. What evidence will the user see and be able to inspect?
3. Which earlier artifact or execution primitive does it reuse?

If the answer is only “it looks cool,” park it. The cathedral needs a foundation before a spire.

## Sources

- [ClickHouse SQL Playground](https://clickhouse.com/blog/announcing-the-new-sql-playground)
- [ClickHouse demo applications and Playground](https://clickhouse.com/demos)
- [Snowflake Workspaces](https://docs.snowflake.com/en/en/user-guide/ui-snowsight/workspaces)
- [Snowflake notebooks in Workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/notebooks-in-workspaces)
- [Snowflake Copilot](https://docs.snowflake.com/en/user-guide/snowflake-copilot)
- [Databricks AI/BI](https://docs.databricks.com/gcp/en/ai-bi)
- [Databricks new SQL editor](https://docs.databricks.com/gcp/en/sql/user/sql-editor/)
- [Databricks run and share queries](https://docs.databricks.com/gcp/en/sql/user/sql-editor/run-queries)
- [Databricks query results](https://docs.databricks.com/gcp/en/sql/user/sql-editor/results)
- [Databricks query profile](https://docs.databricks.com/gcp/en/sql/user/queries/query-profile)
- [Databricks query history](https://docs.databricks.com/gcp/en/sql/user/queries/query-history)
- [Databricks statement execution limits and tags](https://docs.databricks.com/aws/en/dev-tools/sql-execution-tutorial)
- [Databricks dashboard concepts](https://docs.databricks.com/gcp/en/dashboards/concepts)
- [Databricks Genie setup and review flow](https://docs.databricks.com/aws/genie/set-up)
- [Metabase Metabot](https://www.metabase.com/docs/latest/ai/metabot)
- [Metabase AI usage controls](https://www.metabase.com/docs/latest/ai/usage-controls)
- [ClickHouse 26.7 web workspace](https://clickhouse.com/blog/clickhouse-release-26-07)
- [Visual Studio Code editor overview](https://code.visualstudio.com/docs/editing/getting-started/overview)
- [Visual Studio Code command palette and editing](https://code.visualstudio.com/docs/editing/getting-started/tips-and-tricks)
- [Zed navigation and command palette](https://zed.dev/docs/finding-navigating)
- [Zed multibuffers](https://zed.dev/docs/multibuffers)
- [JetBrains source navigation](https://www.jetbrains.com/help/idea/navigating-through-the-source-code.html)
- [JetBrains local history](https://www.jetbrains.com/help/idea/local-history.html)
- [Sublime Text quick panel](https://www.sublimetext.com/docs/themes.html)
- [OpenAI terminal approvals and patch review](https://help.openai.com/en/articles/11096431)
- [Terminal planning and permission modes](https://support.claude.com/en/articles/14553413-claude-code-cheatsheet)
- [Hex SQL cells and dependency graph](https://learn.hex.tech/docs/explore-data/cells/sql-cells/sql-cells-introduction)
- [Mode reusable datasets](https://mode.com/help/articles/datasets/)
- [Mode notebook and reusable query outputs](https://mode.com/help/articles/notebook/)
- [Metabase SQL editor](https://www.metabase.com/docs/latest/questions/native-editor/writing-sql)
- [Metabase SQL snippets](https://www.metabase.com/docs/latest/questions/native-editor/snippets)
- [Metabase dashboards and copies](https://www.metabase.com/docs/latest/dashboards/introduction)
- [Metabase permissions](https://www.metabase.com/docs/latest/permissions/introduction)
- [Metabase questions, caching, and alerts](https://www.metabase.com/docs/latest/questions/introduction)
- [Metabase content verification](https://www.metabase.com/docs/latest/exploration-and-organization/content-verification)
- [Metabase models and persistence](https://www.metabase.com/docs/latest/data-modeling/models)
- [Snowflake Git workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces-git)
- [Snowflake shared workspaces](https://docs.snowflake.com/en/user-guide/ui-snowsight/workspaces-shared)
- [Snowflake query insights](https://docs.snowflake.com/en/user-guide/query-insights)
- [Snowflake query history and tags](https://docs.snowflake.com/en/user-guide/ui-snowsight-activity)
- [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [OpenAI developer quickstart](https://developers.openai.com/api/docs/quickstart?site_locale=en)
- [Claude Code steering: rules, skills, hooks, and subagents](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)
- [Claude Code user FAQ](https://support.claude.com/en/articles/14554922-claude-code-user-faq)
- [OpenAI project workspaces](https://learn.chatgpt.com/docs/projects)
- [OpenAI scheduled tasks](https://learn.chatgpt.com/docs/automations)
- [OpenAI long-running work](https://learn.chatgpt.com/docs/long-running-work)
- [OpenAI code review workflow](https://learn.chatgpt.com/docs/code-review)
- [OpenAI build skills](https://learn.chatgpt.com/docs/build-skills)
- [OpenAI hooks](https://learn.chatgpt.com/docs/hooks)
- [OpenAI MCP](https://learn.chatgpt.com/docs/extend/mcp)
- [ClickHouse Click UI](https://github.com/ClickHouse/click-ui)
- [HyperDX and ClickStack](https://github.com/hyperdxio/hyperdx)
- [ClickStack](https://clickhouse.com/clickstack)
- [ClickHouse query optimization and query logs](https://clickhouse.com/resources/engineering/clickhouse-query-optimisation-definitive-guide)
- [Express middleware model](https://expressjs.com/en/guide/using-middleware/)
