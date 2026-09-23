import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { AssistantAction, ProfilePipeline, Proposal, QueryDocument, QueryProfile, Run, Schema, SchemaDictionary, SchemaTable } from '../../shared/types';
import { quoteIdentifier } from '../../shared/sql';
import { AssistantWorkflow } from './AssistantWorkflow';
import { Button, cx, formatBytes, formatCount, Icon, inspectorLabel, Status } from './ui';
import type { IconName } from './ui';
import type { AssistantContext, Connected, Inspector } from '../workspace-types';

export type InspectorPaneProps = {
    inspector: Inspector;
    setInspector: (inspector: Inspector) => void;
    connection: Connected;
    schema?: Schema;
    schemaLoading: boolean;
    schemaError: string;
    search: string;
    setSearch: (search: string) => void;
    tables: Schema['tables'];
    history: Run[];
    documents: QueryDocument[];
    run?: Run;
    profile?: QueryProfile;
    pipeline?: ProfilePipeline;
    onRefreshSchema: () => void;
    onRefreshHistory: () => void;
    onInsert: (value: string) => void;
    onOpenImport: () => void;
    onOpenRun: (run: Run) => void;
    onOpenDocument: (document: QueryDocument) => void;
    onLoadProfile: () => void;
    onLoadPipeline: () => void;
    onOpenGraph: () => void;
    connectionId: string;
    sql: string;
    trusted: boolean;
    runId?: string;
    onRefreshDocuments: () => void;
    assistantAction: AssistantAction;
    onAssistantAction: (action: AssistantAction) => void;
    assistantQuestion: string;
    onAssistantQuestion: (question: string) => void;
    assistantContext?: AssistantContext;
    assistantProposal?: Proposal;
    assistantBusy: boolean;
    assistantError: string;
    includeResult: boolean;
    onIncludeResult: (include: boolean) => void;
    onVoiceInput: () => void;
    voiceListening: boolean;
    voiceError: string;
    onPreview: () => void;
    onRequestProposal: () => void;
    onDecideProposal: (decision: 'accepted' | 'rejected') => void;
    onRunQuery: () => void;
    runDisabled: boolean;
    expert?: boolean;
    drawer?: boolean;
    onClose?: () => void;
};

const inspectorTabs = [
    { id: 'schema', icon: 'schema' },
    { id: 'history', icon: 'history' },
    { id: 'documents', icon: 'documents' },
    { id: 'details', icon: 'details' },
    { id: 'pipeline', icon: 'pipeline' },
    { id: 'assistant', icon: 'assistant' },
] as const satisfies readonly { id: Inspector; icon: IconName }[];

export function InspectorPane({ inspector, setInspector, connection, schema, schemaLoading, schemaError, search, setSearch, tables, history, documents, run, profile, pipeline, onRefreshSchema, onRefreshHistory, onInsert, onOpenImport, onOpenRun, onOpenDocument, onLoadProfile, onLoadPipeline, onOpenGraph, connectionId, sql, trusted, runId, onRefreshDocuments, assistantAction, onAssistantAction, assistantQuestion, onAssistantQuestion, assistantContext, assistantProposal, assistantBusy, assistantError, includeResult, onIncludeResult, onVoiceInput, voiceListening, voiceError, onPreview, onRequestProposal, onDecideProposal, onRunQuery, runDisabled, expert = false, drawer = false, onClose }: InspectorPaneProps) {
    const visibleDocuments = documents.filter(document => document.connectionId === connectionId && !document.deletedAt);
    const closeButton = drawer && <Button variant="ghost" className="icon-only" aria-label="Close inspector" onClick={onClose}><Icon name="close"/></Button>;
    const title = expert && inspector === 'schema' ? 'Tables' : expert && inspector === 'documents' ? 'Queries' : inspectorLabel(inspector);

    return <aside className={cx('inspector-pane', expert && 'is-expert-browser', drawer && 'is-drawer animate-drawer')}>
        <header className="inspector-header"><div><span className="eyebrow">{expert ? 'BROWSE' : 'WORKSPACE INSPECTOR'}</span><h2>{title}</h2></div>{closeButton}</header>
        {expert ? <nav className="inspector-tabs is-browser-tabs" aria-label="Workspace browser">
            <button type="button" aria-label="Tables" aria-pressed={inspector === 'schema'} onClick={() => setInspector('schema')}><Icon name="schema"/><span>Tables</span></button>
            <button type="button" aria-label="Queries" aria-pressed={inspector === 'documents'} onClick={() => setInspector('documents')}><Icon name="documents"/><span>Queries</span></button>
            <InspectorMoreMenu inspector={inspector} onSelect={setInspector} items={inspectorTabs.filter(item => item.id === 'history' || Boolean(run) && (item.id === 'details' || item.id === 'pipeline'))} />
        </nav> : <nav className="inspector-tabs is-browser-tabs" aria-label="Workspace browser">
            <button type="button" aria-label="Tables" aria-pressed={inspector === 'schema'} onClick={() => setInspector('schema')}><Icon name="schema"/><span>Tables</span></button>
            <InspectorMoreMenu inspector={inspector} onSelect={setInspector} items={inspectorTabs.filter(item => item.id === 'history' || item.id === 'documents')} />
        </nav>}
        <div className="inspector-content">
            {inspector === 'schema' && <section className="inspector-section">
                <div className="inspector-search"><Icon name="search"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tables, columns, and dictionaries…" aria-label="Search schema"/><kbd>⌘ F</kbd></div>
                <div className="schema-heading"><span>{tables.length} TABLES</span><div className="flex items-center gap-1.5"><Button variant="ghost" className="toolbar-small" onClick={onOpenImport}>Import data</Button><Button variant="ghost" className="toolbar-small" onClick={onRefreshSchema} disabled={schemaLoading || !trusted}>{schemaLoading ? 'Loading…' : 'Refresh'}</Button></div></div>
                {schemaError && <div className="callout callout-error">{schemaError}</div>}
                {schema?.metadataWarnings?.map(warning => <div className="schema-metadata-warning" key={warning}>{warning}</div>)}
                {!trusted && <div className="inspector-empty"><Icon name="lock"/><strong>Schema is private</strong><p>Trust the connection to inspect tables and columns.</p></div>}
                {schemaLoading && <div className="inspector-empty"><span className="loading-orbit"/><p>Reading ClickHouse schema…</p></div>}
                {trusted && schema && tables.map(table => <details className="schema-table" key={`${table.database}.${table.name}`} open={Boolean(search)}>
                    <summary><span className="table-glyph">▦</span><span className="schema-table-name"><strong>{table.name}</strong><small>{table.database} · {table.engine}</small><small className="schema-table-stats">{tableSummary(table)}</small></span><Icon name="chevron" className="schema-chevron"/></summary>
                    <div className="schema-table-content">
                        <button type="button" className="insert-table-button" onClick={() => onInsert(`${quoteIdentifier(table.database)}.${quoteIdentifier(table.name)}`)}>Insert table name <span>↵</span></button>
                        <TableMetadata table={table}/>
                        <div className="schema-columns">{schema.columns.filter(column => column.database === table.database && column.table === table.name && (!search || `${column.name} ${column.type}`.toLowerCase().includes(search.toLowerCase()))).map(column => <button type="button" className="schema-column" key={column.name} title={column.comment || column.type} onClick={() => onInsert(quoteIdentifier(column.name))}><span className="column-type-dot"/><span>{column.name}</span><code>{column.type}</code></button>)}</div>
                    </div>
                </details>)}
                {trusted && schema?.dictionaries !== undefined && <DictionaryList dictionaries={schema.dictionaries} search={search}/>}
                {trusted && schema && !tables.length && !schema.dictionaries?.some(dictionary => !search || `${dictionary.database} ${dictionary.name} ${dictionary.type} ${dictionary.status} ${dictionary.keyColumns} ${dictionary.attributeColumns}`.toLowerCase().includes(search.toLowerCase())) && <div className="inspector-empty">No tables or dictionaries match this search.</div>}
            </section>}
            {inspector === 'history' && <section className="inspector-section"><div className="schema-heading"><span>RECENT RUNS</span><Button variant="ghost" className="toolbar-small" onClick={onRefreshHistory}>↻ Refresh</Button></div>{history.length ? history.slice(0, 30).map(item => <button type="button" className="history-card" key={item.id} onClick={() => onOpenRun(item)}><span className={cx('run-state-mark', `state-${item.status}`)}/><span className="history-card-copy"><strong>{item.sql.replace(/\s+/g, ' ').slice(0, 58)}</strong><small>{new Date(item.createdAt).toLocaleString()} <i>·</i> {Math.round(item.elapsedMs)} ms <i>·</i> {item.rowCount.toLocaleString()} rows</small></span><span className="history-open">↗</span></button>) : <div className="inspector-empty"><Icon name="history"/><strong>No runs yet</strong><p>Your recent ClickHouse executions appear here.</p></div>}</section>}
            {inspector === 'documents' && <section className="inspector-section"><div className="schema-heading"><span>SAVED DOCUMENTS</span><Button variant="ghost" className="toolbar-small" onClick={onRefreshDocuments}>↻ Refresh</Button></div>{visibleDocuments.length ? visibleDocuments.map(document => <button type="button" className="document-card" key={document.id} onClick={() => onOpenDocument(document)}><span className="file-type-icon small">SQL</span><span><strong>{document.name}</strong><small>revision {document.revision} · {new Date(document.updatedAt).toLocaleDateString()}</small></span><span className="history-open">↗</span></button>) : <div className="inspector-empty"><Icon name="documents"/><strong>Nothing saved yet</strong><p>Save the current query to keep a named revision on this connection.</p></div>}</section>}
            {inspector === 'details' && <RunDetails run={run} profile={profile} onLoad={onLoadProfile}/>}
            {inspector === 'pipeline' && <PipelineView run={run} profile={profile} pipeline={pipeline} onLoad={onLoadPipeline} onOpenGraph={onOpenGraph}/>}
            {inspector === 'assistant' && <AssistantWorkflow mode={expert ? 'expert' : 'beginner'} sql={sql} action={assistantAction} onActionChange={onAssistantAction} question={assistantQuestion} onQuestionChange={onAssistantQuestion} context={assistantContext} proposal={assistantProposal} busy={assistantBusy} error={assistantError} trusted={trusted} runId={runId} includeResult={includeResult} onIncludeResult={onIncludeResult} onVoiceInput={onVoiceInput} voiceListening={voiceListening} voiceError={voiceError} onPreview={onPreview} onRequestProposal={onRequestProposal} onDecideProposal={onDecideProposal} onRunQuery={onRunQuery} runDisabled={runDisabled}/>}
        </div>
        <footer className="inspector-footer"><span className="connection-readonly"><Icon name="lock"/> Read only</span><span>{connection.name} <i>·</i> {connection.database}</span></footer>
    </aside>;
}

function tableSummary(table: SchemaTable): string {
    const values = [
        table.rowEstimate == null ? undefined : `${formatCount(table.rowEstimate)} rows est.`,
        table.sizeBytes == null ? undefined : formatBytes(table.sizeBytes),
        table.activeParts == null ? undefined : `${formatCount(table.activeParts)} parts`,
        table.projections === undefined ? undefined : `${table.projections.length} projections`,
        table.skipIndexes === undefined ? undefined : `${table.skipIndexes.length} skip indexes`,
    ].filter((value): value is string => Boolean(value));
    return values.join(' · ') || 'ClickHouse metadata unavailable';
}

function TableMetadata({ table }: { table: SchemaTable }) {
    const stats = [
        table.rowEstimate === undefined ? undefined : { label: 'Row estimate', value: table.rowEstimate === null ? 'Unavailable' : `${formatCount(table.rowEstimate)} rows`, detail: table.rowEstimate ?? undefined },
        table.sizeBytes === undefined ? undefined : { label: 'Reported size', value: table.sizeBytes === null ? 'Unavailable' : formatBytes(table.sizeBytes), detail: table.sizeBytes === null ? undefined : `ClickHouse reports ${table.sizeBytes} bytes. On-disk tables report compressed size; in-memory tables report an approximate memory size.` },
        table.uncompressedBytes === undefined ? undefined : { label: 'Uncompressed size', value: table.uncompressedBytes === null ? 'Unavailable' : formatBytes(table.uncompressedBytes), detail: table.uncompressedBytes ?? undefined },
        table.parts === undefined && table.activeParts === undefined ? undefined : { label: 'Parts', value: `${table.activeParts == null ? '—' : formatCount(table.activeParts)} active · ${table.parts == null ? '—' : formatCount(table.parts)} total`, detail: undefined },
    ].filter((stat): stat is NonNullable<typeof stat> => Boolean(stat));
    const keys = [
        ['ORDER BY', table.orderBy],
        ['PRIMARY KEY', table.primaryKey],
        ['PARTITION BY', table.partitionKey],
        ['SAMPLE BY', table.samplingKey],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    const hasKeyMetadata = table.orderBy !== undefined || table.primaryKey !== undefined || table.partitionKey !== undefined || table.samplingKey !== undefined;
    const skipIndexCount = table.skipIndexes?.length;

    return <div className="schema-table-metadata">
        {stats.length > 0 && <div className="schema-stat-grid">{stats.map(stat => <div className="schema-stat" key={stat.label} title={stat.detail ? `${stat.label}: ${stat.detail}` : undefined}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</div>}
        {(keys.length > 0 || hasKeyMetadata) && <div className="schema-key-list">{keys.length ? keys.map(([label, value]) => <div className="schema-key" key={label}><span>{label}</span><code>{value}</code></div>) : <div className="schema-metadata-empty">No table keys configured</div>}</div>}
        {table.ttlConfigured !== undefined && <div className={cx('schema-ttl', table.ttlConfigured ? 'is-configured' : 'is-empty')}><span>TTL</span><strong>{table.ttlConfigured ? 'Configured' : 'None'}</strong></div>}
        {table.materializedViewTarget && <div className="schema-view-target"><span>WRITES TO</span><code>{table.materializedViewTarget}</code></div>}
        {(table.projections !== undefined || table.skipIndexes !== undefined || table.skipIndexTypes !== undefined) && <div className="schema-index-sections">
            {table.projections !== undefined && <div className="schema-index-group"><div className="schema-index-heading"><span>PROJECTIONS</span><strong>{table.projections.length}</strong></div>{table.projections.length ? table.projections.map(projection => <div className="schema-index-item" key={projection.name}><span><strong>{projection.name}</strong><small>{projection.type}</small></span>{projection.sortingKey && <code>{projection.sortingKey}</code>}</div>) : <small className="schema-metadata-empty">None defined</small>}</div>}
            {(table.skipIndexes !== undefined || table.skipIndexTypes !== undefined) && <div className="schema-index-group"><div className="schema-index-heading"><span>SKIP INDEXES</span><strong>{skipIndexCount ?? table.skipIndexTypes?.length ?? 0}{skipIndexCount === undefined && table.skipIndexTypes !== undefined ? ' types' : ''}</strong></div>{table.skipIndexes?.length ? table.skipIndexes.map(index => <div className="schema-index-item" key={index.name}><span><strong>{index.name}</strong><small>{index.type} · granularity {index.granularity}</small></span><code>{index.expression}</code></div>) : table.skipIndexes ? <small className="schema-metadata-empty">None defined</small> : <small className="schema-metadata-empty">Types: {table.skipIndexTypes?.join(', ') || 'None defined'}</small>}</div>}
        </div>}
    </div>;
}

function DictionaryList({ dictionaries, search }: { dictionaries: SchemaDictionary[]; search: string }) {
    const query = search.trim().toLowerCase();
    const visible = dictionaries.filter(dictionary => !query || `${dictionary.database} ${dictionary.name} ${dictionary.type} ${dictionary.status} ${dictionary.keyColumns} ${dictionary.attributeColumns}`.toLowerCase().includes(query));
    return <div className="schema-dictionary-section">
        <div className="schema-heading"><span>{visible.length} DICTIONARIES</span></div>
        {visible.length ? visible.map(dictionary => <article className="schema-dictionary" key={`${dictionary.database}.${dictionary.name}`}>
            <div className="schema-dictionary-header"><span><strong>{dictionary.name}</strong><small>{dictionary.database || 'Server-level'} · {dictionary.type || 'Dictionary'}</small></span><span className={cx('dictionary-status', dictionary.status === 'LOADED' && 'is-loaded', dictionary.status !== 'LOADED' && 'is-warning')}>{dictionary.status.toLowerCase().replaceAll('_', ' ')}</span></div>
            <div className="schema-dictionary-stats"><span>{dictionary.elementCount ? `${formatCount(dictionary.elementCount)} entries` : 'Entries unavailable'}</span><span>{dictionary.memoryBytes ? formatBytes(dictionary.memoryBytes) : 'Memory unavailable'}</span></div>
            {dictionary.keyColumns && <small className="schema-dictionary-fields"><b>KEY</b> {dictionary.keyColumns}</small>}
            {dictionary.attributeColumns && <small className="schema-dictionary-fields"><b>ATTRIBUTES</b> {dictionary.attributeColumns}</small>}
            {dictionary.lastSuccessfulUpdate && <small className="schema-dictionary-updated">Updated {dictionary.lastSuccessfulUpdate}</small>}
        </article>) : <div className="schema-metadata-empty">{query ? 'No dictionaries match this search.' : 'No dictionaries found.'}</div>}
    </div>;
}

function InspectorMoreMenu({ inspector, onSelect, items }: { inspector: Inspector; onSelect: (inspector: Inspector) => void; items: Array<{ id: Inspector; icon: IconName }> }) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
    const active = items.some(item => item.id === inspector);

    useEffect(() => {
        if (!open) return;
        const closeOutside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setOpen(false);
            trigger.current?.focus();
        };
        const frame = window.requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
        document.addEventListener('pointerdown', closeOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener('pointerdown', closeOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    const moveMenuFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
        if (!items.length) return;
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'ArrowDown' ? (current + 1) % items.length
            : event.key === 'ArrowUp' ? (current - 1 + items.length) % items.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : undefined;
        if (next === undefined) return;
        event.preventDefault();
        items[next]?.focus();
    };

    return <div className="inspector-more" ref={root}>
        <button ref={trigger} type="button" className={cx('inspector-more-trigger', active && 'is-active')} aria-label="More workspace panels" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>More <Icon name="chevron"/></button>
        {open && <div className="inspector-more-menu" role="menu" aria-label="More workspace panels" ref={menu} onKeyDown={moveMenuFocus}>{items.map(item => <button key={item.id} type="button" role="menuitem" aria-pressed={inspector === item.id} onClick={() => { onSelect(item.id); setOpen(false); }}><Icon name={item.icon}/><span>{inspectorLabel(item.id)}</span></button>)}</div>}
    </div>;
}

function RunDetails({ run, profile, onLoad }: { run?: Run; profile?: QueryProfile; onLoad: () => void }) {
    if (!run) return <div className="inspector-empty">Run a query to see execution details.</div>;
    const summary = profile?.summary;
    const items: Array<[string, string]> = [['Query ID', run.queryId], ['Duration', `${Math.round(summary?.durationMs ?? run.elapsedMs)} ms`], ['Rows read', summary?.readRows ? Number(summary.readRows).toLocaleString() : '—'], ['Bytes read', summary?.readBytes ? formatBytes(summary.readBytes) : '—'], ['Memory', summary?.memory ? formatBytes(summary.memory) : '—'], ['Rows returned', run.rowCount.toLocaleString()], ['Executed as', run.executedAs], ['Server', run.serverVersion ?? '—']];
    return <section className="inspector-section"><div className="run-detail-hero"><span className="eyebrow">LATEST EXECUTION</span><Status run={run}/><strong>{run.queryId}</strong><small>{new Date(run.createdAt).toLocaleString()}</small></div><div className="run-fact-list">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong>{label === 'Query ID' && <button title="Copy query ID" onClick={() => void navigator.clipboard.writeText(value)}><Icon name="copy"/></button>}</div>)}</div>{run.error && <div className="callout callout-error">{run.error.code}: {run.error.message}</div>}<Button variant="secondary" className="w-full mt-4" onClick={onLoad}>Load query log evidence</Button>{profile?.notice && <p className="profile-note">{profile.notice}</p>}</section>;
}

function PipelineView({ run, profile, pipeline, onLoad, onOpenGraph }: { run?: Run; profile?: QueryProfile; pipeline?: ProfilePipeline; onLoad: () => void; onOpenGraph: () => void }) {
    if (!run) return <div className="inspector-empty">Run a query to inspect its execution pipeline.</div>;
    const stages = pipeline?.nodes ?? profile?.pipeline.nodes ?? [];
    return <section className="inspector-section"><div className="schema-heading"><span>EXECUTION PIPELINE</span><Button variant="ghost" className="toolbar-small" onClick={onLoad}>Load evidence</Button></div>{pipeline?.notice && <p className="profile-note">{pipeline.notice}</p>}{stages.length ? <><Button variant="secondary" className="w-full" onClick={onOpenGraph}>Open operator graph in Insights</Button><div className="pipeline-list">{stages.map((stage, index) => <article className={`pipeline-stage stage-${stage.status}`} key={stage.id}><span className="pipeline-stage-index">{String(index + 1).padStart(2, '0')}</span><span className="pipeline-connector"/><span className="pipeline-stage-body"><strong>{stage.label}</strong><small>{stage.detail ?? stage.kind} · {stage.status}</small><span>{[stage.durationMs === undefined ? '' : `${Math.round(stage.durationMs)} ms`, stage.rows ? `${stage.rows} rows` : '', stage.bytes ? `${stage.bytes} bytes` : ''].filter(Boolean).join(' · ') || 'No stage-level measurements'}</span></span><span className="stage-evidence">{stage.status}</span></article>)}</div></> : <div className="inspector-empty"><Icon name="pipeline"/><strong>Pipeline evidence is not loaded</strong><p>Available ClickHouse versions can return an EXPLAIN PIPELINE graph.</p></div>}</section>;
}
