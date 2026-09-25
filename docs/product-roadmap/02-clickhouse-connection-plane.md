# ClickHouse connection experience

## Goal

Make connecting to ClickHouse feel simple while preserving rich execution context.

## Connection profiles

A profile can carry:

- URL;
- database;
- reader identity;
- import writer identity;
- execution limits;
- capability metadata.

The browser selects a profile ID while the server owns credentials and connection details.

## Execution envelope

Every run can carry:

- query ID;
- SQL;
- parameters;
- row and byte limits;
- timeout;
- memory and thread settings;
- connection identity;
- document lineage;
- query tags.

This gives the UI one consistent model for query execution, history, plans, results, and cancellation.

## Capability discovery

A connection can expose its supported features through a manifest covering:

- schema browsing;
- scripts;
- parameters;
- progress;
- cancellation;
- query-log evidence;
- imports;
- EXPLAIN views;
- native documentation.

The UI can then present the richest experience supported by the connected server.

## Product direction

Connection management can grow naturally into:

- saved profiles;
- ClickHouse Cloud presets;
- team-managed profiles;
- secret-manager integration;
- environment labels;
- richer execution-policy controls.

The core abstraction remains the same: a clear server-owned connection profile feeding a consistent execution model.
