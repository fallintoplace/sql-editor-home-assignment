import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import type { Connection, Json, Principal, Result, Run, RunStatus, Schema } from '../shared/types';
import { DEFAULT_LIMITS } from '../shared/types';
import { api, download, message, post } from './api';
import { SqlEditor, type SqlEditorHandle } from './components/SqlEditor';

type Connected = Connection & { trusted: boolean };
type Session = { principal: Principal | null; requiresLogin: boolean; demo: boolean };
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const starterSql = `SELECT
    number,
    number * 2 AS doubled
FROM numbers(20)
ORDER BY number;`;
const terminalStatuses: RunStatus[] = ['succeeded', 'truncated', 'failed', 'cancelled', 'timed_out', 'interrupted'];

function cx(...values: Array<string | false | undefined>) {
    return values.filter(Boolean).join(' ');
}

function buttonClasses(variant: ButtonVariant) {
    const common = 'inline-flex min-h-8 items-center justify-center gap-2 rounded border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';
    const variants: Record<ButtonVariant, string> = {
        primary: 'border-violet-400/60 bg-violet-500 text-white hover:bg-violet-400',
        secondary: 'border-slate-700 bg-slate-800/70 text-slate-200 hover:border-slate-600 hover:bg-slate-700',
        ghost: 'border-transparent bg-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800/70 hover:text-slate-100',
        danger: 'border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
    };
    return `${common} ${variants[variant]}`;
}

function Button({ variant = 'secondary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
    return <button {...props} className={cx(buttonClasses(variant), className)} />;
}

function TextInput({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
    return <label className="block min-w-0 space-y-1">
        {label && <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>}
        <input {...props} className={cx('h-8 w-full rounded border border-slate-700 bg-[#0f1117] px-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-violet-400 focus:outline-none', className)} />
    </label>;
}

function Callout({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
    return <div role={danger ? 'alert' : 'status'} className={cx('border-l-2 px-3 py-2 text-xs leading-5', danger ? 'border-rose-400 bg-rose-400/10 text-rose-200' : 'border-violet-400 bg-violet-400/10 text-slate-300')}>
        {children}
    </div>;
}

function StatusDot({ trusted }: { trusted: boolean }) {
    return <span className={cx('inline-flex items-center gap-1.5 text-[11px]', trusted ? 'text-emerald-300' : 'text-amber-300')}>
        <span className={cx('h-1.5 w-1.5 rounded-full', trusted ? 'bg-emerald-400' : 'bg-amber-400')} />
        {trusted ? 'Connected' : 'Untrusted'}
    </span>;
}

function RunBadge({ status }: { status: RunStatus }) {
    const color = status === 'succeeded' || status === 'truncated' ? 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10' :
        status === 'failed' || status === 'cancelled' || status === 'timed_out' || status === 'interrupted' ? 'text-rose-300 border-rose-400/40 bg-rose-400/10' :
            'text-amber-300 border-amber-400/40 bg-amber-400/10';
    return <span className={cx('inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]', color)}>{status}</span>;
}

function displayValue(value: Json | undefined) {
    if (value === null)
        return 'NULL';
    if (value === undefined)
        return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function csvValue(value: Json | undefined) {
    const text = displayValue(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv(result: Result) {
    return [result.columns.map(column => csvValue(column.name)).join(','), ...result.rows.map(row => row.map(csvValue).join(','))].join('\n');
}

function LoginScreen({ onLogin, busy, error }: { onLogin: (token: string) => void; busy: boolean; error?: string }) {
    const [token, setToken] = useState('');
    return <main className="grid min-h-screen place-items-center bg-[#0b0d11] p-6 text-slate-200">
        <section className="w-full max-w-sm border border-slate-800 bg-[#101218] p-6 shadow-2xl shadow-black/20">
            <div className="mb-8">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">SQL / PRO</p>
                <h1 className="text-xl font-semibold tracking-tight text-slate-100">Open your workspace</h1>
                <p className="mt-2 text-xs leading-5 text-slate-500">Local-first ClickHouse SQL. Credentials stay on the server.</p>
            </div>
            <form className="space-y-4" onSubmit={event => { event.preventDefault(); onLogin(token); }}>
                <TextInput label="Workspace token" type="password" value={token} onChange={event => setToken(event.target.value)} autoFocus />
                <Button variant="primary" type="submit" disabled={busy || !token} className="w-full">{busy ? 'Opening…' : 'Open workspace'}</Button>
            </form>
            {error && <p className="mt-4 text-xs text-rose-300">{error}</p>}
        </section>
    </main>;
}

function ResultPanel({ run, result }: { run?: Run; result?: Result }) {
    const [filter, setFilter] = useState('');
    const [page, setPage] = useState(0);
    const [view, setView] = useState<'table' | 'json'>('table');
    const pageSize = 100;
    const filteredRows = useMemo(() => {
        if (!result || !filter.trim())
            return result?.rows ?? [];
        const term = filter.toLocaleLowerCase();
        return result.rows.filter(row => row.map(displayValue).join('\u0001').toLocaleLowerCase().includes(term));
    }, [filter, result]);
    const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const currentPage = Math.min(page, pageCount - 1);
    const rows = filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

    useEffect(() => setPage(0), [filter, result?.runId]);

    return <section className="flex min-h-0 flex-1 flex-col bg-[#0d0f14]" aria-label="Query results">
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
            <div className="flex min-w-0 items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Output</span>
                {run && <RunBadge status={run.status} />}
                {run && <span className="truncate font-mono text-[11px] text-slate-500">{run.queryId}</span>}
            </div>
            <div className="flex items-center gap-1">
                <Button variant={view === 'table' ? 'secondary' : 'ghost'} className="min-h-7 px-2" onClick={() => setView('table')}>Table</Button>
                <Button variant={view === 'json' ? 'secondary' : 'ghost'} className="min-h-7 px-2" onClick={() => setView('json')}>JSON</Button>
                {result && <Button variant="ghost" className="min-h-7 px-2" onClick={() => download(`${run?.queryId ?? 'result'}.csv`, exportCsv(result), 'text/csv')}>Export CSV</Button>}
            </div>
        </header>
        {!run && <div className="grid min-h-0 flex-1 place-items-center p-8 text-center"><div><p className="text-sm text-slate-400">Run a query to inspect results</p><p className="mt-1 text-xs text-slate-600">⌘ / Ctrl + Enter runs the current statement.</p></div></div>}
        {run && <div className="min-h-0 flex-1 overflow-auto p-4">
            <div className="mb-4 grid grid-cols-2 gap-px border border-slate-800 bg-slate-800 sm:grid-cols-4">
                <div className="bg-[#111318] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Duration</p><p className="mt-1 font-mono text-xs text-slate-200">{Math.round(run.elapsedMs)} ms</p></div>
                <div className="bg-[#111318] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Rows</p><p className="mt-1 font-mono text-xs text-slate-200">{run.rowCount.toLocaleString()}</p></div>
                <div className="bg-[#111318] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Bytes</p><p className="mt-1 font-mono text-xs text-slate-200">{run.bytes.toLocaleString()}</p></div>
                <div className="bg-[#111318] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Server</p><p className="mt-1 truncate font-mono text-xs text-slate-200">{run.serverVersion ?? '—'}</p></div>
            </div>
            {run.error && <Callout danger>{run.error.code}: {run.error.message}</Callout>}
            {run.warnings.map((warning, index) => <div key={index} className="mt-3"><Callout>{warning}</Callout></div>)}
            {run.status === 'queued' || run.status === 'running' ? <div className="flex items-center gap-2 py-6 text-xs text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />Waiting for ClickHouse…</div> : !result ? <p className="py-6 text-xs text-slate-500">No retained result is available for this run.</p> : view === 'json' ? <pre className="max-h-full overflow-auto border border-slate-800 bg-[#090b0f] p-4 font-mono text-[11px] leading-5 text-slate-300">{JSON.stringify(result, null, 2)}</pre> : <>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <TextInput aria-label="Filter result rows" placeholder="Filter retained rows" value={filter} onChange={event => setFilter(event.target.value)} className="min-w-56" />
                    <span className="text-[11px] text-slate-500">{filteredRows.length.toLocaleString()} rows · {result.columns.length} columns</span>
                </div>
                <div className="overflow-auto border border-slate-800">
                    <table className="min-w-full border-collapse text-left font-mono text-[11px]">
                        <thead className="sticky top-0 z-10 bg-[#181b23] text-[10px] uppercase tracking-[0.08em] text-slate-500">
                            <tr><th className="border-b border-slate-700 px-3 py-2 font-medium">#</th>{result.columns.map((column, index) => <th key={index} className="max-w-64 border-b border-slate-700 px-3 py-2 font-medium"><span className="block truncate text-slate-300">{column.name}</span><span className="mt-1 block normal-case tracking-normal text-[10px] text-slate-600">{column.type}</span></th>)}</tr>
                        </thead>
                        <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="hover:bg-violet-400/[0.04]"><th className="border-b border-slate-800 px-3 py-2 font-normal text-slate-600">{currentPage * pageSize + rowIndex + 1}</th>{result.columns.map((_, columnIndex) => <td key={columnIndex} title={displayValue(row[columnIndex])} className="max-w-72 border-b border-slate-800 px-3 py-2 align-top text-slate-300"><span className={row[columnIndex] === null ? 'text-slate-600' : undefined}>{displayValue(row[columnIndex])}</span></td>)}</tr>)}</tbody>
                    </table>
                    {!rows.length && <p className="p-8 text-center text-xs text-slate-500">No rows match this filter.</p>}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
                    <span>Page {currentPage + 1} of {pageCount} · showing at most {pageSize} rows</span>
                    <div className="flex gap-1"><Button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button></div>
                </div>
            </>}
        </div>}
    </section>;
}

function SchemaExplorer({ schema, loading, error, onRefresh, onInsert }: { schema?: Schema; loading: boolean; error?: string; onRefresh: () => void; onInsert: (value: string) => void }) {
    const [search, setSearch] = useState('');
    const term = search.trim().toLocaleLowerCase();
    const columns = schema?.columns ?? [];
    const tables = (schema?.tables ?? []).filter(table => {
        if (!term)
            return true;
        return `${table.database}.${table.name}`.toLocaleLowerCase().includes(term) || columns.some(column => column.database === table.database && column.table === table.name && column.name.toLocaleLowerCase().includes(term));
    });
    return <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-2 border-b border-slate-800 p-3"><TextInput aria-label="Filter schema" placeholder="Filter tables and columns" value={search} onChange={event => setSearch(event.target.value)} /><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Explorer</span><Button variant="ghost" className="min-h-6 px-1.5 text-[10px]" onClick={onRefresh} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button></div></div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
            {error && <Callout danger>{error}</Callout>}
            {!schema && !loading && !error && <p className="p-3 text-xs leading-5 text-slate-600">Trust the connection to inspect its schema.</p>}
            {loading && <p className="p-3 text-xs text-slate-500">Reading schema…</p>}
            {schema?.warnings.map((warning, index) => <p key={index} className="p-2 text-[11px] text-amber-300">{warning}</p>)}
            <div className="space-y-1">{tables.map(table => <details key={`${table.database}.${table.name}`} className="group rounded border border-transparent hover:border-slate-800">
                <summary className="flex items-center gap-2 px-2 py-2 text-xs text-slate-300 hover:bg-slate-800/50"><span className="font-mono text-[10px] text-violet-300">▾</span><span className="truncate">{table.database}.{table.name}</span><span className="ml-auto text-[10px] text-slate-600">{table.engine}</span></summary>
                <div className="border-t border-slate-800/70 py-1">{columns.filter(column => column.database === table.database && column.table === table.name && (!term || column.name.toLocaleLowerCase().includes(term) || `${table.database}.${table.name}`.toLocaleLowerCase().includes(term))).map(column => <button key={column.name} type="button" className="flex w-full items-center justify-between gap-2 px-4 py-1.5 text-left text-[11px] text-slate-500 hover:bg-violet-400/[0.05] hover:text-slate-200" title={column.comment || column.type} onClick={() => onInsert(column.name)}><span className="truncate">{column.name}</span><span className="shrink-0 font-mono text-[10px] text-slate-600">{column.type}</span></button>)}</div>
            </details>)}</div>
            {schema && !tables.length && <p className="p-3 text-xs text-slate-600">No matching tables.</p>}
        </div>
    </div>;
}

function HistoryList({ runs, selectedId, onOpen }: { runs: Run[]; selectedId?: string; onOpen: (run: Run) => void }) {
    return <div className="min-h-0 flex-1 overflow-auto p-2">
        {!runs.length && <p className="p-3 text-xs leading-5 text-slate-600">Runs from this connection will appear here.</p>}
        <div className="space-y-1">{runs.map(run => <button key={run.id} type="button" onClick={() => onOpen(run)} className={cx('w-full border px-2.5 py-2 text-left', selectedId === run.id ? 'border-violet-400/50 bg-violet-400/[0.08]' : 'border-transparent hover:border-slate-800 hover:bg-slate-800/50')}><div className="flex items-center justify-between gap-2"><RunBadge status={run.status} /><span className="font-mono text-[10px] text-slate-600">{Math.round(run.elapsedMs)} ms</span></div><p className="mt-1 line-clamp-2 font-mono text-[11px] leading-4 text-slate-400">{run.sql.replace(/\s+/g, ' ')}</p><p className="mt-1 text-[10px] text-slate-600">{new Date(run.createdAt).toLocaleString()} · {run.rowCount.toLocaleString()} rows</p></button>)}</div>
    </div>;
}

function Workspace({ connection, onSelectConnection, connections, onRefreshConnections }: { connection: Connected; connections: Connected[]; onSelectConnection: (id: string) => void; onRefreshConnections: () => Promise<void> }) {
    const editor = useRef<SqlEditorHandle>(null);
    const poll = useRef<number | undefined>(undefined);
    const storageKey = `sql-pro:draft:${connection.id}`;
    const [sql, setSql] = useState(() => localStorage.getItem(storageKey) ?? starterSql);
    const [schema, setSchema] = useState<Schema>();
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [schemaError, setSchemaError] = useState('');
    const [history, setHistory] = useState<Run[]>([]);
    const [run, setRun] = useState<Run>();
    const [result, setResult] = useState<Result>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sidebar, setSidebar] = useState<'schema' | 'history'>('schema');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [limits, setLimits] = useState({ rows: String(connection.limits.rows || DEFAULT_LIMITS.rows), seconds: String(connection.limits.seconds || DEFAULT_LIMITS.seconds) });

    const loadHistory = async () => {
        try {
            setHistory(await api<Run[]>(`/runs?connectionId=${encodeURIComponent(connection.id)}`));
        }
        catch (caught) {
            setError(message(caught));
        }
    };
    const loadSchema = async () => {
        if (!connection.trusted)
            return;
        setSchemaLoading(true);
        setSchemaError('');
        try {
            setSchema(await api<Schema>(`/connections/${encodeURIComponent(connection.id)}/schema`));
        }
        catch (caught) {
            setSchemaError(message(caught));
        }
        finally {
            setSchemaLoading(false);
        }
    };
    const loadResult = async (nextRun: Run) => {
        if (nextRun.resultState !== 'reopenable') {
            setResult(undefined);
            return;
        }
        try {
            setResult(await api<Result>(`/runs/${encodeURIComponent(nextRun.id)}/snapshot`));
        }
        catch (caught) {
            setError(message(caught));
        }
    };
    const watchRun = async (id: string) => {
        if (poll.current !== undefined)
            window.clearInterval(poll.current);
        let finished = false;
        const tick = async () => {
            try {
                const next = await api<Run>(`/runs/${encodeURIComponent(id)}`);
                setRun(next);
                if (terminalStatuses.includes(next.status)) {
                    finished = true;
                    if (poll.current !== undefined)
                        window.clearInterval(poll.current);
                    poll.current = undefined;
                    await loadResult(next);
                    await loadHistory();
                }
            }
            catch (caught) {
                if (poll.current !== undefined)
                    window.clearInterval(poll.current);
                poll.current = undefined;
                setError(message(caught));
            }
        };
        await tick();
        if (!finished)
            poll.current = window.setInterval(() => void tick(), 600);
    };

    useEffect(() => {
        setSql(localStorage.getItem(storageKey) ?? starterSql);
        setSchema(undefined);
        setSchemaError('');
        setRun(undefined);
        setResult(undefined);
        setLimits({ rows: String(connection.limits.rows || DEFAULT_LIMITS.rows), seconds: String(connection.limits.seconds || DEFAULT_LIMITS.seconds) });
        void loadHistory();
        if (connection.trusted)
            void loadSchema();
        return () => {
            if (poll.current !== undefined)
                window.clearInterval(poll.current);
            poll.current = undefined;
        };
    }, [connection.id, connection.trusted]);

    useEffect(() => {
        localStorage.setItem(storageKey, sql);
    }, [sql, storageKey]);

    const runQuery = async () => {
        if (!connection.trusted) {
            setError('Trust this connection before running SQL.');
            return;
        }
        if (!sql.trim()) {
            setError('Write a SQL statement before running it.');
            return;
        }
        setBusy(true);
        setError('');
        setResult(undefined);
        try {
            const next = await post<Run>('/runs', {
                clientRequestId: crypto.randomUUID(),
                connectionId: connection.id,
                sql,
                parameters: {},
                limits: { rows: Number(limits.rows), seconds: Number(limits.seconds) },
                tags: { surface: 'sql-pro' },
            });
            setRun(next);
            await watchRun(next.id);
        }
        catch (caught) {
            setError(message(caught));
        }
        finally {
            setBusy(false);
        }
    };
    const cancelRun = async () => {
        if (!run || terminalStatuses.includes(run.status))
            return;
        setBusy(true);
        try {
            const next = await post<Run>(`/runs/${encodeURIComponent(run.id)}/cancel`);
            setRun(next);
            await loadHistory();
        }
        catch (caught) {
            setError(message(caught));
        }
        finally {
            setBusy(false);
        }
    };
    const testConnection = async () => {
        setBusy(true);
        setError('');
        try {
            await post(`/connections/${encodeURIComponent(connection.id)}/test`);
            await onRefreshConnections();
            setSchemaError('Connection test completed.');
        }
        catch (caught) {
            setError(message(caught));
        }
        finally {
            setBusy(false);
        }
    };
    const toggleTrust = async () => {
        if (!connection.trusted && !window.confirm(`Trust the read-only connection ${connection.id}?`))
            return;
        setBusy(true);
        setError('');
        try {
            await post(`/connections/${encodeURIComponent(connection.id)}/trust`, { trusted: !connection.trusted, confirmation: connection.id });
            await onRefreshConnections();
        }
        catch (caught) {
            setError(message(caught));
        }
        finally {
            setBusy(false);
        }
    };
    const openRun = async (selected: Run) => {
        setRun(selected);
        setSql(selected.sql);
        setResult(undefined);
        await loadResult(selected);
        setSidebarOpen(false);
    };

    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0b0d11]">
        <header className="flex min-h-12 flex-wrap items-center gap-3 border-b border-slate-800 bg-[#101218] px-3 py-2 lg:px-4">
            <button type="button" className="flex items-center gap-2 text-left" onClick={() => setSidebarOpen(value => !value)}><span className="text-[11px] font-bold tracking-[0.2em] text-violet-300">SQL / PRO</span><span className="hidden text-[10px] uppercase tracking-[0.12em] text-slate-600 sm:inline">ClickHouse workspace</span></button>
            <div className="hidden h-5 w-px bg-slate-800 sm:block" />
            <select aria-label="Connection" value={connection.id} onChange={event => onSelectConnection(event.target.value)} className="h-7 max-w-52 rounded border border-slate-700 bg-[#0b0d11] px-2 text-xs text-slate-200 focus:border-violet-400 focus:outline-none">{connections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <StatusDot trusted={connection.trusted} />
            <span className="hidden text-[11px] text-slate-600 md:inline">{connection.database} · {connection.username}</span>
            <div className="ml-auto flex items-center gap-1.5"><Button variant="ghost" className="min-h-7 px-2" onClick={testConnection} disabled={busy}>Test</Button><Button variant={connection.trusted ? 'danger' : 'primary'} className="min-h-7 px-2" onClick={toggleTrust} disabled={busy}>{connection.trusted ? 'Revoke trust' : 'Trust connection'}</Button></div>
        </header>
        {error && <div className="border-b border-slate-800 bg-[#111318] px-4 py-2"><Callout danger>{error}</Callout></div>}
        <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside className={cx('fixed inset-y-12 left-0 z-30 w-72 flex-col border-r border-slate-800 bg-[#0f1117] lg:static lg:flex', sidebarOpen ? 'flex' : 'hidden')}>
                <div className="grid grid-cols-2 border-b border-slate-800 p-2"><Button variant={sidebar === 'schema' ? 'secondary' : 'ghost'} className="min-h-7 rounded-sm px-2 text-[11px]" onClick={() => setSidebar('schema')}>Explorer</Button><Button variant={sidebar === 'history' ? 'secondary' : 'ghost'} className="min-h-7 rounded-sm px-2 text-[11px]" onClick={() => setSidebar('history')}>History</Button></div>
                {sidebar === 'schema' ? <SchemaExplorer schema={schema} loading={schemaLoading} error={schemaError} onRefresh={() => void loadSchema()} onInsert={value => editor.current?.insert(value)} /> : <HistoryList runs={history} selectedId={run?.id} onOpen={selected => void openRun(selected)} />}
                <footer className="border-t border-slate-800 p-3 text-[10px] leading-4 text-slate-600"><p className="font-mono">{connection.host}</p><p className="mt-1">Read-only identity · {connection.manifest?.serverVersion ?? 'version unknown'}</p></footer>
            </aside>
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-9 items-center gap-1 overflow-x-auto border-b border-slate-800 bg-[#0d0f14] px-2"><button type="button" className="flex h-8 min-w-36 items-center gap-2 border-b-2 border-violet-400 px-3 text-left text-xs text-slate-200"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />main.sql<span className="ml-auto text-slate-600">×</span></button><span className="ml-auto whitespace-nowrap px-3 text-[10px] text-slate-600">Local draft</span></div>
                <div className="flex min-h-0 flex-1 flex-col">
                    <section className="flex min-h-[360px] min-w-0 flex-[3] flex-col">
                        <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-slate-800 bg-[#111318] px-3 py-2"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Query editor</span><span className="text-[11px] text-slate-600">{sql.split(/;\s*/).filter(Boolean).length || 1} statement</span><div className="ml-auto flex gap-1"><Button variant="ghost" className="min-h-7 px-2" onClick={() => setSql(starterSql)}>Reset</Button><Button variant="ghost" className="min-h-7 px-2" onClick={() => setSql(value => value.replace(/\s+$/g, ''))}>Trim</Button></div></div>
                        <div className="min-h-0 flex-1 bg-[#111318]"><SqlEditor ref={editor} value={sql} schema={schema} onChange={setSql} onRun={() => void runQuery()} /></div>
                        <div className="flex flex-wrap items-end gap-2 border-t border-slate-800 bg-[#0f1117] p-3"><Button variant="primary" onClick={() => void runQuery()} disabled={busy || !connection.trusted}>{busy ? 'Running…' : 'Run query'}<span className="hidden text-[10px] text-violet-100/70 sm:inline">⌘↵</span></Button><Button variant="secondary" onClick={() => void cancelRun()} disabled={busy || !run || terminalStatuses.includes(run.status)}>Cancel</Button><div className="ml-auto grid grid-cols-2 gap-2"><TextInput label="Rows" inputMode="numeric" value={limits.rows} onChange={event => setLimits(current => ({ ...current, rows: event.target.value }))} className="w-24" /><TextInput label="Seconds" inputMode="numeric" value={limits.seconds} onChange={event => setLimits(current => ({ ...current, seconds: event.target.value }))} className="w-24" /></div></div>
                    </section>
                    <ResultPanel run={run} result={result} />
                </div>
            </main>
            <aside className="hidden w-64 shrink-0 flex-col border-l border-slate-800 bg-[#0f1117] xl:flex">
                <div className="border-b border-slate-800 px-3 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Run context</p><p className="mt-1 truncate text-xs text-slate-200">{run?.queryId ?? 'No run selected'}</p></div>
                <div className="space-y-4 overflow-auto p-3 text-xs">
                    <section><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Connection</p><dl className="space-y-2"><div className="flex justify-between gap-3"><dt className="text-slate-600">Host</dt><dd className="max-w-32 truncate text-right font-mono text-slate-400">{connection.host}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-600">Database</dt><dd className="text-slate-400">{connection.database}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-600">Identity</dt><dd className="text-slate-400">{connection.username}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-600">Access</dt><dd><StatusDot trusted={connection.trusted} /></dd></div></dl></section>
                    <section><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Shortcuts</p><div className="space-y-2 text-slate-500"><div className="flex justify-between gap-2"><span>Run query</span><kbd className="font-mono text-slate-400">⌘ ↵</kbd></div><div className="flex justify-between gap-2"><span>Schema insert</span><kbd className="font-mono text-slate-400">click</kbd></div><div className="flex justify-between gap-2"><span>Filter result</span><kbd className="font-mono text-slate-400">input</kbd></div></div></section>
                    {run && <section><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Latest run</p><div className="space-y-2 border border-slate-800 bg-[#111318] p-2.5"><div className="flex items-center justify-between"><span className="text-slate-500">State</span><RunBadge status={run.status} /></div><div className="flex items-center justify-between"><span className="text-slate-500">Rows</span><span className="font-mono text-slate-300">{run.rowCount.toLocaleString()}</span></div><div className="flex items-center justify-between"><span className="text-slate-500">Elapsed</span><span className="font-mono text-slate-300">{Math.round(run.elapsedMs)} ms</span></div></div></section>}
                </div>
            </aside>
        </div>
    </div>;
}

export function App() {
    const [session, setSession] = useState<Session>();
    const [connections, setConnections] = useState<Connected[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [loading, setLoading] = useState(true);
    const [loginBusy, setLoginBusy] = useState(false);
    const [error, setError] = useState('');

    const refreshSession = async () => {
        const next = await api<Session>('/session');
        setSession(next);
        if (next.principal) {
            const nextConnections = await api<Connected[]>('/connections');
            setConnections(nextConnections);
            setSelectedId(current => nextConnections.some(connection => connection.id === current) ? current : nextConnections[0]?.id ?? '');
        }
    };
    useEffect(() => {
        void refreshSession().catch(caught => setError(message(caught))).finally(() => setLoading(false));
    }, []);
    const login = async (token: string) => {
        setLoginBusy(true);
        setError('');
        try {
            await post('/session', { token });
            await refreshSession();
        }
        catch (caught) {
            setError(message(caught));
        }
        finally {
            setLoginBusy(false);
        }
    };
    const signOut = async () => {
        await api('/session', { method: 'DELETE' });
        setSession({ principal: null, requiresLogin: true, demo: false });
        setConnections([]);
    };
    if (loading)
        return <div className="grid min-h-screen place-items-center bg-[#0b0d11] text-xs text-slate-500">Opening workspace…</div>;
    if (session?.requiresLogin && !session.principal)
        return <LoginScreen onLogin={token => void login(token)} busy={loginBusy} error={error} />;
    const connection = connections.find(item => item.id === selectedId) ?? connections[0];
    if (!connection)
        return <main className="grid min-h-screen place-items-center bg-[#0b0d11] p-6 text-center text-slate-300"><div><p className="text-sm">No connection profiles are configured.</p><p className="mt-2 text-xs text-slate-600">Configure a local profile, then reload this workspace.</p>{error && <p className="mt-4 text-rose-300">{error}</p>}<Button className="mt-5" onClick={() => void signOut()}>Sign out</Button></div></main>;
    return <div className="flex min-h-screen flex-col bg-[#0b0d11] text-slate-200"><Workspace connection={connection} connections={connections} onSelectConnection={setSelectedId} onRefreshConnections={async () => { const next = await api<Connected[]>('/connections'); setConnections(next); }} /><button type="button" className="fixed bottom-3 left-3 z-40 hidden rounded border border-slate-700 bg-[#171a22] px-2 py-1 text-[10px] text-slate-500 hover:text-slate-200 lg:block" onClick={() => void signOut()}>Sign out</button></div>;
}
