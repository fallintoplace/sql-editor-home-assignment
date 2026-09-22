import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Connection, QueryDocument, Run, RunEvent, Schema, Script, Published } from '../shared/types';
import { formatSql, parameterNames, quoteIdentifier, selectedStatement, splitSql, insertChildFilter } from '../shared/sql';
import { api, download, message, post } from './api';
import { Action, Callout, HelpTip, Select, TextField, useConfirmation } from './ui';
import { checkpoint, closeDraft, MAX_TABS, newDraft, recover, reopenDraft, type Draft, type WorkspaceState } from './workspace-state';
import { useWorkspacePersistence } from './useWorkspacePersistence';
import { publicationIssue } from '../shared/evidence';
import { SqlEditor, type EditorHandle } from './components/SqlEditor';
import { ResultPane } from './components/ResultPane';
import { AssistantPanel } from './components/AssistantPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { ImportPanel } from './components/ImportPanel';
import { AutomationPanel } from './components/AutomationPanel';
import { CommandPalette, type Command } from './components/CommandPalette';
import { executionLimitIssue, executionLimits, rememberRunIds, scopedHistory } from '../shared/workbench-view';
import { DraftSaveStatus } from './components/DraftSaveStatus';
import { ExecutionLimits } from './components/ExecutionLimits';
import { QueryHistory } from './components/QueryHistory';
import { LocalFilesDialog } from './components/LocalFilesDialog';
import { PerformanceLab, type ProfileResponse } from './components/PerformanceLab';
import { appendLocalDrafts, localDraftBackup } from './local-files';
import type { Copy, ExperienceLevel } from './i18n';
import './workbench-ux.css';
const terminal = (run?: Run) => Boolean(run && ['succeeded', 'truncated', 'failed', 'cancelled', 'timed_out', 'interrupted'].includes(run.status));
type Connected = Connection & {
    trusted: boolean;
};
type Panel = 'assistant' | 'library' | 'import' | 'evidence' | 'monitors';
type ResultDeckView = 'closed' | 'results' | 'history';
type BoardPreset = 'write' | 'analyze' | 'investigate' | 'review' | 'monitor';
const boardPresets: BoardPreset[] = ['write', 'analyze', 'investigate', 'review', 'monitor'];
const learnerExamples: Array<{ name: string; level: string; description: string; sql: string; chart: Draft['chart']; parameters?: Record<string, string> }> = [
    { name: '01 · Daily events.sql', level: 'Beginner', description: 'Create a small time series with numbers() and a date column.', sql: "SELECT\n    toDate('2026-01-01') + number AS day,\n    (number + 1) * 10 AS events\nFROM numbers(7)\nORDER BY day", chart: { kind: 'line', x: 0, ys: [1], title: 'Daily events' } },
    { name: '02 · Group and count.sql', level: 'Beginner', description: 'Group rows into cohorts and count the values in each bucket.', sql: 'SELECT\n    number % 3 AS cohort,\n    count() AS users\nFROM numbers(90)\nGROUP BY cohort\nORDER BY cohort', chart: { kind: 'bar', x: 0, ys: [1], title: 'Users by cohort' } },
    { name: '03 · Query parameter.sql', level: 'Intermediate', description: 'Use a typed parameter so the same query can answer different windows.', sql: 'WITH {days:UInt32} AS days\nSELECT\n    number AS day,\n    number * 4 AS events\nFROM numbers(days)\nORDER BY day', chart: { kind: 'line', x: 0, ys: [1], title: 'Parameterized events' }, parameters: { days: '7' } },
    { name: '04 · Explore system tables.sql', level: 'Beginner', description: 'Inspect visible ClickHouse tables and their engines.', sql: 'SELECT\n    database,\n    name,\n    engine\nFROM system.tables\nORDER BY database, name\nLIMIT 20', chart: { kind: 'table', x: 0, ys: [], title: 'Visible tables' } },
    { name: '05 · Explain a query.sql', level: 'Intermediate', description: 'Inspect the plan before running a bounded read-only query.', sql: "EXPLAIN indexes = 1\nSELECT\n    toDate('2026-01-01') + number AS day\nFROM numbers(14)\nWHERE number % 2 = 0\nORDER BY day", chart: { kind: 'table', x: 0, ys: [], title: 'Query plan' } },
];
export function Workspace({ connection, dark, experience, refresh, copy }: {
    connection: Connected;
    dark: boolean;
    experience: ExperienceLevel;
    refresh: () => Promise<unknown>;
    copy: Copy;
}) {
    const key = `cathedral:local-owner:${connection.id}:v1`, [state, setState] = useState<WorkspaceState>(() => recover(key)), stateRef = useRef(state);
    stateRef.current = state;
    const active = state.tabs.find(t => t.id === state.activeId) ?? state.tabs[0]!, editor = useRef<EditorHandle>(null), client = useQueryClient(), confirmation = useConfirmation();
    const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), latch = useRef(false), [search, setSearch] = useState(''), [panel, setPanel] = useState<Panel | null>(null), [palette, setPalette] = useState(false), [rowLimit, setRowLimit] = useState(String(connection.limits.rows)), [timeLimit, setTimeLimit] = useState(String(connection.limits.seconds)), [allHistory, setAllHistory] = useState(false), [link, setLink] = useState('');
    const [filesVisible, setFilesVisible] = useState(true), [filesCompact, setFilesCompact] = useState(true), [focusMode, setFocusMode] = useState(false), [resultDeck, setResultDeck] = useState<ResultDeckView>(active.activeRunId ? 'results' : 'closed'), [boardPreset, setBoardPreset] = useState<BoardPreset>('write'), [widgetMenu, setWidgetMenu] = useState(false), [examplesOpen, setExamplesOpen] = useState(experience === 'beginner');
    const [eventStreamState, setEventStreamState] = useState<'idle' | 'connecting' | 'healthy' | 'failed'>('idle');
    const [localFilesOpen, setLocalFilesOpen] = useState(false), localFilesOrigin = useRef<HTMLElement | null>(null);
    useEffect(() => { setResultDeck(active.activeRunId ? 'results' : 'closed'); }, [active.id]);
    const openLocalFiles = () => { localFilesOrigin.current = document.activeElement as HTMLElement | null; setLocalFilesOpen(true); };
    const exportLocalDrafts = () => download('query-studio-local-drafts.json', localDraftBackup(stateRef.current, connection));
    const importLocalDrafts = (drafts: Draft[]) => {
        if (latch.current) throw new Error('Wait for the current action before opening drafts.');
        const next = appendLocalDrafts(stateRef.current, drafts);
        stateRef.current = next; setState(next);
        setNotice(`Opened ${drafts.length} local draft${drafts.length === 1 ? '' : 's'} on ${connection.name}. Review the SQL and parameters before running. No query was executed.`);
    };
    const limitsPanel = useRef<HTMLDivElement>(null);
    const [savingDraftId, setSavingDraftId] = useState<string>();
    const limitIssue = executionLimitIssue(rowLimit, 'rows') ?? executionLimitIssue(timeLimit, 'seconds');
    const paletteOrigin = useRef<HTMLElement | null>(null), saveShortcut = useRef<() => void>(() => {});
    const openPalette = () => { paletteOrigin.current = document.activeElement as HTMLElement | null; setPalette(true); };
    const showPanel = (next: Panel) => { setFocusMode(false); setWidgetMenu(false); setExamplesOpen(false); setPanel(next); };
    const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    const openResults = (view: Exclude<ResultDeckView, 'closed'>) => { setResultDeck(view); window.setTimeout(() => jumpTo(view === 'history' ? 'query-history' : 'query-results-deck'), 0); };
    const selectBoard = (next: BoardPreset) => { setBoardPreset(next); setWidgetMenu(false); if (next === 'write') { setResultDeck('closed'); setPanel(null); } else if (next === 'investigate') { setResultDeck('history'); setPanel('evidence'); } else if (next === 'monitor') { setResultDeck('history'); setPanel('monitors'); } else if (next === 'review') { setResultDeck('results'); setPanel('assistant'); } else { setResultDeck('results'); setPanel(null); } };
    const visibleBoardPresets = experience === 'beginner' ? boardPresets.filter(preset => preset === 'write' || preset === 'analyze') : boardPresets;
    useEffect(() => { if (experience === 'beginner' && !visibleBoardPresets.includes(boardPreset))
        selectBoard('write'); }, [experience, boardPreset]);
    useEffect(() => { setExamplesOpen(experience === 'beginner'); }, [experience]);
    const update = useCallback((id: string, change: (d: Draft) => Draft) => setState(s => ({ ...s, tabs: s.tabs.map(d => d.id === id ? change(d) : d) })), []);
    const patch = (values: Partial<Draft>) => update(active.id, d => ({ ...d, ...values }));
    const storageError = useWorkspacePersistence(key, state);
    const schema = useQuery({ queryKey: ['schema', connection.id], queryFn: ({ signal }) => api<Schema>(`/connections/${connection.id}/schema`, { signal }), enabled: connection.trusted, retry: false });
    const documents = useQuery({ queryKey: ['documents', connection.id], queryFn: () => api<QueryDocument[]>(`/documents?trash=true&connectionId=${encodeURIComponent(connection.id)}`), retry: false });
    const history = useQuery({ queryKey: ['runs', connection.id], queryFn: () => api<Run[]>(`/runs?connectionId=${encodeURIComponent(connection.id)}`), refetchInterval: 15000, refetchOnWindowFocus: true, retry: false });
    const run = useQuery({ queryKey: ['run', connection.id, active.activeRunId], queryFn: async ({ signal }) => { const value = await api<Run>(`/runs/${active.activeRunId}`, { signal }); if (value.connectionId !== connection.id)
            throw new Error('This saved run belongs to another connection.'); return value; }, enabled: Boolean(active.activeRunId), refetchInterval: q => terminal(q.state.data) ? false : eventStreamState === 'healthy' ? false : 1500, retry: false,
        structuralSharing: (old: unknown, incoming: unknown) => { const previous = old as Run | undefined, next = incoming as Run; return previous && next && previous.sequence > next.sequence ? previous : next; } });
    const script = useQuery({ queryKey: ['script', connection.id, active.scriptId], queryFn: () => api<Script>(`/scripts/${active.scriptId}`), enabled: Boolean(active.scriptId), refetchInterval: q => q.state.data?.status === 'running' ? 800 : false, retry: false });
    const activeRunTerminal = terminal(run.data);
    useEffect(() => { const id = active.activeRunId; if (!id || activeRunTerminal) {
        setEventStreamState('idle');
        return;
    }
        setEventStreamState('connecting');
        const source = new EventSource(`/api/runs/${id}/events`);
        source.onopen = () => setEventStreamState('healthy');
        source.onerror = () => setEventStreamState('failed');
        source.onmessage = event => { try {
        const data = JSON.parse(event.data) as RunEvent;
        if (data.run.id !== id || data.run.connectionId !== connection.id)
            return;
        client.setQueryData<Run>(['run', connection.id, id], old => !old || old.sequence <= data.sequence ? data.run : old);
        if (terminal(data.run)) {
            source.close();
            setEventStreamState('idle');
            void client.invalidateQueries({ queryKey: ['runs', connection.id] });
        }
    }
    catch {
        setEventStreamState('failed');
        source.close();
    } }; return () => { source.close(); setEventStreamState('idle'); }; }, [active.activeRunId, activeRunTerminal, connection.id, client]);
    useEffect(() => {
        if (!active.scriptId || script.data?.id !== active.scriptId || script.data.connectionId !== connection.id) return;
        const ids = script.data.statements.flatMap(statement => statement.runId ? [statement.runId] : []);
        const remembered = rememberRunIds(active.runIds, ids);
        if (remembered !== active.runIds || (!active.activeRunId && ids.length)) {
            update(active.id, draft => ({ ...draft, runIds: rememberRunIds(draft.runIds, ids), activeRunId: draft.activeRunId ?? ids[0] }));
        }
    }, [script.data, connection.id, active.id, active.activeRunId, active.scriptId, active.runIds, update]);
    const visibleDocuments = (documents.data ?? []).filter(d => d.connectionId === connection.id);
    const visibleHistory = useMemo(() => scopedHistory(history.data ?? [], {
        connectionId: connection.id, documentId: active.serverId, allFiles: allHistory,
        runIds: [...active.runIds, ...(script.data?.statements.flatMap(statement => statement.runId ? [statement.runId] : []) ?? [])],
    }), [history.data, connection.id, active.serverId, active.runIds, script.data, allHistory]);
    const deferredSearch = useDeferredValue(search), searchText = deferredSearch.trim().toLowerCase();
    const matchingDocuments = visibleDocuments.filter(d => !d.deletedAt && d.name.toLowerCase().includes(searchText));
    const schemaIndex = useMemo(() => {
        const columnsByTable = new Map<string, Schema['columns']>(), searchableByTable = new Map<string, string>();
        for (const column of schema.data?.columns ?? []) {
            const key = `${column.database}\u0000${column.table}`;
            const columns = columnsByTable.get(key) ?? [];
            columns.push(column);
            columnsByTable.set(key, columns);
        }
        for (const table of schema.data?.tables ?? []) {
            const key = `${table.database}\u0000${table.name}`;
            const columns = columnsByTable.get(key) ?? [];
            searchableByTable.set(key, `${table.database}.${table.name} ${table.engine} ${columns.map(column => `${column.name} ${column.type}`).join(' ')}`.toLowerCase());
        }
        return { columnsByTable, searchableByTable };
    }, [schema.data]);
    const matchingTables = (schema.data?.tables ?? []).filter(t => schemaIndex.searchableByTable.get(`${t.database}\u0000${t.name}`)?.includes(searchText));
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
    const addDraft = (draft: Draft) => { if (stateRef.current.tabs.length >= MAX_TABS) {
        setError('At most 30 local tabs are supported. Close a tab, or save and export work before creating more.');
        return;
    } setState(s => ({ ...s, tabs: [...s.tabs, draft], activeId: draft.id })); };
    const openLearnerExample = (example: typeof learnerExamples[number]) => { addDraft({ ...newDraft(example.name, example.sql), parameters: example.parameters ?? {}, chart: example.chart }); setExamplesOpen(false); selectBoard('write'); setNotice(`${example.name} opened as a local draft. Review it, then press Run when you are ready.`); };
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
        // Keyboard and palette actions must use the same validation as the visible controls.
        if (limitIssue) {
            limitsPanel.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
            throw new Error(limitIssue);
        }
        const checkedLimits = executionLimits(rowLimit, timeLimit);
        const selection = editor.current?.selection() ?? { from: active.from, to: active.to }, statement = wholeScript ? undefined : selectedStatement(active.sql, selection.from, selection.to);
        if (!wholeScript && !statement)
            throw new Error('Select or write a SQL statement first.');
        const target = active.id, payload = { clientRequestId: crypto.randomUUID(), connectionId: connection.id, documentId: active.serverId, sql: wholeScript ? active.sql : statement!.sql, parameters: active.parameters, parentRunId: active.parentRunId, kind, limits: checkedLimits, tags: { workspace: 'local', ...(active.serverId ? { artifact: active.serverId } : {}) } };
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
        setResultDeck('results');
        await history.refetch();
        if (stateRef.current.activeId === target)
            editor.current?.focus();
    });
    const saveDraft = async (draft: Draft): Promise<QueryDocument> => {
        setSavingDraftId(draft.id);
        try {
            const payload = { name: draft.name, sql: draft.sql, connectionId: connection.id, baseRevision: draft.baseRevision, parameters: draft.parameters, chart: draft.chart, runId: draft.activeRunId, parentDocumentId: draft.parentDocumentId, kind: draft.kind, metric: draft.metric, dependencies: draft.dependencies };
            const saved = await api<QueryDocument>(draft.serverId ? `/documents/${draft.serverId}` : '/documents', { method: draft.serverId ? 'PUT' : 'POST', body: payload });
            // Record the response as the baseline, not the draft that may have changed in flight.
            client.setQueryData<QueryDocument[]>(['documents', connection.id], previous => [saved, ...(previous ?? []).filter(document => document.id !== saved.id)]);
            update(draft.id, d => ({ ...d, serverId: saved.id, baseRevision: saved.revision }));
            await documents.refetch();
            setNotice(`Saved ${saved.name} as revision ${saved.revision}.`);
            return saved;
        } finally {
            setSavingDraftId(undefined);
        }
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
        const issue = publicationIssue(run.data, { ...active, connectionId: connection.id });
        if (issue) throw new Error(issue);
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
    const unavailable = busy ? 'Another action is in progress.' : !connection.trusted ? 'Trust this connection before running SQL.' : limitIssue ?? (!parsed.statements.length ? 'Write a SQL statement first.' : undefined);
    const commands: Command[] = [
        { id: 'run', name: 'Run selected or current statement · Ctrl/⌘ Enter', disabledReason: unavailable, run: () => void execute() },
        { id: 'script', name: 'Run script · Ctrl/⌘ Shift Enter', disabledReason: unavailable, run: () => void execute(true) },
        { id: 'save', name: 'Save named revision · Ctrl/⌘ S', disabledReason: busy ? 'Another action is in progress.' : undefined, run: () => void perform(async () => { await saveDraft(active); }) },
        { id: 'explain', name: 'Explain selected statement', disabledReason: unavailable ?? (!connection.manifest?.explain.available ? 'EXPLAIN is unavailable on this connection.' : undefined), run: () => void execute(false, 'explain') },
        { id: 'pipeline', name: 'Inspect pipeline', disabledReason: unavailable ?? (!connection.manifest?.pipeline.available ? 'Pipeline inspection is unavailable on this connection.' : undefined), run: () => void execute(false, 'pipeline') },
        { id: 'format', name: 'Format SQL', run: () => patch({ sql: formatSql(active.sql) }) },
        { id: 'branch', name: 'Create isolated experiment', disabledReason: state.tabs.length >= MAX_TABS ? 'Close a tab before creating another.' : undefined, run: branch },
        { id: 'assistant', name: 'Ask Data / review SQL', run: () => showPanel('assistant') },
        { id: 'library', name: 'Local history and revisions', run: () => showPanel('library') },
        { id: 'import', name: 'Preview CSV / JSON import', run: () => showPanel('import') },
        { id: 'publish', name: 'Publish evidence snapshot', disabledReason: busy ? 'Another action is in progress.' : publicationIssue(run.data, { ...active, connectionId: connection.id }), run: () => void publish() },
        { id: 'new', name: 'New SQL tab', disabledReason: state.tabs.length >= MAX_TABS ? 'Close a tab before creating another.' : undefined, run: () => addDraft(newDraft()) },
        { id: 'reopen', name: 'Reopen closed SQL tab', disabledReason: !state.closedTabs?.length ? 'No recently closed tabs.' : state.tabs.length >= MAX_TABS ? 'Close a tab before reopening another.' : undefined, run: () => setState(reopenDraft) },
        { id: 'open-local', name: 'Open SQL files or restore local draft backup', disabledReason: busy ? 'Another action is in progress.' : undefined, run: openLocalFiles },
        { id: 'export-local', name: 'Export local drafts backup', run: exportLocalDrafts },
        { id: 'focus', name: focusMode ? 'Exit focus mode' : 'Focus mode: hide side panels', run: () => setFocusMode(value => !value) },
        ...visibleDocuments.filter(d => !d.deletedAt).map(d => ({ id: `document-${d.id}`, name: `Open ${d.name}`, run: () => openDocument(d) })),
    ];
    saveShortcut.current = () => void perform(async () => { await saveDraft(active); });
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || !(event.ctrlKey || event.metaKey)) return;
            const target = event.target instanceof Element ? event.target : undefined;
            if (target?.closest('[role="dialog"]')) return;
            const key = event.key.toLowerCase();
            if (key === 'k' || key === 'p') {
                event.preventDefault();
                openPalette();
            } else if (key === 's' && target?.closest('.editor-column')) {
                event.preventDefault();
                saveShortcut.current();
            }
        };
        document.addEventListener('keydown', keydown);
        return () => document.removeEventListener('keydown', keydown);
    }, []);
    const profile = useQuery({ queryKey: ['profile', connection.id, active.activeRunId], queryFn: () => api<ProfileResponse>(`/runs/${active.activeRunId}/profile`), enabled: false, retry: false });
    return <div className="workbench-screen" data-experience={experience}><header className="workbench-topbar"><div className="workbench-topbar-title"><span className="eyebrow">{copy.app.name}</span><strong title={active.name}>{active.name}</strong><span className="workbench-topbar-subtitle">{connection.name}</span></div><nav className="workbench-nav" aria-label={copy.workspace.view}><Action type="empty" aria-pressed={filesVisible && !focusMode} onClick={() => { setFocusMode(false); setFilesVisible(true); setFilesCompact(false); }}>{copy.workspace.title}</Action><Action type="empty" onClick={() => { setFocusMode(false); setFilesVisible(true); setFilesCompact(false); setSearch(''); }}>{copy.workspace.schema}</Action><Action type="empty" aria-pressed={resultDeck === 'results'} onClick={() => openResults('results')}>{copy.workspace.results}</Action><Action type="empty" aria-pressed={resultDeck === 'history'} onClick={() => openResults('history')}>{copy.workspace.history}</Action><Action type="empty" aria-pressed={panel === 'assistant'} onClick={() => showPanel('assistant')}>{copy.panels.assistant}</Action><Action type="empty" aria-pressed={panel === 'evidence'} onClick={() => showPanel('evidence')}>{copy.panels.evidence}</Action></nav><div className="workbench-topbar-facts"><span className={`connection-state ${connection.trusted ? 'is-ready' : 'is-blocked'}`}>{connection.trusted ? copy.connection.readOnly : copy.connection.trust}</span><HelpTip>{copy.help.trustConnection}</HelpTip><span>{parsed.statements.length} {copy.workspace.statementCount}</span><Action onClick={openPalette} aria-keyshortcuts="Control+k Meta+k">{copy.connection.commands}</Action></div></header><section className="workbench-connection-strip"><div className={`workspace-banner ${connection.trusted ? 'is-trusted' : 'needs-trust'}`}><div><strong>{connection.name}</strong><span className="muted">{connection.host} · {connection.database} · {connection.username} · {copy.connection.readOnly}</span></div><div className="toolbar"><Action disabled={busy} onClick={() => void perform(async () => { await post(`/connections/${connection.id}/test`); await refresh(); setNotice(copy.connection.testCompleted); })}>{copy.connection.test}</Action><Action disabled={busy} type={connection.trusted ? 'secondary' : 'primary'} onClick={() => void perform(async () => { if (await confirmation.ask(connection.trusted ? copy.connection.revokeTrust : copy.connection.trust, `${connection.host} · database ${connection.database} · identity ${connection.username}. ${connection.trusted ? copy.connection.activeQueriesCancelled : copy.connection.trustDescription}`, connection.id)) {
        await post(`/connections/${connection.id}/trust`, { trusted: !connection.trusted, confirmation: connection.id });
        await refresh();
    } })}>{connection.trusted ? copy.connection.revokeTrust : copy.connection.trust}</Action></div></div>
 {!connection.trusted && <Callout>{copy.connection.reviewBeforeTrust}</Callout>}
 {state.recoveryWarning && <Callout danger>{state.recoveryWarning}</Callout>}{storageError && <Callout danger>{storageError}<Action onClick={exportLocalDrafts} title="Backup contains SQL and parameter values. Store it privately.">Export local drafts</Action></Callout>}{error && <Callout danger>{error}<Action type="empty" onClick={() => setError('')}>Dismiss</Action></Callout>}{notice && <p className="notice" role="status">{notice}</p>}
 {link && <div className="toolbar"><TextField label="Read-only share link" value={link} readOnly onChange={() => { }}/><Action onClick={() => void navigator.clipboard.writeText(link).catch(e => setError(message(e)))}>Copy link</Action></div>}</section><main className="workbench-stage"><section className={`board-canvas board-${boardPreset}`} aria-label={copy.workspace.board}><header className="board-toolbar"><div className="board-title"><span className="eyebrow">{copy.workspace.board}</span><strong>{copy.workspace[boardPreset]}</strong><HelpTip>{copy.help.boardAnalyze}</HelpTip></div><nav className="board-presets" aria-label={copy.workspace.board}>{visibleBoardPresets.map(preset => <Action key={preset} type={preset === boardPreset ? 'primary' : 'empty'} aria-pressed={preset === boardPreset} onClick={() => selectBoard(preset)}>{copy.workspace[preset]}</Action>)}</nav><div className="board-actions"><div className="widget-menu-wrap"><Action type="empty" aria-expanded={widgetMenu} onClick={() => setWidgetMenu(value => !value)}>{copy.workspace.addWidget}</Action>{widgetMenu && <div className="widget-menu" role="menu">{(['assistant', 'library', 'import', 'evidence', 'monitors'] as Panel[]).map(tool => <Action key={tool} type="empty" role="menuitem" onClick={() => showPanel(tool)}>{copy.panels[tool]}</Action>)}</div>}</div><Action type="empty" onClick={() => selectBoard('write')}>{copy.workspace.resetLayout}</Action></div></header><div className="toolbar workspace-view-controls" role="group" aria-label={copy.workspace.view}><span className="view-controls-label">{copy.workspace.view}</span><nav className="surface-tabs" aria-label={copy.workspace.view}><Action type="primary" onClick={() => jumpTo(`sql-panel-${active.id}`)}>{copy.workspace.editor}</Action><Action disabled={!run.data} aria-pressed={resultDeck === 'results'} onClick={() => openResults('results')}>{copy.workspace.results}</Action><Action aria-pressed={resultDeck === 'history'} onClick={() => openResults('history')}>{copy.workspace.history}</Action></nav><Action aria-expanded={filesVisible && !focusMode} aria-controls="workspace-files" onClick={() => { if (focusMode) { setFocusMode(false); setFilesVisible(true); } else { setFilesVisible(value => !value); setFilesCompact(false); } }}>{filesVisible && !focusMode ? copy.workspace.hideFiles : copy.workspace.showFiles}</Action>{filesVisible && !focusMode && <Action className="rail-toggle" aria-label={copy.workspace.title} aria-pressed={filesCompact} title={copy.workspace.title} onClick={() => setFilesCompact(value => !value)}>◧</Action>}<Action aria-pressed={focusMode} onClick={() => setFocusMode(value => !value)}>{focusMode ? copy.workspace.exitFocusMode : copy.workspace.focusMode}</Action>{focusMode && <span className="muted">{copy.workspace.sidePanelsHidden}</span>}</div>
 <div className="learner-launcher-bar"><div><span className="eyebrow">{copy.workspace.examples}</span><span className="muted">{copy.workspace.examplesDescription}</span><HelpTip>{copy.help.examples}</HelpTip></div><Action type={examplesOpen ? 'primary' : 'empty'} aria-expanded={examplesOpen} onClick={() => { setExamplesOpen(value => !value); setPanel(null); }}>{examplesOpen ? copy.workspace.closeExamples : copy.workspace.openExample}</Action></div>
 {examplesOpen && <section className="example-launcher" role="dialog" aria-label={copy.workspace.examples}><header className="example-launcher-header"><div><span className="eyebrow">{copy.workspace.examples}</span><h2>{copy.workspace.examplesDescription}</h2></div><Action type="empty" aria-label={copy.workspace.closeExamples} onClick={() => setExamplesOpen(false)}>×</Action></header><div className="example-grid">{learnerExamples.map(example => <article className="example-card" key={example.name}><div className="example-card-heading"><span className="example-level">{example.level}</span><strong>{example.name}</strong></div><p>{example.description}</p><pre>{example.sql}</pre><Action type="primary" onClick={() => openLearnerExample(example)}>{copy.workspace.openExample}</Action></article>)}</div></section>}
 <div className="studio-context" role="group" aria-label={copy.workspace.currentFile}><div className="studio-context-file"><span className="eyebrow">{copy.workspace.currentFile}</span><strong title={active.name}>{active.name}</strong></div><div className="studio-context-facts"><span>{parsed.statements.length} {copy.workspace.statementCount}</span><span className={`connection-state ${connection.trusted ? 'is-ready' : 'is-blocked'}`}>{connection.trusted ? copy.connection.readOnly : copy.connection.trust}</span></div><Action onClick={openPalette} aria-keyshortcuts="Control+k Meta+k">{copy.connection.commands}</Action></div>
 <div className={['workspace-grid', (!panel || focusMode) && 'drawer-closed', (!filesVisible || focusMode) && 'sidebar-closed', filesCompact && filesVisible && !focusMode && 'sidebar-compact'].filter(Boolean).join(' ')}><aside id="workspace-files" className={`sidebar stack ${filesCompact ? 'sidebar-compact' : ''}`} aria-label={copy.workspace.title} hidden={!filesVisible || focusMode}><h2>{copy.workspace.title}</h2><Action data-rail-icon="+" onClick={() => addDraft(newDraft())}>{copy.workspace.newTab}</Action><Action data-rail-icon="↥" onClick={openLocalFiles}>{copy.workspace.importBackup}</Action><div className="sidebar-search"><TextField aria-label={copy.workspace.searchPlaceholder} placeholder={copy.workspace.searchPlaceholder} value={search} onChange={setSearch}/></div><details className="nav-section" open><summary data-rail-icon="▤">{copy.workspace.savedFiles}</summary>{matchingDocuments.map(d => <Action type="empty" align="left" key={d.id} onClick={() => openDocument(d)}>{d.name} <small>r{d.revision}{d.verifiedRevision ? ' · self-reviewed' : ''}</small></Action>)}
 {documents.isFetching && <p role="status">Loading saved files…</p>}{documents.error && <Callout danger>{message(documents.error)}</Callout>}{!documents.isFetching && !documents.error && !matchingDocuments.length && <p className="muted">{searchText ? 'No saved files match this search.' : 'No saved files yet. Save a revision to add one here.'}</p>}</details>
 <details className="nav-section"><summary data-rail-icon="◇">{copy.workspace.schema}</summary>{schema.isFetching && <p role="status">Loading schema…</p>}{schema.error && <Callout danger>{message(schema.error)}</Callout>}<Action disabled={!connection.trusted} onClick={() => void schema.refetch()}>{copy.workspace.refreshSchema}</Action>
 {matchingTables.map(t => <details key={`${t.database}.${t.name}`}><summary>{t.database}.{t.name}</summary><Action type="empty" onClick={() => editor.current?.insert(`${quoteIdentifier(t.database)}.${quoteIdentifier(t.name)}`)}>Insert table</Action>{(schemaIndex.columnsByTable.get(`${t.database}\u0000${t.name}`) ?? []).map(c => <Action type="empty" align="left" key={c.name} title={`${c.type} · ${c.comment}`} onClick={() => editor.current?.insert(quoteIdentifier(c.name))}>{c.name}<small>{c.type}</small></Action>)}</details>)}
 {schema.data && !schema.isFetching && !matchingTables.length && <p className="muted">{searchText ? 'No tables or columns match this search.' : 'No tables are visible to this connection.'}</p>}
 {schema.data?.warnings.map((warning, i) => <p className="muted" key={i}>{warning}</p>)}</details><details className="nav-section" open><summary data-rail-icon="≡">{copy.workspace.statementOutline}</summary>{parsed.statements.map((s, i) => <Action key={s.from} type="empty" onClick={() => { patch({ from: s.from, to: s.to }); editor.current?.focus(); }}>Statement {i + 1} · {s.sql.slice(0, 32)}</Action>)}
 </details><Action data-rail-icon="⇩" onClick={exportLocalDrafts} title="Backup contains SQL and parameter values.">{copy.workspace.exportDrafts}</Action></aside>
 <main className="editor-column workspace-main"><div className="tabs" role="tablist" aria-label="SQL documents" onKeyDown={e => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
        return; e.preventDefault(); const index = state.tabs.findIndex(d => d.id === active.id), next = e.key === 'Home' ? 0 : e.key === 'End' ? state.tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + state.tabs.length) % state.tabs.length; setState(s => ({ ...s, activeId: s.tabs[next]!.id })); const tab = e.currentTarget.querySelectorAll<HTMLElement>('[role=tab]')[next]; tab?.focus(); tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }}>{state.tabs.map(d => <Action key={d.id} type={d.id === active.id ? 'primary' : 'empty'} role="tab" id={`sql-tab-${d.id}`} aria-controls={`sql-panel-${d.id}`} title={d.name} aria-selected={d.id === active.id} tabIndex={d.id === active.id ? 0 : -1} onClick={() => setState(s => ({ ...s, activeId: d.id }))}>{d.name}</Action>)}</div>
 <div className="toolbar wrap editor-tab-actions" aria-label="Tab actions"><Action disabled={busy} onClick={openLocalFiles}>{copy.workspace.openLocalFiles}</Action><Action disabled={busy} onClick={() => {
        setState(s => closeDraft(s, active.id));
        setNotice('Tab closed locally. Reopen closed tab restores it. The last 10 closed tabs are retained; server revisions and query history are unchanged.');
    }}>{copy.workspace.closeTab}</Action><Action disabled={busy || !(state.closedTabs?.length) || state.tabs.length >= MAX_TABS} onClick={() => setState(reopenDraft)}>{copy.workspace.reopenTab}</Action></div>
 <div className="editor-header"><TextField aria-label="SQL document name" value={active.name} onChange={name => patch({ name })}/><DraftSaveStatus draft={active} connectionId={connection.id} saved={visibleDocuments.find(document => document.id === active.serverId)} saving={savingDraftId === active.id} pending={documents.isFetching} readError={Boolean(documents.error)} onRetry={() => void documents.refetch()} onCompare={() => showPanel('library')}/></div>
 <div className="toolbar wrap editor-actions"><Action type="primary" disabled={busy || !connection.trusted || Boolean(limitIssue)} title={limitIssue || copy.help.runStatement} onClick={() => void execute()}>{copy.editor.runStatement}</Action><Action disabled={busy || !connection.trusted || Boolean(limitIssue)} title={limitIssue || copy.help.runScript} onClick={() => void execute(true)}>{copy.editor.runScript}</Action><Action disabled={busy || !run.data || terminal(run.data)} onClick={() => void perform(async () => { await post(`/runs/${active.activeRunId}/cancel`); await run.refetch(); })}>{copy.editor.cancelRun}</Action>{script.data?.status === 'running' && <Action onClick={() => void perform(async () => { await post(`/scripts/${active.scriptId}/cancel`); await script.refetch(); })}>{copy.editor.cancelScript}</Action>}<Action disabled={busy} title="Save named revision (Ctrl/⌘ S)" aria-keyshortcuts="Control+s Meta+s" onClick={() => void perform(async () => { await saveDraft(active); })}>{copy.editor.saveRevision}</Action><Action disabled={busy || !active.activeRunId} title={copy.help.publishEvidence} onClick={() => void publish()}>{copy.editor.publish}</Action><Action onClick={branch}>{copy.editor.branch}</Action></div>
 {state.tabs.map(d => <section key={d.id} role="tabpanel" id={`sql-panel-${d.id}`} aria-labelledby={`sql-tab-${d.id}`} hidden={d.id !== active.id}>{d.id === active.id && <SqlEditor key={active.id} ref={editor} value={active.sql} from={active.from} to={active.to} schema={schema.data} dark={dark} error={run.data?.sql === active.sql ? run.data.error : undefined} onChange={sql => update(active.id, d => ({ ...d, sql }))} onSelection={(from, to) => update(active.id, d => ({ ...d, from, to }))} onRun={script => void execute(script)}/>}</section>)}
 {parsed.error && <p className="muted">{copy.editor.statementBoundary}: {parsed.error}</p>}
 <details className="editor-advanced" open={experience === 'expert' || Boolean(limitIssue)}><summary>{copy.workspace.advancedControls} <span className="advanced-summary">{rowLimit} rows · {timeLimit}s deadline</span> <HelpTip>{copy.help.resultLimit}</HelpTip></summary>
 <ExecutionLimits ref={limitsPanel} rows={rowLimit} seconds={timeLimit} defaults={connection.limits} onRows={setRowLimit} onSeconds={setTimeLimit}/>
 <div className="toolbar wrap editor-tools"><Action disabled={busy || !connection.manifest?.explain.available || !connection.trusted || Boolean(limitIssue)} title={limitIssue} onClick={() => void execute(false, 'explain')}>{copy.editor.explain}</Action><Action disabled={busy || !connection.manifest?.pipeline.available || !connection.trusted || Boolean(limitIssue)} title={limitIssue} onClick={() => void execute(false, 'pipeline')}>{copy.editor.pipeline}</Action><Action onClick={() => patch({ sql: formatSql(active.sql) })}>{copy.editor.formatSql}</Action><Action onClick={() => { update(active.id, d => checkpoint(d, 'Before indentation')); editor.current?.indent(); }}>{copy.editor.indent}</Action><Action onClick={() => download(active.name, active.sql, 'application/sql')}>{copy.editor.exportSql}</Action></div>
 <p className="muted">{connection.limits.bytes.toLocaleString()} output bytes · {Math.round(connection.limits.memory / 1048576)} MiB memory · {connection.limits.threads} threads · {connection.manifest?.serverVersion ?? 'Version unknown: test the connection for capabilities'}</p>
 {parsed.parameters.length > 0 && <details><summary>{copy.workspace.parameters} <HelpTip>{copy.help.queryParameters}</HelpTip></summary><div className="parameter-grid">{parsed.parameters.map(p => <TextField key={p.name} label={`${p.name} : ${p.type}`} value={active.parameters[p.name] ?? ''} onChange={value => patch({ parameters: { ...active.parameters, [p.name]: value } })}/>)}</div></details>}
 </details>
 <div className="toolbar wrap panel-switcher" aria-label={copy.panels.tools}>{(['assistant', 'library', 'import', 'evidence', 'monitors'] as Panel[]).map(p => <Action key={p} type={panel === p ? 'primary' : 'secondary'} aria-pressed={panel === p && !focusMode} onClick={() => { if (focusMode) showPanel(p); else setPanel(panel === p ? null : p); }}>{copy.panels[p]}</Action>)}</div>
 <section id="query-results-deck" className={`result-deck result-deck-${resultDeck}`} aria-label={copy.workspace.results}><div className="result-deck-toolbar"><div><span className="eyebrow">{copy.workspace.results}</span>{run.data && <span className={`status ${run.data.status}`}>{run.data.status}</span>}</div><div className="toolbar"><Action aria-pressed={resultDeck === 'results'} onClick={() => setResultDeck('results')}>{copy.workspace.results}</Action><Action aria-pressed={resultDeck === 'history'} onClick={() => setResultDeck('history')}>{copy.workspace.history}</Action><Action type="empty" aria-label={copy.workspace.results} onClick={() => setResultDeck('closed')}>{resultDeck === 'closed' ? '＋' : '−'}</Action></div></div>
 {script.data && <section className="panel-card"><h3>Script: {script.data.status}</h3><p>Stop-on-error is enabled. Every statement has a separate run and query ID.</p><div className="toolbar wrap">{script.data.statements.map((s, i) => <Action key={i} disabled={!s.runId} onClick={() => patch({ activeRunId: s.runId })}>Statement {i + 1}: {s.status}</Action>)}</div></section>}
 {run.data && <ResultPane key={run.data.id} run={run.data} draftSql={active.sql} draftParameters={active.parameters} config={active.chart} copy={copy} onChart={chart => patch({ chart })} onChild={child}/>} {!active.activeRunId && <div className="empty-state"><h2>{copy.editor.yourSql}</h2><p>{copy.editor.emptyHint}</p></div>}
 {run.error && <Callout danger>{message(run.error)}</Callout>}{script.error && <Callout danger>{message(script.error)}</Callout>}
 <QueryHistory key={active.id} runs={visibleHistory} selectedRunId={active.activeRunId} allFiles={allHistory} fetching={history.isFetching} error={history.error ? message(history.error) : undefined} busy={busy}
     onToggleScope={() => setAllHistory(value => !value)} onRetry={() => void history.refetch()}
     onOpen={selected => patch({ activeRunId: selected.id })}
     onChild={selected => addDraft({ ...newDraft('History copy.sql', selected.sql), parameters: selected.parameters, parentRunId: selected.id })}
     onCancel={selected => void perform(async () => { await post(`/runs/${selected.id}/cancel`); await history.refetch(); })}/></section>
 </main>
 {panel && <aside className="drawer inspector-drawer" aria-label={copy.panels.inspector} hidden={focusMode}><div className="toolbar spread"><div className="inspector-heading"><span className="eyebrow">{copy.panels.workflow}</span><strong title={copy.panels[panel]}>{copy.panels[panel]}</strong></div><Action type="empty" aria-label={copy.panels.close} onClick={() => setPanel(null)}>{copy.panels.close}</Action></div>
 {panel === 'assistant' && <AssistantPanel key={active.id} connectionId={connection.id} sql={active.sql} run={run.data} trusted={connection.trusted} copy={copy} onApply={sql => restore(sql, 'Before accepted AI proposal')}/>}
 {panel === 'library' && <LibraryPanel key={active.id} draft={active} documents={visibleDocuments} onChange={patch} onRestore={restore} onOpen={openDocument}/>}
 {panel === 'import' && <ImportPanel connectionId={connection.id} schema={schema.data} trusted={connection.trusted}/>}
 {panel === 'monitors' && <AutomationPanel connectionId={connection.id} onRun={id => patch({ activeRunId: id })}/>}
 {panel === 'evidence' && <PerformanceLab connectionId={connection.id} run={run.data} runs={visibleHistory} available={Boolean(connection.trusted && connection.manifest?.queryLog.available)} current={profile.data} loading={profile.isFetching} error={profile.error ? message(profile.error) : undefined} onLoad={() => void profile.refetch()}/>}
 </aside>}
 </div></section></main>
 <CommandPalette open={palette} commands={commands} onOpenChange={setPalette} restoreFocus={() => { if (paletteOrigin.current?.isConnected) paletteOrigin.current.focus(); else editor.current?.focus(); }}/>
 <LocalFilesDialog open={localFilesOpen} connectionName={connection.name} openTabs={state.tabs.length} busy={busy} onOpenChange={setLocalFilesOpen} onImport={importLocalDrafts} restoreFocus={() => { if (localFilesOrigin.current?.isConnected) localFilesOrigin.current.focus(); else editor.current?.focus(); }}/>
 {confirmation.dialog}</div>;
}
