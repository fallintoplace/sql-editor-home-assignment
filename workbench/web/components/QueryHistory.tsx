import { useDeferredValue, useMemo, useState } from 'react';
import type { Run, RunStatus } from '../../shared/types';
import { HISTORY_STATUSES, searchHistory } from '../../shared/workbench-view';
import { Action, Callout, Select, TextField } from '../ui';

export function QueryHistory({ runs, selectedRunId, allFiles, fetching, error, busy, onToggleScope, onRetry, onOpen, onChild, onCancel }: {
    runs: readonly Run[];
    selectedRunId?: string;
    allFiles: boolean;
    fetching: boolean;
    error?: string;
    busy: boolean;
    onToggleScope: () => void;
    onRetry: () => void;
    onOpen: (run: Run) => void;
    onChild: (run: Run) => void;
    onCancel: (run: Run) => void;
}) {
    const [search, setSearch] = useState(''), [status, setStatus] = useState<RunStatus | 'all'>('all'), [limit, setLimit] = useState(50);
    const deferredSearch = useDeferredValue(search);
    const matches = useMemo(() => searchHistory(runs, deferredSearch, status), [runs, deferredSearch, status]);
    const searching = search !== deferredSearch;
    const displayed = matches.slice(0, limit);
    const clear = () => { setSearch(''); setStatus('all'); setLimit(50); };
    return <section id="query-history" className="history" aria-label="Query history">
        <div className="toolbar spread wrap"><h3>Query history</h3><Action onClick={() => { setLimit(50); onToggleScope(); }}>{allFiles ? 'Show current file' : 'Show all workspace files'}</Action></div>
        <div className="history-controls">
            <TextField label="Search query history" placeholder="Find SQL or a query ID" value={search} maxLength={256}
                onChange={value => { setSearch(value); setLimit(50); }}
                onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setSearch(''); setLimit(50); } }}/>
            <Select label="Run status" value={status} options={[...HISTORY_STATUSES]} onSelect={value => {
                if (HISTORY_STATUSES.some(option => option.value === value)) { setStatus(value as RunStatus | 'all'); setLimit(50); }
            }}/>
            {(search || status !== 'all') && <Action onClick={clear}>Clear history filters</Action>}
        </div>
        <p className="muted">{allFiles ? 'All files on this connection.' : 'Runs belonging to this file.'} Search and status filters use loaded history only. No SQL is executed.</p>
        {error && <Callout danger>{error}<Action disabled={fetching} onClick={onRetry}>Retry history</Action></Callout>}
        <p className="muted" role="status">{searching ? 'Filtering loaded history…' : !runs.length && fetching ? 'Loading query history…' : `Showing ${displayed.length} of ${matches.length} matching runs (${runs.length} loaded in this scope).`}</p>
        {!searching && !fetching && !error && !matches.length && <div className="result-empty">
            <h4>{runs.length ? 'No runs match these filters.' : 'No runs in this history view yet.'}</h4>
            <p>{runs.length ? 'Clear the filters to see the other loaded runs.' : allFiles ? 'A query appears here after you explicitly run it.' : 'Run this draft, or choose Show all workspace files to inspect other runs.'}</p>
        </div>}
        <div className="history-items" aria-busy={searching}>
            {displayed.map(run => <article className="history-entry" data-selected={selectedRunId === run.id} key={run.id}>
                <div className="history-row"><Action type="empty" aria-current={selectedRunId === run.id ? 'true' : undefined}
                    title={run.sql} onClick={() => onOpen(run)}>{run.status} · {Math.round(run.elapsedMs)} ms · {run.sql.replace(/\s+/g, ' ').slice(0, 140)}</Action>
                    <Action onClick={() => onChild(run)}>SQL as child draft</Action>
                    {(run.status === 'queued' || run.status === 'running') && <Action disabled={busy} onClick={() => onCancel(run)}>Cancel</Action>}
                </div>
                <div className="history-details"><code>{run.queryId}</code><span>{run.rowCount.toLocaleString()} returned rows</span>
                    {Number.isFinite(Date.parse(run.createdAt)) && <time dateTime={run.createdAt}>{new Date(run.createdAt).toLocaleString()}</time>}
                </div>
            </article>)}
        </div>
        {matches.length > limit && <Action disabled={searching} onClick={() => setLimit(value => value + 50)}>Show {Math.min(50, matches.length - limit)} more runs</Action>}
    </section>;
}
