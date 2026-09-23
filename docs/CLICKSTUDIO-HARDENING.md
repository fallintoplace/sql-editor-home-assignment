# Workspace durability and evidence checks

This hardening pass extends the existing connection, editor, query, results and
publication workflow. It does not complete every product roadmap chapter or
change the service's single-owner, single-process deployment boundary.

## Local drafts and tab recovery

Autosave coalesces edits over 150 milliseconds. Pending writes flush on keyed
workspace unmount, pagehide, visibility loss and normal unload. Failed writes stay
pending for retry and show an export warning. The writer is tied to one connection
key, so an old workspace cleanup cannot overwrite another connection's drafts.
Browser crashes, process termination and unavailable storage remain durability
limits. Save named server revisions and export important work.

Close tab and Reopen closed tab retain the most recent ten closed local drafts.
SQL, parameters, selection, checkpoints, saved revision identity and run references
are preserved. Closing the last tab creates a usable editor. Closing never deletes
server revisions or cancels a server query. At most thirty local tabs can be open.

Recovery validates nested metadata and repairs duplicate local tab IDs. Valid open
and closed siblings survive malformed entries. Closed history is also retained
when every open tab is damaged or the open-tab list is missing. Dropped entries
produce a recovery warning. Restoration stops once each retained tab cap is met.
Entries outside the documented size and history bounds cannot all be retained.

## Execution evidence and publication

Retained results are marked stale when SQL or exact bound parameter strings change.
Parameter key order does not affect equality. Executed SQL and executed parameters
have separate inspection blocks. Editing a draft never changes a retained run.

Publication has a client-side preflight before opening confirmation or saving a
revision. It checks the selected run, connection, SQL, parameters, query kind,
completion status and retained-result availability. Stale drafts, failed or running
queries, EXPLAIN output and expired results cannot create an extra saved revision
through the publication action. The server still revalidates the revision, evidence,
permissions, expiry and truncation acknowledgement. Client checks are not authority.

Cached terminal runs do not open another EventSource subscription when their tabs
are reopened. A terminal status received through polling also closes an existing
stream. Active runs retain the existing event stream and polling fallback.

## Installation and coverage

`clickstudio/package-lock.json` is committed. Use `npm ci` in `clickstudio/` for a
reproducible install. The package scripts provide core and workspace tests, type
checking, a production build, integration checks, and browser scenarios.

The browser suite uses explicit fixture data, not a SQL emulator. Live ClickHouse
checks remain a separate integration suite. The workflow status for the current
revision is the source of truth for CI results.

Run `npm run test:workspace` for the isolated workspace regressions. Run
`npm run test:e2e:core` for the main browser workflows.
