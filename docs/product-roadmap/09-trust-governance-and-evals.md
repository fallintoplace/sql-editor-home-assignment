# Trust, governance, and evaluation direction

## Goal

Make execution, assistance, and sharing easy to inspect and govern.

## Execution trust

Useful signals include:

- explicit query IDs;
- connection identity;
- server-side limits;
- SQL and parameters;
- result freshness;
- revision lineage;
- query tags.

## Assistant governance

Assistant workflows can expose:

- prepared context;
- model action;
- proposal metadata;
- evaluation results;
- apply decisions;
- playbook version.

Sensitive-column configuration and server-owned credentials keep data handling easy to reason about.

## Evaluation

A repeatable evaluation suite can cover:

- schema grounding;
- SQL generation;
- repair;
- result explanation;
- performance guidance;
- assistant review behavior;
- ClickHouse-version compatibility;
- browser workflows.

## Product direction

These signals can grow into organization policies, audit views, approval workflows, richer observability, and team-level quality dashboards.

The core principle is simple: important actions carry enough context to explain what happened and reproduce it.
