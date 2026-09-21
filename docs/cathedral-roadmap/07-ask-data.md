# Stage 7: Ask Data workspace

## Mission

Let a user ask a business or technical question and receive an answer made of inspectable parts: interpretation, SQL, result, chart, and caveats.

Ask Data is a guided query workflow, not an opaque chatbot. It is built on the copilot, execution envelope, result model, and artifact graph from earlier stages.

## Borrow

- Databricks Genie: natural language to SQL, automatic summaries, visualizations, filters, and feedback.
- Metabase: answers remain linked to the underlying query and permission model.
- Snowflake Copilot: database-native context and role-aware behavior.
- Databricks AI/BI: reusable semantic context, metric views, dashboard parameters, cross-filtering, and drill-through.
- Metabase: a semantic layer and permission-scoped AI actions rather than a generic chat box.
- Databricks SQL editor: generated SQL stays beside the query, results are shared with collaborators, and version history remains in the editing surface.
- Metabase: a saved question combines query, results, and visualization, while visual-builder exploration is more powerful than native SQL drill-through.

## Adapt for ClickHouse

The response is a small, transparent pipeline:

1. Restate the question and identify ambiguity.
2. Show the tables and columns selected.
3. Propose SQL.
4. Let the user inspect or edit it.
5. Run with safe limits.
6. Show the table and recommended chart.
7. Explain the result with freshness, coverage, and caveats.
8. Offer follow-up actions such as changing the time range or grouping.

### Editor handoff

Ask Data must hand off cleanly to the workspace instead of trapping the user in chat:

- “Open SQL” jumps to the exact generated statement and highlights assumptions.
- “Explain this clause” uses the current selection as context.
- “Change filter” creates a draft child query with a visible diff.
- “Compare” opens the original and revised SQL in split panes.
- “Publish” freezes the approved query, metric contract, result state, and evidence.

Every follow-up is a command on a known artifact. The user can use the command palette or keyboard to continue without losing the conversation context.

### Clarification policy

Ask one focused clarification when the request has a material ambiguity:

- Which table or event definition?
- Which time zone or time window?
- Which metric definition?
- Which user or tenant scope?

Do not ask a questionnaire. If the ambiguity is low-risk, state the assumption and let the user change it before execution.

### Metric-first answers

When a question names a business metric, show a metric contract before showing the final answer:

1. Definition and grain.
2. Source tables and columns.
3. Time zone, time window, filters, and exclusions.
4. Proposed SQL and the expected result shape.

The user can accept the contract, edit it, or continue with raw schema context. A contract is a reusable, versioned artifact, not an invisible prompt instruction. If two definitions conflict, show both sources and ask one focused question.

### Answer modes

Offer three clear answer modes:

- **SQL answer:** best for technical users; show the exact statement and execution evidence.
- **Visual answer:** show a chart and table, but keep “Open SQL” one click away.
- **Explore answer:** create a child query or view for filtering and drill-through; never mutate the parent answer.

If the connection or permission model limits exploration, say so. A chart that cannot safely drill through is still useful when the limitation is visible.

### Follow-up semantics

Every follow-up declares what it changes:

- **View filter:** filters the retained result locally and does not claim to reduce database work.
- **Rerun filter:** creates a child SQL query with new parameters and a new query ID.
- **Definition change:** creates a new metric-contract revision and shows affected artifacts.
- **Visualization change:** changes chart configuration without changing SQL.

“Filter this” must never hide whether the database ran again. “Save this” must ask whether to save a draft query, reusable snippet, published question, dataset, or dashboard reference.

### From answer to monitor

Once an answer is trusted, offer a later-stage “Monitor this” action:

- Select a published query revision, not a draft.
- Define a condition such as row count, threshold, freshness, or query failure.
- Choose schedule, timezone, parameters, owner, recipients, and execution identity.
- Preview the next run and show the permission boundary.
- Send a notification that links to the run, result, and source artifact without embedding unauthorized data.

### ClickHouse-specific strengths

The answer should understand and explain:

- `PREWHERE` and filter placement.
- Date/time bucketing.
- `MergeTree` ordering and partitioning.
- Approximate aggregate functions.
- Nullable and array behavior.
- Distributed query cost.
- Rows and bytes read versus rows returned.

### Trust controls

- Read-only by default.
- No DDL or mutation through the natural-language flow initially.
- Query cost preview when available.
- Explicit approval before execution.
- Feedback buttons attached to the SQL and result, not just the prose.
- Never invent a numerical confidence score. Show evidence, assumptions, coverage, and unresolved ambiguity instead.
- A no-result answer explains whether the cause is empty data, a filter, permissions, or a failed query.
- A follow-up question remains linked to the previous artifact and does not silently change connection or permissions.
- A follow-up can change a time range, grouping, filter, or chart through an explicit child query.
- Cross-filtering and drill-through always reveal the child SQL and retain parent lineage.
- Publishing an answer freezes its SQL, metric definition, result snapshot, freshness, and permissions.

## Acceptance gate

- Ask a question in plain language and receive a reviewable SQL proposal.
- See the generated SQL and execute it manually.
- Receive a table, chart, and short result explanation.
- Follow up without losing the original question or artifact lineage.
- Reject or correct a bad interpretation and keep the correction visible.
- Handle ambiguous, empty, permission-denied, and slow-query cases without falling back to unsupported prose.
- A user can take over in the SQL editor at every step.
- A metric definition is visible, editable, and linked to its source columns.
- A follow-up preserves connection, permissions, and the original question while making its changes explicit.
- A published answer can be reopened as a stable snapshot or rerun only with permission.
- “Open SQL,” “Explain,” “Change,” “Compare,” and “Publish” are available as command-palette actions.
- A follow-up creates an inspectable draft diff and can be undone without losing the parent answer.
- SQL, visual, and explore answers share one artifact lineage and clearly expose their different capabilities.
- A shared answer shows result row/byte limits and whether collaborators see a snapshot or can rerun it.
- Follow-ups label local filtering, rerun filtering, definition changes, and visualization-only changes.
- Saving an answer presents explicit artifact choices instead of silently creating a copy or dashboard card.
- A response records whether its data was shared, cached, expired, or freshly rerun.
- A monitor can only target a published revision and records its condition, schedule, identity, and notification policy.
- Monitor failures link back to the same query and result evidence used by the original answer.

## Sources

- [Databricks Genie conversation flow](https://docs.databricks.com/aws/en/genie/talk-to-genie)
- [Databricks Genie setup and examples](https://docs.databricks.com/aws/genie/set-up)
- [Metabase AI overview](https://www.metabase.com/docs/latest/ai/overview)
- [Metabase AI feature principles](https://www.metabase.com/features/metabase-ai)
- [Databricks AI/BI](https://docs.databricks.com/gcp/en/ai-bi)
- [Databricks dashboard concepts](https://docs.databricks.com/gcp/en/dashboards/concepts)
- [Metabase AI usage controls](https://www.metabase.com/docs/latest/ai/usage-controls)
- [Visual Studio Code command palette](https://code.visualstudio.com/docs/editing/getting-started/tips-and-tricks)
- [Zed finding and navigating](https://zed.dev/docs/finding-navigating)
- [Databricks new SQL editor](https://docs.databricks.com/gcp/en/sql/user/sql-editor/)
- [Metabase questions](https://www.metabase.com/docs/latest/questions/introduction)
- [Metabase alerts and notifications](https://www.metabase.com/docs/latest/permissions/notifications)

## Thread pickup

Do not build an opaque chat box. Reuse the copilot proposal, execution envelope, typed result, chart, and artifact model from earlier stages. Start with one connection and explicit schema context; add glossary and metric definitions only after the evidence path works.
