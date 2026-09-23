import type { AssistantAction, ProfilePipeline, Proposal, QueryDocument, QueryProfile, Run, Schema } from '../../shared/types';
import { quoteIdentifier } from '../../shared/sql';
import { AssistantWorkflow } from './AssistantWorkflow';
import { Button, cx, formatBytes, Icon, inspectorLabel, Status } from './ui';
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

export function InspectorPane({ inspector, setInspector, connection, schema, schemaLoading, schemaError, search, setSearch, tables, history, documents, run, profile, pipeline, onRefreshSchema, onRefreshHistory, onInsert, onOpenImport, onOpenRun, onOpenDocument, onLoadProfile, onLoadPipeline, connectionId, sql, trusted, runId, onRefreshDocuments, assistantAction, onAssistantAction, assistantQuestion, onAssistantQuestion, assistantContext, assistantProposal, assistantBusy, assistantError, includeResult, onIncludeResult, onVoiceInput, voiceListening, voiceError, onPreview, onRequestProposal, onDecideProposal, onRunQuery, runDisabled, drawer = false, onClose }: InspectorPaneProps) {
    const visibleDocuments = documents.filter(document => document.connectionId === connectionId && !document.deletedAt);
    const closeButton = drawer && <Button variant="ghost" className="icon-only" aria-label="Close inspector" onClick={onClose}><Icon name="close"/></Button>;

    return <aside className={cx('inspector-pane', drawer && 'is-drawer animate-drawer')}>
        <header className="inspector-header"><div><span className="eyebrow">WORKSPACE INSPECTOR</span><h2>{inspectorLabel(inspector)}</h2></div>{closeButton}</header>
        <nav className="inspector-tabs" aria-label="Inspector panels">{inspectorTabs.filter(item => item.id !== 'details' || Boolean(run)).map(item => <button key={item.id} type="button" aria-label={inspectorLabel(item.id)} title={inspectorLabel(item.id)} aria-pressed={inspector === item.id} onClick={() => setInspector(item.id)}><Icon name={item.icon}/></button>)}</nav>
        <div className="inspector-content">
            {inspector === 'schema' && <section className="inspector-section"><div className="inspector-search"><Icon name="search"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tables and columns…" aria-label="Search schema"/><kbd>⌘ F</kbd></div><div className="schema-heading"><span>{schema?.tables.length ?? 0} TABLES</span><div className="flex items-center gap-1.5"><Button variant="ghost" className="toolbar-small" onClick={onOpenImport}>Import data</Button><Button variant="ghost" className="toolbar-small" onClick={onRefreshSchema} disabled={schemaLoading || !trusted}>{schemaLoading ? 'Loading…' : 'Refresh'}</Button></div></div>{schemaError && <div className="callout callout-error">{schemaError}</div>}{!trusted && <div className="inspector-empty"><Icon name="lock"/><strong>Schema is private</strong><p>Trust the connection to inspect tables and columns.</p></div>}{schemaLoading && <div className="inspector-empty"><span className="loading-orbit"/><p>Reading ClickHouse schema…</p></div>}{trusted && schema && tables.map(table => <details className="schema-table" key={`${table.database}.${table.name}`} open={Boolean(search)}><summary><span className="table-glyph">▦</span><span className="schema-table-name"><strong>{table.name}</strong><small>{table.database}</small></span><span className="engine-tag">{table.engine}</span><Icon name="chevron" className="schema-chevron"/></summary><div className="schema-columns"><button type="button" className="insert-table-button" onClick={() => onInsert(`${quoteIdentifier(table.database)}.${quoteIdentifier(table.name)}`)}>Insert table name <span>↵</span></button>{schema.columns.filter(column => column.database === table.database && column.table === table.name && (!search || `${column.name} ${column.type}`.toLowerCase().includes(search.toLowerCase()))).map(column => <button type="button" className="schema-column" key={column.name} title={column.comment || column.type} onClick={() => onInsert(quoteIdentifier(column.name))}><span className="column-type-dot"/><span>{column.name}</span><code>{column.type}</code></button>)}</div></details>)}{trusted && schema && !tables.length && <div className="inspector-empty">No tables match this search.</div>}</section>}
            {inspector === 'history' && <section className="inspector-section"><div className="schema-heading"><span>RECENT RUNS</span><Button variant="ghost" className="toolbar-small" onClick={onRefreshHistory}>↻ Refresh</Button></div>{history.length ? history.slice(0, 30).map(item => <button type="button" className="history-card" key={item.id} onClick={() => onOpenRun(item)}><span className={cx('run-state-mark', `state-${item.status}`)}/><span className="history-card-copy"><strong>{item.sql.replace(/\s+/g, ' ').slice(0, 58)}</strong><small>{new Date(item.createdAt).toLocaleString()} <i>·</i> {Math.round(item.elapsedMs)} ms <i>·</i> {item.rowCount.toLocaleString()} rows</small></span><span className="history-open">↗</span></button>) : <div className="inspector-empty"><Icon name="history"/><strong>No runs yet</strong><p>Your recent ClickHouse executions appear here.</p></div>}</section>}
            {inspector === 'documents' && <section className="inspector-section"><div className="schema-heading"><span>SAVED DOCUMENTS</span><Button variant="ghost" className="toolbar-small" onClick={onRefreshDocuments}>↻ Refresh</Button></div>{visibleDocuments.length ? visibleDocuments.map(document => <button type="button" className="document-card" key={document.id} onClick={() => onOpenDocument(document)}><span className="file-type-icon small">SQL</span><span><strong>{document.name}</strong><small>revision {document.revision} · {new Date(document.updatedAt).toLocaleDateString()}</small></span><span className="history-open">↗</span></button>) : <div className="inspector-empty"><Icon name="documents"/><strong>Nothing saved yet</strong><p>Save the current query to keep a named revision on this connection.</p></div>}</section>}
            {inspector === 'details' && <RunDetails run={run} profile={profile} onLoad={onLoadProfile}/>}
            {inspector === 'pipeline' && <PipelineView run={run} profile={profile} pipeline={pipeline} onLoad={onLoadPipeline}/>}
            {inspector === 'assistant' && <AssistantWorkflow mode={drawer ? 'beginner' : 'expert'} sql={sql} action={assistantAction} onActionChange={onAssistantAction} question={assistantQuestion} onQuestionChange={onAssistantQuestion} context={assistantContext} proposal={assistantProposal} busy={assistantBusy} error={assistantError} trusted={trusted} runId={runId} includeResult={includeResult} onIncludeResult={onIncludeResult} onVoiceInput={onVoiceInput} voiceListening={voiceListening} voiceError={voiceError} onPreview={onPreview} onRequestProposal={onRequestProposal} onDecideProposal={onDecideProposal} onRunQuery={onRunQuery} runDisabled={runDisabled}/>}
        </div>
        <footer className="inspector-footer"><span className="connection-readonly"><Icon name="lock"/> Read only</span><span>{connection.name} <i>·</i> {connection.database}</span></footer>
    </aside>;
}

function RunDetails({ run, profile, onLoad }: { run?: Run; profile?: QueryProfile; onLoad: () => void }) {
    if (!run) return <div className="inspector-empty">Run a query to see execution details.</div>;
    const summary = profile?.summary;
    const items: Array<[string, string]> = [['Query ID', run.queryId], ['Duration', `${Math.round(summary?.durationMs ?? run.elapsedMs)} ms`], ['Rows read', summary?.readRows ? Number(summary.readRows).toLocaleString() : '—'], ['Bytes read', summary?.readBytes ? formatBytes(summary.readBytes) : '—'], ['Memory', summary?.memory ? formatBytes(summary.memory) : '—'], ['Rows returned', run.rowCount.toLocaleString()], ['Executed as', run.executedAs], ['Server', run.serverVersion ?? '—']];
    return <section className="inspector-section"><div className="run-detail-hero"><span className="eyebrow">LATEST EXECUTION</span><Status run={run}/><strong>{run.queryId}</strong><small>{new Date(run.createdAt).toLocaleString()}</small></div><div className="run-fact-list">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong>{label === 'Query ID' && <button title="Copy query ID" onClick={() => void navigator.clipboard.writeText(value)}><Icon name="copy"/></button>}</div>)}</div>{run.error && <div className="callout callout-error">{run.error.code}: {run.error.message}</div>}<Button variant="secondary" className="w-full mt-4" onClick={onLoad}>Load query log evidence</Button>{profile?.notice && <p className="profile-note">{profile.notice}</p>}</section>;
}

function PipelineView({ run, profile, pipeline, onLoad }: { run?: Run; profile?: QueryProfile; pipeline?: ProfilePipeline; onLoad: () => void }) {
    if (!run) return <div className="inspector-empty">Run a query to inspect its execution pipeline.</div>;
    const stages = pipeline?.nodes ?? profile?.pipeline.nodes ?? [];
    return <section className="inspector-section"><div className="schema-heading"><span>EXECUTION PIPELINE</span><Button variant="ghost" className="toolbar-small" onClick={onLoad}>Load evidence</Button></div>{pipeline?.notice && <p className="profile-note">{pipeline.notice}</p>}{stages.length ? <div className="pipeline-list">{stages.map((stage, index) => <article className={`pipeline-stage stage-${stage.status}`} key={stage.id}><span className="pipeline-stage-index">{String(index + 1).padStart(2, '0')}</span><span className="pipeline-connector"/><span className="pipeline-stage-body"><strong>{stage.label}</strong><small>{stage.detail ?? stage.kind} · {stage.status}</small><span>{[stage.durationMs === undefined ? '' : `${Math.round(stage.durationMs)} ms`, stage.rows ? `${stage.rows} rows` : '', stage.bytes ? `${stage.bytes} bytes` : ''].filter(Boolean).join(' · ') || 'No stage-level measurements'}</span></span><span className="stage-evidence">{stage.status}</span></article>)}</div> : <div className="inspector-empty"><Icon name="pipeline"/><strong>Pipeline evidence is not loaded</strong><p>Available ClickHouse versions can return an EXPLAIN PIPELINE graph.</p></div>}</section>;
}
