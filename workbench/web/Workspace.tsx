import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@clickhouse/click-ui';
import type { Connection, QueryDocument, Run, RunEvent, Schema, Script, Published } from '../shared/types';
import { parameterNames, quoteIdentifier, selectedStatement, splitSql, insertChildFilter } from '../shared/sql';
import { api, download, message, post } from './api';
import { Action, Callout, Select, TextField, useConfirmation } from './ui';
import { checkpoint, newDraft, recover, type Draft, type WorkspaceState } from './workspace-state';
import { SqlEditor, type EditorHandle } from './components/SqlEditor';
import { ResultPane } from './components/ResultPane';
import { AssistantPanel } from './components/AssistantPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { ImportPanel } from './components/ImportPanel';
import { AutomationPanel } from './components/AutomationPanel';
const terminal = (run?: Run) => Boolean(run && ['succeeded', 'truncated', 'failed', 'cancelled', 'timed_out', 'interrupted'].includes(run.status));
type Connected = Connection & {
    trusted: boolean;
};
type Panel = 'assistant' | 'library' | 'import' | 'evidence' | 'monitors';
export function Workspace({ connection, dark, refresh }: {
    connection: Connected;
    dark: boolean;
    refresh: () => Promise<unknown>;
}) {
    const key = `cathedral:local-owner:${connection.id}:v1`, [state, setState] = useState<WorkspaceState>(() => recover(key)), stateRef = useRef(state);
    stateRef.current = state;
    const active = state.tabs.find(t => t.id === state.activeId) ?? state.tabs[0]!, editor = useRef<EditorHandle>(null), client = useQueryClient(), confirmation = useConfirmation();
    const [error, setError] = useState(''), [notice, setNotice] = useState(''), [storageError, setStorageError] = useState(''), [busy, setBusy] = useState(false), latch = useRef(false), [search, setSearch] = useState(''), [panel, setPanel] = useState<Panel | null>('assistant'), [palette, setPalette] = useState(false), [paletteSearch, setPaletteSearch] = useState(''), [rowLimit, setRowLimit] = useState(String(connection.limits.rows)), [timeLimit, setTimeLimit] = useState(String(connection.limits.seconds)), [allHistory, setAllHistory] = useState(false), [link, setLink] = useState('');
    const update = useCallback((id: string, change: (d: Draft) => Draft) => setState(s => ({ ...s, tabs: s.tabs.map(d => d.id === id ? change(d) : d) })), []);
    const patch = (values: Partial<Draft>) => update(active.id, d => ({ ...d, ...values }));
    useEffect(() => { const timer = setTimeout(() => { try {
        localStorage.setItem(key, JSON.stringify(state));
        setStorageError('');
    }
    catch {
        setStorageError('Browser draft storage is unavailable or full. Export your local drafts before closing this page.');
    } }, 150); return () => clearTimeout(timer); }, [state, key]);
    const schema = useQuery({ queryKey: ['schema', connection.id], queryFn: ({ signal }) => api<Schema>(`/connections/${connection.id}/schema`, { signal }), enabled: connection.trusted, retry: false });
    const documents = useQuery({ queryKey: ['documents', connection.id], queryFn: () => api<QueryDocument[]>('/documents?trash=true'), retry: false });
    const history = useQuery({ queryKey: ['runs', connection.id], queryFn: () => api<Run[]>(`/runs?connectionId=${encodeURIComponent(connection.id)}`), refetchInterval: 4000, retry: false });
    const run = useQuery({ queryKey: ['run', connection.id, active.activeRunId], queryFn: async ({ signal }) => { const value = await api<Run>(`/runs/${active.activeRunId}`, { signal }); if (value.connectionId !== connection.id)
            throw new Error('This saved run belongs to another connection.'); return value; }, enabled: Boolean(active.activeRunId), refetchInterval: q => terminal(q.state.data) ? false : 1500, retry: false,
        structuralSharing: (old: unknown, incoming: unknown) => { const previous = old as Run | undefined, next = incoming as Run; return previous && next && previous.sequence > next.sequence ? previous : next; } });
    const script = useQuery({ queryKey: ['script', connection.id, active.scriptId], queryFn: () => api<Script>(`/scripts/${active.scriptId}`), enabled: Boolean(active.scriptId), refetchInterval: q => q.state.data?.status === 'running' ? 800 : false, retry: false });
    useEffect(() => { const id = active.activeRunId; if (!id)
        return; const source = new EventSource(`/api/runs/${id}/events`); source.onmessage = event => { try {
        const data = JSON.parse(event.data) as RunEvent;
        if (data.run.id !== id || data.run.connectionId !== connection.id)
            return;
        client.setQueryData<Run>(['run', connection.id, id], old => !old || old.sequence <= data.sequence ? data.run : old);
        if (terminal(data.run)) {
            source.close();
            void client.invalidateQueries({ queryKey: ['runs', connection.id] });
        }
    }
    catch {
        source.close();
    } }; return () => source.close(); }, [active.activeRunId, connection.id, client]);
    useEffect(() => { if (active.scriptId && script.data && !active.activeRunId) {
        const first = script.data.statements.find(s => s.runId)?.runId;
        if (first)
            update(active.id, d => ({ ...d, activeRunId: first }));
    } }, [script.data, active.id, active.activeRunId, active.scriptId, update]);
    const visibleDocuments = (documents.data ?? []).filter(d => d.connectionId === connection.id), visibleHistory = (history.data ?? []).filter(r => allHistory || (active.serverId ? r.documentId === active.serverId : active.runIds.includes(r.id)));
    const parsed = useMemo(() => { try {
        return { statements: splitSql(active.sql), parameters: parameterNames(active.sql), error: '' };
    }
    catch (error) {
        return { statements: [], parameters: [], error: message(error) };
    } }, [active.sql]);
    const perform = async (fn: () => Promise<void>) => { if (latch.current)
        return; latch.current = true; setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setError(message(e));
    }
    finally {
        latch.current = false;
        setBusy(false);
    } };
    const addDraft = (draft: Draft) => { if (stateRef.current.tabs.length >= 30) {
        setError('At most 30 local tabs are supported. Save or export work before creating more.');
        return;
    } setState(s => ({ ...s, tabs: [...s.tabs, draft], activeId: draft.id })); };
    const openDocument = (document: QueryDocument) => { if (document.connectionId !== connection.id) {
        setError('Switch to the document’s connection before opening it.');
        return;
    } const existing = stateRef.current.tabs.find(t => t.serverId === document.id && t.baseRevision === document.revision); if (existing) {
        setState(s => ({ ...s, activeId: existing.id }));
        return;
    } addDraft({ ...newDraft(document.name, document.sql), serverId: document.id, baseRevision: document.revision, parameters: document.parameters, chart: document.chart, runIds: document.runId ? [document.runId] : [], activeRunId: document.runId, parentDocumentId: document.parentDocumentId, kind: document.kind, metric: document.metric, dependencies: document.dependencies }); };
    const openedLink = useRef(false);
    useEffect(() => { if (openedLink.current)
        return; openedLink.current = true; const params = new URLSearchParams(location.search), id = params.get('document'), revision = params.get('revision'); if (id)
        void api<QueryDocument>(`/documents/${encodeURIComponent(id)}${revision ? `?revision=${encodeURIComponent(revision)}` : ''}`).then(d => { if (d.connectionId === connection.id)
            openDocument(d); }).catch(e => setError(message(e))); }, [connection.id]);
    const execute = (wholeScript = false, kind: 'query' | 'explain' | 'pipeline' = 'query') => perform(async () => {
        const selection = editor.current?.selection() ?? { from: active.from, to: active.to }, statement = wholeScript ? undefined : selectedStatement(active.sql, selection.from, selection.to);
        if (!wholeScript && !statement)
            throw new Error('Select or write a SQL statement first.');
        const target = active.id, payload = { clientRequestId: crypto.randomUUID(), connectionId: connection.id, documentId: active.serverId, sql: wholeScript ? active.sql : statement!.sql, parameters: active.parameters, parentRunId: active.parentRunId, kind, limits: { rows: Number(rowLimit), seconds: Number(timeLimit) }, tags: { workspace: 'local', ...(active.serverId ? { artifact: active.serverId } : {}) } };
        if (wholeScript) {
            const result = await post<Script>('/scripts', { ...payload, stopOnError: true });
            update(target, d => ({ ...d, scriptId: result.id, activeRunId: undefined }));
            await client.invalidateQueries({ queryKey: ['script', connection.id, result.id] });
        }
        else {
            const result = await post<Run>('/runs', payload);
            client.setQueryData(['run', connection.id, result.id], result);
            update(target, d => ({ ...d, activeRunId: result.id, scriptId: undefined, runIds: [...d.runIds, result.id] }));
        }
        await history.refetch();
        if (stateRef.current.activeId === target)
            editor.current?.focus();
    });
    const saveDraft = async (draft: Draft): Promise<QueryDocument> => {
        const payload = { name: draft.name, sql: draft.sql, connectionId: connection.id, baseRevision: draft.baseRevision, parameters: draft.parameters, chart: draft.chart, runId: draft.activeRunId, parentDocumentId: draft.parentDocumentId, kind: draft.kind, metric: draft.metric, dependencies: draft.dependencies };
        const saved = await api<QueryDocument>(draft.serverId ? `/documents/${draft.serverId}` : '/documents', { method: draft.serverId ? 'PUT' : 'POST', body: payload });
        update(draft.id, d => ({ ...d, serverId: saved.id, baseRevision: saved.revision }));
        await documents.refetch();
        setNotice(`Saved ${saved.name} as revision ${saved.revision}.`);
        return saved;
    };
    const restore = (sql: string, reason: string) => update(active.id, d => ({ ...checkpoint(d, reason), sql, from: 0, to: 0 }));
    const branch = () => addDraft({ ...newDraft(`${active.name.replace(/\.sql$/, '')} experiment.sql`, active.sql), parameters: { ...active.parameters }, parentDocumentId: active.serverId, parentRunId: active.activeRunId, chart: { ...active.chart }, kind: active.kind, metric: active.metric, dependencies: [...active.dependencies] });
    const child = useCallback((column: string, value: string | null) => { const evidence = run.data; if (!evidence)
        return; try {
        const filtered = insertChildFilter(evidence.sql, column, value);
        addDraft({ ...newDraft(`Filter ${column}.sql`, filtered.sql), parameters: { ...evidence.parameters, ...filtered.parameters }, parentRunId: evidence.id, parentDocumentId: active.serverId });
        setNotice('Created a child draft. No database query has run. Review the filter and press Run.');
    }
    catch (e) {
        setError(message(e));
    } }, [run.data, active.serverId]);
    const publish = () => perform(async () => {
        if (!active.activeRunId)
            throw new Error('Run this exact SQL before publishing.');
        const confirmed = await confirmation.ask('Publish an evidence snapshot', 'Freeze the saved SQL, parameters, chart and result. Publication keeps at most 1,000 rows / 1 MB for seven days. Truncation is explicitly acknowledged; later draft edits do not change the snapshot.');
        if (!confirmed)
            return;
        update(active.id, d => checkpoint(d, 'Before publication'));
        const saved = await saveDraft(active);
        const pub = await post<Published>(`/documents/${saved.id}/publish`, { revision: saved.revision, acknowledgeTruncated: true });
        await client.invalidateQueries({ queryKey: ['published'] });
        setNotice(`Published revision ${pub.revision}. Snapshot expires ${new Date(pub.expiresAt).toLocaleString()}.`);
        if (await confirmation.ask('Create a read-only share link', 'Anyone holding this link can see the SQL and bounded result until expiry or revocation. It does not grant database access or execution rights.')) {
            const shared = await post<{
                path: string;
            }>(`/published/${pub.id}/share`, { acknowledgeShare: true });
            setLink(new URL(shared.path, location.origin).toString());
        }
    });
    const commands = [{ name: 'Run selected or current statement · Ctrl/⌘ Enter', run: () => void execute() }, { name: 'Run script · Ctrl/⌘ Shift Enter', run: () => void execute(true) }, { name: 'Save named revision', run: () => void perform(async () => { await saveDraft(active); }) }, { name: 'Explain selected statement', run: () => void execute(false, 'explain') }, { name: 'Inspect pipeline', run: () => void execute(false, 'pipeline') }, { name: 'Create isolated experiment', run: branch }, { name: 'Ask Data / review SQL', run: () => setPanel('assistant') }, { name: 'Local history and revisions', run: () => setPanel('library') }, { name: 'Preview CSV / JSON import', run: () => setPanel('import') }, { name: 'Publish evidence snapshot', run: () => void publish() }, { name: 'New SQL tab', run: () => addDraft(newDraft()) }, ...visibleDocuments.filter(d => !d.deletedAt).map(d => ({ name: `Open ${d.name}`, run: () => openDocument(d) }))];
    useEffect(() => { const keydown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && ['k', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        setPalette(true);
    } }; document.addEventListener('keydown', keydown); return () => document.removeEventListener('keydown', keydown); }, []);
    const profile = useQuery({ queryKey: ['profile', connection.id, active.activeRunId], queryFn: () => api<{
            queryId: string;
            evidence: unknown;
            notice: string;
            traceUrl?: string;
        }>(`/runs/${active.activeRunId}/profile`), enabled: false, retry: false });
    return <><div className="workspace-banner"><div><strong>{connection.name}</strong><span className="muted">{connection.host} · {connection.database} · {connection.username} · read-only exploration</span></div><div className="toolbar"><Action disabled={busy} onClick={() => void perform(async () => { await post(`/connections/${connection.id}/test`); await refresh(); setNotice('Connection capability check completed.'); })}>Test connection</Action><Action disabled={busy} type={connection.trusted ? 'secondary' : 'primary'} onClick={() => void perform(async () => { if (await confirmation.ask(connection.trusted ? 'Revoke connection trust' : 'Trust this connection', `${connection.host} · database ${connection.database} · identity ${connection.username}. ${connection.trusted ? 'Active queries will be cancelled.' : 'The application may inspect schema and execute bounded read-only queries only when you request them.'}`, connection.id)) {
        await post(`/connections/${connection.id}/trust`, { trusted: !connection.trusted, confirmation: connection.id });
        await refresh();
    } })}>{connection.trusted ? 'Revoke trust' : 'Trust connection'}</Action><Action onClick={() => setPalette(true)}>Commands ⌘K</Action></div></div>
 {!connection.trusted && <Callout>Review the configured host, database and identity, then trust the connection to inspect schema or run a query.</Callout>}
 {storageError && <Callout danger>{storageError}<Action onClick={() => download('cathedral-local-drafts.json', state)}>Export local drafts</Action></Callout>}{error && <Callout danger>{error}<Action type="empty" onClick={() => setError('')}>Dismiss</Action></Callout>}{notice && <p className="notice" role="status">{notice}</p>}
 {link && <div className="toolbar"><TextField label="Read-only share link" value={link} readOnly onChange={() => { }}/><Action onClick={() => void navigator.clipboard.writeText(link).catch(e => setError(message(e)))}>Copy link</Action></div>}
 <div className={panel ? 'workspace-grid' : 'workspace-grid drawer-closed'}><aside className="sidebar stack"><h2>Workspace</h2><Action onClick={() => addDraft(newDraft())}>New SQL tab</Action><TextField aria-label="Search files and schema" placeholder="Find files, tables, columns" value={search} onChange={setSearch}/><h3>Saved files</h3>{visibleDocuments.filter(d => !d.deletedAt && d.name.toLowerCase().includes(search.toLowerCase())).map(d => <Action type="empty" align="left" key={d.id} onClick={() => openDocument(d)}>{d.name} <small>r{d.revision}{d.verifiedRevision ? ' · self-reviewed' : ''}</small></Action>)}
 <h3>Schema</h3>{schema.isFetching && <p role="status">Loading schema…</p>}{schema.error && <Callout danger>{message(schema.error)}</Callout>}<Action disabled={!connection.trusted} onClick={() => void schema.refetch()}>Refresh schema</Action>
 {schema.data?.tables.filter(t => `${t.database}.${t.name}`.toLowerCase().includes(search.toLowerCase()) || (schema.data?.columns ?? []).some(c => c.table === t.name && c.name.toLowerCase().includes(search.toLowerCase()))).map(t => <details key={`${t.database}.${t.name}`}><summary>{t.database}.{t.name}</summary><Action type="empty" onClick={() => editor.current?.insert(`${quoteIdentifier(t.database)}.${quoteIdentifier(t.name)}`)}>Insert table</Action>{schema.data?.columns.filter(c => c.table === t.name && c.database === t.database).map(c => <Action type="empty" align="left" key={c.name} title={`${c.type} · ${c.comment}`} onClick={() => editor.current?.insert(quoteIdentifier(c.name))}>{c.name}<small>{c.type}</small></Action>)}</details>)}
 {schema.data?.warnings.map((warning, i) => <p className="muted" key={i}>{warning}</p>)}<h3>Statement outline</h3>{parsed.statements.map((s, i) => <Action key={s.from} type="empty" onClick={() => { patch({ from: s.from, to: s.to }); editor.current?.focus(); }}>Statement {i + 1} · {s.sql.slice(0, 32)}</Action>)}
 <Action onClick={() => download('cathedral-local-drafts.json', state)}>Export local drafts</Action></aside>
 <main className="editor-column"><div className="tabs" role="tablist" aria-label="SQL documents" onKeyDown={e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key))
        return; e.preventDefault(); const index = state.tabs.findIndex(d => d.id === active.id), next = (index + (e.key === 'ArrowRight' ? 1 : -1) + state.tabs.length) % state.tabs.length; setState(s => ({ ...s, activeId: s.tabs[next]!.id })); (e.currentTarget.querySelectorAll('[role=tab]')[next] as HTMLElement | undefined)?.focus(); }}>{state.tabs.map(d => <Action key={d.id} type={d.id === active.id ? 'primary' : 'empty'} role="tab" aria-selected={d.id === active.id} tabIndex={d.id === active.id ? 0 : -1} onClick={() => setState(s => ({ ...s, activeId: d.id }))}>{d.name}</Action>)}</div>
 <div className="editor-header"><TextField aria-label="SQL document name" value={active.name} onChange={name => patch({ name })}/><span className="muted">{active.serverId ? `Local draft · based on saved r${active.baseRevision}` : 'Private local draft'}</span></div>
 <div className="toolbar wrap"><Action type="primary" disabled={busy || !connection.trusted} onClick={() => void execute()}>Run statement</Action><Action disabled={busy || !connection.trusted} onClick={() => void execute(true)}>Run script</Action><Action disabled={busy || !run.data || terminal(run.data)} onClick={() => void perform(async () => { await post(`/runs/${active.activeRunId}/cancel`); await run.refetch(); })}>Cancel run</Action>{script.data?.status === 'running' && <Action onClick={() => void perform(async () => { await post(`/scripts/${active.scriptId}/cancel`); await script.refetch(); })}>Cancel script</Action>}<Action disabled={busy} onClick={() => void perform(async () => { await saveDraft(active); })}>Save revision</Action><Action disabled={busy || !active.activeRunId} onClick={() => void publish()}>Publish / share</Action><Action onClick={branch}>Branch experiment</Action></div>
 <SqlEditor key={active.id} ref={editor} value={active.sql} from={active.from} to={active.to} schema={schema.data} dark={dark} error={run.data?.sql === active.sql ? run.data.error : undefined} onChange={sql => update(active.id, d => ({ ...d, sql }))} onSelection={(from, to) => update(active.id, d => ({ ...d, from, to }))} onRun={script => void execute(script)}/>
 {parsed.error && <p className="muted">Statement boundary: {parsed.error}</p>}
 <div className="toolbar wrap"><TextField label="Maximum returned rows" value={rowLimit} onChange={setRowLimit}/><TextField label="Deadline (seconds)" value={timeLimit} onChange={setTimeLimit}/><Action disabled={busy || !connection.manifest?.explain.available || !connection.trusted} onClick={() => void execute(false, 'explain')}>EXPLAIN</Action><Action disabled={busy || !connection.manifest?.pipeline.available || !connection.trusted} onClick={() => void execute(false, 'pipeline')}>Pipeline</Action><Action onClick={() => { update(active.id, d => checkpoint(d, 'Before indentation')); editor.current?.indent(); }}>Indent selection</Action><Action onClick={() => download(active.name, active.sql, 'application/sql')}>Export SQL</Action></div>
 <p className="muted">{connection.limits.bytes.toLocaleString()} output bytes · {Math.round(connection.limits.memory / 1048576)} MiB memory · {connection.limits.threads} threads · {connection.manifest?.serverVersion ?? 'Version unknown: test the connection for capabilities'}</p>
 {parsed.parameters.length > 0 && <details open><summary>Bound query parameters</summary><div className="parameter-grid">{parsed.parameters.map(p => <TextField key={p.name} label={`${p.name} : ${p.type}`} value={active.parameters[p.name] ?? ''} onChange={value => patch({ parameters: { ...active.parameters, [p.name]: value } })}/>)}</div></details>}
 <div className="toolbar wrap">{(['assistant', 'library', 'import', 'evidence', 'monitors'] as Panel[]).map(p => <Action key={p} type={panel === p ? 'primary' : 'secondary'} onClick={() => setPanel(panel === p ? null : p)}>{p}</Action>)}</div>
 {script.data && <section className="panel-card"><h3>Script: {script.data.status}</h3><p>Stop-on-error is enabled. Every statement has a separate run and query ID.</p><div className="toolbar wrap">{script.data.statements.map((s, i) => <Action key={i} disabled={!s.runId} onClick={() => patch({ activeRunId: s.runId })}>Statement {i + 1}: {s.status}</Action>)}</div></section>}
 {run.data && <ResultPane key={run.data.id} run={run.data} draftSql={active.sql} config={active.chart} onChart={chart => patch({ chart })} onChild={child}/>} {!active.activeRunId && <div className="empty-state"><h2>Your SQL stays in charge.</h2><p>Run the example to see a typed table, chart, query ID, and retained evidence. Nothing runs automatically.</p></div>}
 {run.error && <Callout danger>{message(run.error)}</Callout>}{script.error && <Callout danger>{message(script.error)}</Callout>}
 <section className="history"><div className="toolbar spread"><h3>Query history</h3><Action onClick={() => setAllHistory(v => !v)}>{allHistory ? 'Show current file' : 'Show all workspace files'}</Action></div>{visibleHistory.slice(0, 50).map(r => <div className="history-row" key={r.id}><Action type="empty" onClick={() => patch({ activeRunId: r.id })}>{r.status} · {Math.round(r.elapsedMs)} ms · {r.sql.slice(0, 65)}</Action><Action onClick={() => addDraft({ ...newDraft('History copy.sql', r.sql), parameters: r.parameters, parentRunId: r.id })}>SQL as child draft</Action>{!terminal(r) && <Action onClick={() => void perform(async () => { await post(`/runs/${r.id}/cancel`); await history.refetch(); })}>Cancel</Action>}</div>)}</section>
 </main>
 {panel && <aside className="drawer"><div className="toolbar spread"><span className="eyebrow">Inspectable workflow</span><Action type="empty" aria-label="Close inspector" onClick={() => setPanel(null)}>Close</Action></div>
 {panel === 'assistant' && <AssistantPanel key={active.id} connectionId={connection.id} sql={active.sql} run={run.data} trusted={connection.trusted} onApply={sql => restore(sql, 'Before accepted AI proposal')}/>}
 {panel === 'library' && <LibraryPanel key={active.id} draft={active} documents={visibleDocuments} onChange={patch} onRestore={restore} onOpen={openDocument}/>}
 {panel === 'import' && <ImportPanel connectionId={connection.id} schema={schema.data} trusted={connection.trusted}/>}
 {panel === 'monitors' && <AutomationPanel connectionId={connection.id} onRun={id => patch({ activeRunId: id })}/>}
 {panel === 'evidence' && <div className="stack"><h2>Execution evidence</h2>{run.data ? <><pre className="code-block">{JSON.stringify(run.data, null, 2)}</pre><Action disabled={!connection.trusted || !connection.manifest?.queryLog.available} onClick={() => void profile.refetch()}>Fetch query-log evidence</Action>{profile.data && <><p>{profile.data.notice}</p><pre className="code-block">{JSON.stringify(profile.data.evidence, null, 2)}</pre>{profile.data.traceUrl && <a href={profile.data.traceUrl} target="_blank" rel="noreferrer">Open trace in configured observability service</a>}</>}{profile.error && <Callout danger>{message(profile.error)}</Callout>}</> : <p>Select a run first.</p>}<a href="https://clickhouse.com/docs" target="_blank" rel="noreferrer">ClickHouse documentation (external fallback)</a><p className="muted">Server-matched documentation search and operator-level profiles are not yet implemented.</p></div>}
 </aside>}
 </div>
 <Dialog open={palette} onOpenChange={setPalette}><Dialog.Content title="Commands and Quick Open" description="Every listed action uses the same execution and review boundaries as its button." showClose><TextField autoFocus aria-label="Search commands" placeholder="Find a command or saved file…" value={paletteSearch} onChange={setPaletteSearch}/><div className="palette-list">{commands.filter(c => c.name.toLowerCase().includes(paletteSearch.toLowerCase())).map(c => <Action key={c.name} type="empty" align="left" onClick={() => { setPalette(false); setPaletteSearch(''); c.run(); }}>{c.name}</Action>)}</div></Dialog.Content></Dialog>
 {confirmation.dialog}</>;
}
