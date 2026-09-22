# Workspace durability and evidence checks

This hardening pass extends the existing connection, editor, query, results and
publication workflow. It does not complete every cathedral roadmap chapter or
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

## Reproducible installation and coverage

The dependency lock is the exact artifact from baseline commit
`12c669b8e3eb5fb6ecd465a76c15e2b270873cab`, Actions run `35675233489`, artifact
`10672218713`. Its Git blob SHA is `a676b40a2edaeb86d0d42c312b3e32c47a66d52d`.
The recovery checked this SHA and the manifest's name, version, dependencies,
devDependencies and engines. No dependency versions were upgraded in this pass.
The one-use recovery workflow removed itself after committing the lock.

CI uses `npm ci` with a lockfile-keyed npm cache. The captured installation reported
23 audit findings, including 3 high-severity findings. Locking that graph does not
resolve those findings; dependency security remediation is a separate task.

The workspace regression suite has 60 tests. It covers debounce and lifecycle
flushes, storage failures and retries, connection isolation, exact parameter
comparison, publication preflight and recovery of malformed open and closed drafts.
The four additional recovery regressions failed against the prepared patch before
the fixes and passed afterward. All 60 tests pass locally under Node 22.16.0 and
TypeScript 5.8.3. The locked CI compiler is TypeScript 5.9.3.

Twelve browser scenarios cover run/chart/save/reload, partial script failure,
connection isolation, page suspension, close/reopen, parameter freshness, malformed
metadata, frozen shares, stale SQL and parameter publication, closed-only recovery,
and terminal-stream reuse. These tests use explicit fixture data, not a SQL
emulator. Live ClickHouse checks remain a separate integration suite.

Run `npm run test:workspace` for the isolated regressions. The Workbench validation
workflow runs the full core and workspace suites, typecheck and build, live database
integration checks, SQL evaluations and browser scenarios. Use the workflow run for
the relevant commit as the authority on application-level validation, not the local
isolated test count.
