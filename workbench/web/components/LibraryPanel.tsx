import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Comment, MetricContract, QueryDocument } from '../../shared/types';
import type { Draft } from '../workspace-state';
import { api, download, message, post } from '../api';
import { Action, Callout, Select, TextAreaField, TextField, useConfirmation } from '../ui';
const emptyMetric: MetricContract = { definition: '', grain: '', dimensions: [], timezone: 'UTC', filters: '', nullTreatment: 'State explicitly how nulls are treated.', sourceColumns: [] };
export function LibraryPanel({ draft, documents, onChange, onRestore, onOpen }: {
    draft: Draft;
    documents: QueryDocument[];
    onChange: (patch: Partial<Draft>) => void;
    onRestore: (sql: string, reason: string) => void;
    onOpen: (d: QueryDocument) => void;
}) {
    const [error, setError] = useState(''), [comment, setComment] = useState(''), [compare, setCompare] = useState<QueryDocument>(), [dependency, setDependency] = useState('');
    const confirmation = useConfirmation(), client = useQueryClient(), file = useRef<HTMLInputElement>(null);
    const revisions = useQuery({ queryKey: ['revisions', draft.serverId, draft.baseRevision], queryFn: () => api<QueryDocument[]>(`/documents/${draft.serverId}/revisions`), enabled: Boolean(draft.serverId), retry: false });
    const comments = useQuery({ queryKey: ['comments', draft.serverId], queryFn: () => api<Comment[]>(`/documents/${draft.serverId}/comments`), enabled: Boolean(draft.serverId), retry: false });
    const perform = async (fn: () => Promise<void>) => { setError(''); try {
        await fn();
        await client.invalidateQueries({ queryKey: ['documents'] });
    }
    catch (e) {
        setError(message(e));
    } };
    const metric = draft.metric ?? emptyMetric;
    return <div className="stack"><h2>Documents & meaning</h2><Select label="Artifact kind" value={draft.kind} options={['query', 'snippet', 'metric'].map(value => ({ value, label: value }))} onSelect={value => onChange({ kind: value as Draft['kind'], ...(value === 'metric' ? { metric } : {}) })}/>
 {draft.kind === 'metric' && <div className="stack"><TextAreaField label="Metric definition" value={metric.definition} onChange={definition => onChange({ metric: { ...metric, definition } })}/><TextField label="Grain" value={metric.grain} onChange={grain => onChange({ metric: { ...metric, grain } })}/><TextField label="IANA timezone" value={metric.timezone} onChange={timezone => onChange({ metric: { ...metric, timezone } })}/><TextField label="Dimensions (comma-separated)" value={metric.dimensions.join(', ')} onChange={value => onChange({ metric: { ...metric, dimensions: value.split(',').map(v => v.trim()).filter(Boolean) } })}/><TextField label="Source columns (database.table.column)" value={metric.sourceColumns.join(', ')} onChange={value => onChange({ metric: { ...metric, sourceColumns: value.split(',').map(v => v.trim()).filter(Boolean) } })}/><TextAreaField label="Filters and exclusions" value={metric.filters} onChange={filters => onChange({ metric: { ...metric, filters } })}/><TextField label="Null treatment" value={metric.nullTreatment} onChange={nullTreatment => onChange({ metric: { ...metric, nullTreatment } })}/><p className="muted">Metric definitions are explicit metadata. This release does not silently expand them into SQL or AI prompts.</p></div>}
 <Select label="Reference another saved artifact" value={dependency} options={documents.filter(d => d.id !== draft.serverId && !d.deletedAt).map(d => ({ value: d.id, label: `${d.name} · revision ${d.revision}` }))} onSelect={setDependency}/><Action disabled={!dependency} onClick={() => onChange({ dependencies: [...new Set([...draft.dependencies, dependency])] })}>Add dependency</Action>
 {draft.dependencies.map(id => <div className="toolbar" key={id}><span>{documents.find(d => d.id === id)?.name ?? id}</span><Action type="empty" onClick={() => onChange({ dependencies: draft.dependencies.filter(d => d !== id) })}>Remove reference</Action></div>)}
 {draft.parentDocumentId && <p>Experiment parent: <code>{draft.parentDocumentId}</code></p>}{draft.parentRunId && <p>Parent run: <code>{draft.parentRunId}</code></p>}
 <h3>Saved revisions</h3>{!draft.serverId && <p>Save a revision to create a durable document.</p>}{revisions.data?.map(d => <div className="toolbar spread" key={d.revision}><span>r{d.revision} · {new Date(d.updatedAt).toLocaleString()}</span><Action onClick={() => setCompare(d)}>Compare</Action></div>)}
 {compare && <><div className="diff"><section><h4>Saved r{compare.revision}</h4><pre>{compare.sql}</pre></section><section><h4>Local draft</h4><pre>{draft.sql}</pre></section></div><Action onClick={() => onRestore(compare.sql, `Restore saved revision ${compare.revision}`)}>Restore SQL into local draft</Action></>}
 <h3>Recovery checkpoints</h3>{!draft.checkpoints.length && <p>Checkpoints appear before accepted AI edits, restores, and publication.</p>}{draft.checkpoints.map(c => <Action key={c.id} onClick={() => onRestore(c.sql, `Restore checkpoint: ${c.reason}`)}>{c.reason} · {new Date(c.at).toLocaleTimeString()}</Action>)}
 {draft.serverId && <><h3>Review saved revision {draft.baseRevision}</h3><Action onClick={() => void perform(async () => { await post(`/documents/${draft.serverId}/review`, { revision: draft.baseRevision }); })}>Mark saved logic self-reviewed</Action><p className="muted">Self-review is not independent reviewer approval. Logic changes remove this state.</p><TextAreaField label="Comment on the saved revision" value={comment} onChange={setComment}/><Action disabled={!comment.trim()} onClick={() => void perform(async () => { await post(`/documents/${draft.serverId}/comments`, { revision: draft.baseRevision, text: comment, anchor: {} }); setComment(''); await comments.refetch(); })}>Save review comment</Action>{comments.data?.map(c => <Callout key={c.id}><strong>r{c.revision}:</strong> {c.text}</Callout>)}
 <Action type="danger" onClick={() => void perform(async () => { const impact = await api<string[]>(`/documents/${draft.serverId}/impact`); if (await confirmation.ask('Move saved document to trash', `${impact.length} known downstream document references may become broken. The local draft stays open and the saved document remains recoverable.`)) {
            await api(`/documents/${draft.serverId}`, { method: 'DELETE', body: { confirmImpact: true } });
        } })}>Move saved document to trash</Action></>}
 {documents.some(d => d.deletedAt) && <><h3>Recoverable trash</h3>{documents.filter(d => d.deletedAt).map(d => <Action key={d.id} onClick={() => void perform(async () => { const restored = await post<QueryDocument>(`/documents/${d.id}/restore`); onOpen(restored); })}>Restore {d.name}</Action>)}</>}
 <h3>Portable workspace</h3><Action onClick={() => void perform(async () => download('cathedral-workspace.json', await api('/workspace/export')))}>Export saved workspace</Action><Action onClick={() => file.current?.click()}>Import workspace as new drafts</Action><input ref={file} type="file" accept=".json" hidden onChange={event => { const f = event.target.files?.[0]; event.target.value = ''; if (!f)
        return; void perform(async () => { if (f.size > 2000000)
        throw new Error('Workspace import must be at most 2 MB'); const docs = await post<QueryDocument[]>('/workspace/import', JSON.parse(await f.text())); if (docs[0])
        onOpen(docs[0]); }); }}/>
 <Callout>Import restores portable text and metadata, never source ownership, credentials, old run permissions, or verification.</Callout>
 {error && <Callout danger>{error}</Callout>}{revisions.error && <Callout danger>{message(revisions.error)}</Callout>}{confirmation.dialog}</div>;
}
