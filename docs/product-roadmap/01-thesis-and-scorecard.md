# Product thesis

## Vision

Build a **ClickHouse-aware SQL workspace** where query execution, results, performance insight, and assistance stay connected.

The product promise is:

> From question to ClickHouse insight, every step is fast, explainable, and reproducible.

## Product character

ClickStudio combines:

- a fast SQL editor;
- ClickHouse-native execution insight;
- reusable result artifacts;
- clear query history;
- interactive plans and profiles;
- reviewable AI assistance;
- strong keyboard-driven workflows.

The experience starts simply and reveals more depth as the user needs it.

## Hero user

The primary user is a technical analyst or data engineer moving between:

1. writing SQL;
2. running it;
3. inspecting results;
4. understanding execution;
5. improving the query;
6. saving or sharing the analysis.

## Technology direction

The current stack supports that workflow directly:

- React + TypeScript + Vite;
- Click UI + Tailwind CSS;
- CodeMirror 6;
- Express 5;
- TanStack Query;
- ECharts;
- `@clickhouse/client`;
- OpenAI SDK;
- OpenTelemetry;
- Docker Compose;
- Playwright and unit tests.

## ClickHouse-native advantage

ClickStudio can build directly on ClickHouse capabilities such as:

- `system.databases`, `system.tables`, and `system.columns`;
- explicit query IDs;
- live progress;
- cancellation;
- query history;
- `EXPLAIN INDEXES`;
- `EXPLAIN PLAN`;
- `EXPLAIN PIPELINE`;
- server documentation and metadata.

This keeps the product deeply connected to ClickHouse rather than treating it as a generic SQL endpoint.

## Success signals

A strong ClickStudio experience makes these moments feel effortless:

- opening a workspace and reaching useful SQL quickly;
- understanding the result shape immediately;
- moving from result to chart or follow-up query;
- understanding why ClickHouse chose a plan;
- comparing execution evidence across runs;
- reviewing an assistant proposal with full context;
- reopening an analysis with its SQL and evidence intact.
