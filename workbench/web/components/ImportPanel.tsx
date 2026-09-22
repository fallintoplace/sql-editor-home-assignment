import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Json, Schema } from '../../shared/types';
import { displayValue } from '../../shared/results';
import { api, message, post } from '../api';
import { Action, Callout, Select, TextField } from '../ui';
interface Preview {
    id: string;
    name: string;
    columns: string[];
    rows: Record<string, Json>[];
    rowCount: number;
    expiresAt: string;
}
interface Mapping {
    id: string;
    rowCount: number;
    rows: Record<string, Json>[];
}
export function ImportPanel({ connectionId, schema, trusted }: {
    connectionId: string;
    schema?: Schema;
    trusted: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<Preview>(), [table, setTable] = useState(''), [fields, setFields] = useState<Record<string, string>>({}), [mapping, setMapping] = useState<Mapping>(), [confirmation, setConfirmation] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [job, setJob] = useState<{
        status: string;
        queryId: string;
        error?: string;
    }>();
    const targets = useQuery({ queryKey: ['import-targets', connectionId], queryFn: () => api<string[]>(`/connections/${connectionId}/import-targets`), retry: false });
    const destination = schema?.columns.filter(c => `${c.database}.${c.table}` === table) ?? [];
    const perform = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setError(message(e));
    }
    finally {
        setBusy(false);
    } };
    return <div className="stack"><h2>Preview an input</h2><p>Uploading creates a private, one-hour preview. It never creates a table or inserts rows.</p>
 <input ref={input} hidden type="file" accept=".csv,.json,.jsonl,.ndjson" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file)
        return; void perform(async () => { if (file.size > 2000000)
        throw new Error('Input must be at most 2 MB'); const format = /\.csv$/i.test(file.name) ? 'csv' : /\.(jsonl|ndjson)$/i.test(file.name) ? 'ndjson' : 'json'; const p = await post<Preview>('/imports/preview', { name: file.name, source: await file.text(), format }); setPreview(p); setMapping(undefined); setFields({}); setJob(undefined); }); }}/>
 <Action disabled={busy} onClick={() => input.current?.click()}>Choose CSV / JSON / NDJSON</Action>
 {preview && <><h3>{preview.name}</h3><p>{preview.rowCount} rows · first {preview.rows.length} shown · expires {new Date(preview.expiresAt).toLocaleTimeString()}</p><div className="table-scroll"><table><thead><tr>{preview.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{preview.rows.map((row, i) => <tr key={i}>{preview.columns.map(c => <td key={c}>{displayValue(row[c])}</td>)}</tr>)}</tbody></table></div>
 <Action onClick={() => void perform(async () => { await api(`/imports/${preview.id}`, { method: 'DELETE' }); setPreview(undefined); setMapping(undefined); setJob(undefined); })}>Delete private preview</Action>
 {!targets.data?.length ? <Callout>Insertion is disabled. An operator must configure a separate writer identity and an explicit table allowlist. The preview remains usable.</Callout> : <><Select label="Authorized destination" value={table} options={targets.data.map(value => ({ value, label: value }))} onSelect={value => { setTable(value); setFields({}); setMapping(undefined); setJob(undefined); }}/>
 {table && preview.columns.map(source => <Select key={source} label={`${source} → destination column`} value={fields[source] ?? '__skip'} options={[{ value: '__skip', label: 'Do not import this field' }, ...destination.filter(c => !['ALIAS', 'MATERIALIZED'].includes(c.defaultKind)).map(c => ({ value: c.name, label: `${c.name} · ${c.type}` }))]} onSelect={value => { const next = { ...fields }; if (value === '__skip')
                delete next[source];
            else
                next[source] = value; setFields(next); setMapping(undefined); setJob(undefined); }}/>)}
 <p className="muted">No inferred coercions are applied. CSV values stay strings; ClickHouse performs the declared destination conversion.</p><Action disabled={busy || !trusted || !table || !Object.keys(fields).length} onClick={() => void perform(async () => { setMapping(await post<Mapping>(`/imports/${preview.id}/mapping`, { connectionId, table, fields })); setConfirmation(''); setJob(undefined); })}>Review mapped rows</Action>
 {mapping && <><pre className="code-block">{JSON.stringify(mapping.rows, null, 2)}</pre><Callout>This explicitly writes {mapping.rowCount} rows to {table}. Inserts are not automatically retried; a transport failure may leave a partial insert.</Callout><TextField label={`Type INSERT ${mapping.rowCount} ROWS`} value={confirmation} onChange={setConfirmation}/><Action type="danger" disabled={busy || Boolean(job) || confirmation !== `INSERT ${mapping.rowCount} ROWS`} onClick={() => void perform(async () => setJob(await post(`/imports/${mapping.id}/commit`, { confirmation })))}>Insert reviewed rows</Action></>}
 {job && <Callout danger={job.status !== 'succeeded'}>Import status: {job.status}<p>Query ID: {job.queryId}</p>{job.error}</Callout>}</>}
 </>}{targets.error && <Callout danger>{message(targets.error)}</Callout>}{error && <Callout danger>{error}</Callout>}
 </div>;
}
