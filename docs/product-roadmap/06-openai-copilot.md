# OpenAI copilot direction

## Goal

Add reviewable AI assistance directly to the SQL workflow.

## Core actions

The assistant can help with:

- generating SQL;
- explaining SQL;
- repairing SQL;
- reviewing a draft;
- analyzing a result;
- suggesting performance improvements;
- proposing chart ideas.

## Context

Useful context can include:

- current SQL;
- selected schema objects;
- ClickHouse metadata;
- retained results;
- execution evidence;
- query plans;
- user-selected screenshots.

The UI can show the prepared context so the user sees what shaped the response.

## Proposal workflow

A strong interaction model is:

**inspect context → generate proposal → review → apply → run**

This keeps the assistant connected to the editor and preserves user control over the final SQL.

## Quality signals

Proposal quality can use:

- schema grounding;
- read-only SQL checks;
- playbook contracts;
- semantic heuristics;
- deterministic evaluation cases;
- retained decision history.

## Product direction

The same architecture can support richer playbooks for query optimization, import guidance, result explanation, documentation lookup, and investigation workflows.
