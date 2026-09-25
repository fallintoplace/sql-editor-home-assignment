# Results and visualization direction

## Goal

Turn each query result into an inspectable analysis object.

## Result experience

A result can carry:

- ClickHouse column types;
- exact values;
- row and byte metadata;
- execution identity;
- query ID;
- freshness;
- source SQL;
- parameters;
- retention information.

## Table workflow

The table experience supports:

- pagination;
- filtering;
- sorting where appropriate;
- statistics;
- CSV export;
- JSON inspection;
- column-aware interactions;
- child-query creation.

## Visualization workflow

Charts can build directly from retained result data.

Useful capabilities include:

- automatic chart suggestions;
- line, bar, area, scatter, and other chart types;
- click-to-filter child queries;
- saved chart configuration;
- published snapshots;
- source lineage.

## Performance insight

Result views can connect naturally to:

- query profile information;
- EXPLAIN INDEXES;
- EXPLAIN PLAN;
- EXPLAIN PIPELINE;
- query history comparisons.

This keeps the answer and the execution story together.

## Product direction

A mature result object can become a reusable building block for dashboards, reports, monitors, and collaborative analysis while preserving its source SQL and execution evidence.
