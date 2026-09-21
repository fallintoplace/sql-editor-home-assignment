# Stage 6: OpenAI SQL copilot

## Mission

Give OpenAI a real place in the product: help users write, understand, fix, and improve ClickHouse SQL without hiding the work.

OpenAI is a powerful interaction layer. ClickHouse remains the source of truth for schema, execution, cost, and results.

## Borrow

- Snowflake Copilot: natural-language SQL generation inside the warehouse context.
- Metabase Metabot: generate SQL, edit SQL, explain results, analyze charts, and fix errors while keeping the user in control.
- Mode AI Assist: a side panel grounded in the selected schema and current SQL.
- Snowflake’s right-side flow: follow-up refinement, query explanation, efficiency advice, feedback, and an explicit Run or Add decision.
- Metabase’s semantic layer and usage controls: definitions can ground answers, while groups can be allowed or denied specific actions and given token or message limits.
- Databricks’ assistant pane: generated SQL can be inserted or run from the same editor, while comments and version history keep the work reviewable.
- Metabase snippets and models: reusable SQL and vetted definitions can be inserted into a query with permission-aware references.

## Adapt for ClickHouse

### Four focused actions

1. Generate SQL from a question.
2. Explain or document the selected SQL.
3. Fix a server error or improve the query.
4. Explain a result or suggest a chart.

Add a fifth focused action after a real run:

5. Explain a performance profile and propose a measurable change.

Expose these actions where the cursor is, in the command palette, and in the right drawer. The user should not have to leave the SQL flow and start a separate conversation to explain one clause or repair one error.

### Context package

For the prototype, the user has chosen broad analytical context when they invoke the assistant:

- Full schema objects and types.
- Current SQL, selection, and workspace context.
- ClickHouse server version and dialect notes.
- Error text, query metadata, and query plans.
- Full result data when the user requests result analysis.
- Uploaded files and screenshots for the requested interpretation.

Never send credentials, API keys, cookies, or secret values. Show a context preview before the request and record what was shared in the artifact history. Production deployments add masking, retention, and organization-level policy controls.

### Metric contracts

Add transparent semantic context instead of asking the model to guess business meaning. A metric contract contains:

- Metric name and plain-language definition.
- Grain, dimensions, time zone, and default time window.
- Source tables and columns.
- Filters, exclusions, and null treatment.
- Owner, revision, and review state.

The contract is editable and versioned. Generated SQL must show which contract fields it used, and a user can remove the contract and work directly from schema context. This borrows semantic discipline without hiding ClickHouse SQL.

Support precise context references in the editor, such as selecting or mentioning a database, table, column, metric contract, run, or result snapshot. A broad-context prototype remains available, but the UI should also show the narrower context that produced a proposal. If a provider cannot inspect raw table data, the product must say so and ask the user to share a selected result when result reasoning is required.

### Assistant capabilities

Use typed tool contracts rather than a prompt that can invent database actions:

- `inspect_schema`
- `inspect_query_plan`
- `propose_sql`
- `explain_sql`
- `explain_result`
- `suggest_chart`
- `format_clickhouse_error`

Keep the provider boundary small: OpenAI is the required first provider, while the server adapter leaves room for a later customer-managed provider without changing artifact or review contracts.

The assistant may inspect and propose. The user-run execution path remains a separate explicit action.

### Review-first interaction

- Render proposed SQL as a diff.
- Show assumptions and referenced tables.
- Provide “accept,” “copy,” and “ask for changes.”
- Keep the Run action separate.
- Show a short reason when a query is rejected by safety rules.
- Show the context that was sent, with sensitive fields visibly excluded.
- Keep a stable prompt version and response ID in the artifact metadata.
- Allow the user to regenerate, compare proposals, and restore the previous SQL.
- Support follow-up refinement while retaining the original context package, selected connection, and proposal lineage.
- Show when schema context was narrowed, truncated, or limited, rather than implying the model saw every object.
- Add feedback on the SQL proposal and explanation, linked to the prompt version and artifact.

Context builders need deterministic limits and fallback behavior:

- Search and rank schema objects before sending them, while showing what was selected.
- Keep cross-database or cross-schema requests explicit; do not silently substitute a view or partial schema.
- Detect newly created tables or columns that are not yet indexed in the context cache.
- Keep custom workspace instructions separate from the user’s SQL and label them in the context preview.

For performance advice, send the profile as evidence rather than asking the model to guess from elapsed time. The proposal should identify the operator or ClickHouse behavior it addresses and define the rerun needed to verify the change.

Match the best placement pattern from these products: a persistent side pane for broad help plus inline actions for the selected SQL. The two actions must be visually distinct:

- **Add to draft:** insert the proposal without running it.
- **Run after review:** insert and execute only after the user confirms connection and limits.

### Explicit interaction modes

Borrow the useful permission ladder from terminal-first coding tools, but adapt it to data safety:

1. **Inspect:** read schema, SQL, plans, and selected results; no edits or execution.
2. **Propose:** return a diff, explanation, or chart config; the editor remains unchanged.
3. **Apply to draft:** apply accepted hunks to the current local SQL draft; create a history checkpoint first.
4. **Execute:** always a separate user action with visible connection, limits, and selected statement.

The mode is visible in the drawer and command palette. A mode change is recorded in artifact history. There is no hidden auto-run mode.

### Editor-native assistance

- Inline actions explain a selected expression, qualify a column, extract a CTE, format a statement, or fix a server error.
- A proposal can include edits across several SQL files or metric contracts, shown as an editable multi-file diff.
- Context selection is explicit: current statement, current file, selected files, schema objects, plan, or result snapshot.
- Rejected changes remain available for comparison but never alter the draft.
- A proposal can reference a reusable snippet or metric contract, with its revision and expanded SQL visible.
- A user can target a specific table or column from the schema browser and see that reference in the prompt context.
- A context-cache miss or stale schema refresh is visible and offers a refresh action.
- A performance proposal links to the profile, affected SQL range, expected evidence, and before-and-after run comparison.

Use structured output for typed proposals and function calling for controlled operations such as schema lookup. The server executes database operations; the model never receives direct database credentials.

## Acceptance gate

- Generate a valid ClickHouse query from a schema-grounded request.
- Refuse or ask for clarification when a table or column is unknown.
- Explain a query without changing it.
- Produce a fix as a diff after a real ClickHouse error.
- Never auto-run generated SQL.
- Record prompt, context summary, proposal, and user decision in the artifact history.
- Do not claim semantic certainty when the schema or question is ambiguous.
- Trace model latency and failures in HyperDX without recording secrets.
- Apply per-workspace or per-group limits for model calls, tokens, and expensive full-result analysis.
- Show the metric contract, source columns, and assumptions beside generated SQL.
- Handle unknown objects and incomplete schema context with a useful correction path, not a fabricated identifier.
- Verify that every applied hunk can be undone through local history.
- Ensure a proposal from one connection cannot be applied to a draft attached to another connection without confirmation.

## Sources

- [OpenAI API quickstart](https://developers.openai.com/api/docs/quickstart?site_locale=en)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Metabase Metabot](https://www.metabase.com/docs/latest/ai/metabot?use_case=ea)
- [Metabase AI usage controls](https://www.metabase.com/docs/latest/ai/usage-controls)
- [Snowflake Copilot](https://docs.snowflake.com/en/user-guide/snowflake-copilot)
- [Databricks AI/BI](https://docs.databricks.com/gcp/en/ai-bi)
- [Databricks new SQL editor](https://docs.databricks.com/gcp/en/sql/user/sql-editor/)
- [Mode AI Assist](https://mode.com/help/articles/ai-assist/)
- [Metabase SQL snippets](https://www.metabase.com/docs/latest/questions/native-editor/snippets)
- [Visual Studio Code code navigation](https://code.visualstudio.com/docs/editing/editingevolved)
- [JetBrains local history](https://www.jetbrains.com/help/idea/local-history.html)

## Thread pickup

Start with a server-side adapter and deterministic prompt/context builders. Add UI buttons only after the proposal schema and context preview are explicit. The first visible placement should be inline SQL actions plus a right-side Click UI drawer, not a chat product that hides the editor.
