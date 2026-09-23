import { useEffect, useMemo, useRef, useState } from 'react';
import type { Json, Schema, SchemaColumn } from '../../shared/types';
import { api, message, post, RequestError } from '../api';

type ImportFormat = 'csv' | 'json' | 'ndjson';
type Step = 'file' | 'mapping' | 'review' | 'status';
const importSteps = [
    { id: 'file', label: 'File' },
    { id: 'mapping', label: 'Map' },
    { id: 'review', label: 'Review' },
    { id: 'status', label: 'Import' },
] as const satisfies readonly { id: Step; label: string }[];
type ImportPreview = {
    id: string;
    name: string;
    format: ImportFormat;
    columns: string[];
    rows: Record<string, Json>[];
    rowCount: number;
};
type ImportMapping = {
    id: string;
    inputId: string;
    connectionId: string;
    table: string;
    fields: Record<string, string>;
    rows: Record<string, Json>[];
    rowCount: number;
};
type ImportJob = {
    id: string;
    table: string;
    rows: number;
    status: 'running' | 'succeeded' | 'unknown';
    error?: string;
};
type PendingImport = { id: string; table: string; rows: number; name: string };
type BusyAction = '' | 'setup' | 'preview' | 'mapping' | 'commit' | 'recover';
type ImportWizardProps = {
    open: boolean;
    connectionId: string;
    trusted: boolean;
    demoMode: boolean;
    onClose: () => void;
    onImported: () => void;
};

function isPendingImport(value: unknown): value is PendingImport {
    return typeof value === 'object' && value !== null && !Array.isArray(value) &&
        'id' in value && typeof value.id === 'string' && value.id.length > 0 &&
        'table' in value && typeof value.table === 'string' && value.table.length > 0 &&
        'rows' in value && typeof value.rows === 'number' && Number.isSafeInteger(value.rows) && value.rows >= 0 &&
        'name' in value && typeof value.name === 'string';
}

const MAX_FILE_BYTES = 2_000_000;
const importStateKey = (connectionId: string) => `clickstudio:import:${connectionId}:v1`;

function fileFormat(file: File): ImportFormat | undefined {
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) return 'csv';
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.ndjson') || name.endsWith('.jsonl')) return 'ndjson';
    return undefined;
}

function displayValue(value: Json | undefined): string {
    if (value === undefined) return '—';
    if (typeof value === 'string') return value;
    if (value === null) return 'null';
    return JSON.stringify(value);
}

function writableColumns(schema: Schema | undefined, table: string): SchemaColumn[] {
    return schema?.columns.filter(column => `${column.database}.${column.table}` === table && !['MATERIALIZED', 'ALIAS'].includes(column.defaultKind)) ?? [];
}

function initialFields(sourceColumns: string[], destinations: SchemaColumn[]): Record<string, string> {
    const writableNames = new Set(destinations.map(column => column.name));
    return Object.fromEntries(sourceColumns.map(column => [column, writableNames.has(column) ? column : '']));
}

export function ImportWizard({ open, connectionId, trusted, demoMode, onClose, onImported }: ImportWizardProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const onImportedRef = useRef(onImported);
    const reportedJobRef = useRef<string | undefined>(undefined);
    onImportedRef.current = onImported;

    const [step, setStep] = useState<Step>('file');
    const [file, setFile] = useState<File>();
    const [format, setFormat] = useState<ImportFormat>();
    const [preview, setPreview] = useState<ImportPreview>();
    const [schema, setSchema] = useState<Schema>();
    const [targets, setTargets] = useState<string[]>([]);
    const [target, setTarget] = useState('');
    const [fields, setFields] = useState<Record<string, string>>({});
    const [mapping, setMapping] = useState<ImportMapping>();
    const [job, setJob] = useState<ImportJob>();
    const [pendingImport, setPendingImport] = useState<PendingImport>();
    const [busy, setBusy] = useState<BusyAction>('');
    const [error, setError] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [importUnavailable, setImportUnavailable] = useState('');

    const availableTargets = useMemo(() => targets.filter(table => schema?.tables.some(item => `${item.database}.${item.name}` === table)), [schema, targets]);
    const destinationColumns = useMemo(() => writableColumns(schema, target), [schema, target]);
    const selectedFields = useMemo(() => Object.fromEntries(Object.entries(fields).filter(([, destination]) => Boolean(destination))), [fields]);
    const destinationNames = Object.values(selectedFields);
    const duplicateDestinations = new Set(destinationNames).size !== destinationNames.length;
    const confirmationPhrase = mapping ? `INSERT ${mapping.rowCount} ROWS` : '';
    const sampleColumns = preview?.columns.slice(0, 6) ?? [];

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        let current = true;
        const controller = new AbortController();
        setStep('file');
        setFile(undefined);
        setFormat(undefined);
        setPreview(undefined);
        setSchema(undefined);
        setTargets([]);
        setTarget('');
        setFields({});
        setMapping(undefined);
        setJob(undefined);
        setPendingImport(undefined);
        setBusy('');
        setError('');
        setConfirmation('');
        setImportUnavailable('');
        reportedJobRef.current = undefined;

        if (demoMode) {
            setImportUnavailable('File imports are disabled in sample data. This workspace never writes to a database.');
            return () => { current = false; controller.abort(); };
        }
        if (!trusted) {
            setImportUnavailable('Trust this connection before importing data.');
            return () => { current = false; controller.abort(); };
        }

        const key = importStateKey(connectionId);
        let stored: PendingImport | undefined;
        try {
            const value = localStorage.getItem(key);
            if (value) {
                const parsed: unknown = JSON.parse(value);
                if (isPendingImport(parsed)) stored = parsed;
            }
        } catch { }

        const recovery = stored;
        if (recovery) {
            setPendingImport(recovery);
            setStep('status');
            setBusy('recover');
            void api<ImportJob>(`/imports/${encodeURIComponent(recovery.id)}`, { signal: controller.signal }).then(next => {
                if (!current) return;
                setJob(next);
                if (next.status === 'succeeded') reportImported(next.id);
            }).catch(() => {
                if (!current) return;
                setJob({ id: recovery.id, table: recovery.table, rows: recovery.rows, status: 'unknown', error: 'The previous import status could not be confirmed. Inspect the destination before retrying.' });
            }).finally(() => { if (current) setBusy(''); });
            return () => { current = false; controller.abort(); };
        }

        setBusy('setup');
        void Promise.all([
            api<string[]>(`/connections/${encodeURIComponent(connectionId)}/import-targets`, { signal: controller.signal }),
            api<Schema>(`/connections/${encodeURIComponent(connectionId)}/schema`, { signal: controller.signal }),
        ]).then(([nextTargets, nextSchema]) => {
            if (!current) return;
            setTargets(nextTargets);
            setSchema(nextSchema);
            const first = nextTargets.find(table => nextSchema.tables.some(item => `${item.database}.${item.name}` === table)) ?? '';
            setTarget(first);
            if (!first) setImportUnavailable('No import targets are configured for this connection. Ask the workspace owner to allow a destination table.');
        }).catch(caught => {
            if (current) setError(message(caught));
        }).finally(() => { if (current) setBusy(''); });

        return () => { current = false; controller.abort(); };
    }, [open, connectionId, trusted, demoMode]);

    useEffect(() => {
        if (!open || step !== 'status' || job?.status !== 'running') return;
        let current = true;
        let polling = false;
        const poll = async () => {
            if (polling) return;
            polling = true;
            try {
                const next = await api<ImportJob>(`/imports/${encodeURIComponent(job.id)}`);
                if (!current) return;
                setJob(next);
                setBusy('');
                if (next.status === 'succeeded') reportImported(next.id);
            } catch (caught) {
                if (current) setError(`Could not refresh import status: ${message(caught)}`);
            } finally { polling = false; }
        };
        const timer = window.setInterval(() => void poll(), 900);
        return () => { current = false; window.clearInterval(timer); };
    }, [open, step, job?.id, job?.status]);

    function reportImported(id: string) {
        if (reportedJobRef.current === id) return;
        reportedJobRef.current = id;
        onImportedRef.current();
    }

    function savePendingImport(value: PendingImport) {
        setPendingImport(value);
        try { localStorage.setItem(importStateKey(connectionId), JSON.stringify(value)); } catch { }
    }

    function clearPendingImport() {
        try { localStorage.removeItem(importStateKey(connectionId)); } catch { }
        setPendingImport(undefined);
    }

    async function closeWizard() {
        if (busy || job?.status === 'running') return;
        if (preview?.id) {
            void api(`/imports/${encodeURIComponent(preview.id)}`, { method: 'DELETE' }).catch(() => undefined);
        }
        clearPendingImport();
        onClose();
    }

    function chooseFile(next?: File) {
        setFile(next);
        setPreview(undefined);
        setMapping(undefined);
        setJob(undefined);
        setError('');
        setConfirmation('');
        if (!next) { setFormat(undefined); return; }
        const nextFormat = fileFormat(next);
        setFormat(nextFormat);
        if (!nextFormat) setError('Choose a .csv, .json, .ndjson, or .jsonl file.');
        else if (next.size > MAX_FILE_BYTES) setError('This file is larger than the 2 MB import limit.');
    }

    async function previewFile() {
        if (!file || !format || file.size > MAX_FILE_BYTES || busy) return;
        setBusy('preview');
        setError('');
        try {
            const source = await file.text();
            const next = await post<ImportPreview>('/imports/preview', { name: file.name, source, format });
            setPreview(next);
            setStep('file');
            setError('');
        } catch (caught) {
            setError(message(caught));
        } finally { setBusy(''); }
    }

    function startMapping() {
        if (!preview || !target) return;
        setFields(initialFields(preview.columns, writableColumns(schema, target)));
        setMapping(undefined);
        setError('');
        setStep('mapping');
    }

    function changeTarget(next: string) {
        setTarget(next);
        setFields(initialFields(preview?.columns ?? [], writableColumns(schema, next)));
        setMapping(undefined);
        setConfirmation('');
        setError('');
    }

    async function previewMapping() {
        if (!preview || !target || !destinationNames.length || duplicateDestinations || busy) return;
        setBusy('mapping');
        setError('');
        try {
            const next = await post<ImportMapping>(`/imports/${encodeURIComponent(preview.id)}/mapping`, {
                connectionId,
                table: target,
                fields: selectedFields,
            });
            setMapping(next);
            setConfirmation('');
            setStep('review');
        } catch (caught) {
            setError(message(caught));
        } finally { setBusy(''); }
    }

    async function commitImport() {
        if (!mapping || confirmation !== confirmationPhrase || busy) return;
        const record = { id: mapping.id, table: mapping.table, rows: mapping.rowCount, name: preview?.name ?? 'Selected file' };
        savePendingImport(record);
        setJob({ id: mapping.id, table: mapping.table, rows: mapping.rowCount, status: 'running' });
        setStep('status');
        setBusy('commit');
        setError('');
        try {
            const next = await post<ImportJob>(`/imports/${encodeURIComponent(mapping.id)}/commit`, { confirmation });
            setJob(next);
            if (next.status === 'succeeded') reportImported(next.id);
        } catch (caught) {
            if (caught instanceof RequestError && caught.detail.code === 'SCHEMA_CHANGED') {
                setJob(undefined);
                clearPendingImport();
                setMapping(undefined);
                setStep('mapping');
                try {
                    const [nextTargets, nextSchema] = await Promise.all([
                        api<string[]>(`/connections/${encodeURIComponent(connectionId)}/import-targets`),
                        api<Schema>(`/connections/${encodeURIComponent(connectionId)}/schema`),
                    ]);
                    setTargets(nextTargets);
                    setSchema(nextSchema);
                    const nextTarget = nextTargets.find(table => table === mapping.table && nextSchema.tables.some(item => `${item.database}.${item.name}` === table))
                        ?? nextTargets.find(table => nextSchema.tables.some(item => `${item.database}.${item.name}` === table))
                        ?? '';
                    setTarget(nextTarget);
                    setFields(initialFields(preview?.columns ?? [], writableColumns(nextSchema, nextTarget)));
                    setError('The destination schema changed. Review the updated mapping before importing.');
                } catch (refreshError) {
                    setError(`The destination schema changed. Refresh failed: ${message(refreshError)}`);
                }
                return;
            }
            if (caught instanceof RequestError && caught.status < 500) {
                setJob(undefined);
                clearPendingImport();
                setStep('review');
                setError(message(caught));
                return;
            }
            setError('The response was interrupted. Checking the saved import status…');
            try {
                const next = await api<ImportJob>(`/imports/${encodeURIComponent(mapping.id)}`);
                setJob(next);
                if (next.status === 'succeeded') reportImported(next.id);
            } catch {
                setJob({ id: mapping.id, table: mapping.table, rows: mapping.rowCount, status: 'unknown', error: 'The server could not confirm this insert. Inspect the destination before retrying.' });
            }
        } finally { setBusy(''); }
    }

    async function refreshJob() {
        if (!job || busy) return;
        setBusy('recover');
        setError('');
        try {
            const next = await api<ImportJob>(`/imports/${encodeURIComponent(job.id)}`);
            setJob(next);
            if (next.status === 'succeeded') reportImported(next.id);
        } catch (caught) { setError(`Could not refresh import status: ${message(caught)}`); }
        finally { setBusy(''); }
    }

    return <dialog
        ref={dialogRef}
        aria-labelledby="import-wizard-title"
        onCancel={event => { event.preventDefault(); if (!busy && job?.status !== 'running') void closeWizard(); }}
        onClick={event => { if (event.target === dialogRef.current && !busy && job?.status !== 'running') void closeWizard(); }}
        className="m-auto max-h-[min(90vh,800px)] w-[min(860px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border border-[var(--line-bright)] bg-[var(--panel)] p-0 text-[var(--text)] shadow-[var(--shadow)] backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
        <div className="flex max-h-[min(90vh,800px)] flex-col">
            <header className="flex items-start justify-between gap-5 border-b border-[var(--line)] px-5 py-4 sm:px-7">
                <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">ClickHouse data</span>
                    <h2 id="import-wizard-title" className="mt-1 text-lg font-semibold tracking-tight">Import data</h2>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">Preview, map, and review rows before inserting them.</p>
                </div>
                <button type="button" aria-label="Close import wizard" disabled={Boolean(busy) || job?.status === 'running'} onClick={() => void closeWizard()} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-[var(--text-soft)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-40">Close</button>
            </header>

            <nav aria-label="Import steps" className="grid grid-cols-4 border-b border-[var(--line)] bg-[var(--page)] px-3 py-2 sm:px-7">
                {importSteps.map((item, index) => {
                    const currentIndex = importSteps.findIndex(candidate => candidate.id === step);
                    return <div key={item.id} aria-current={step === item.id ? 'step' : undefined} className={`flex items-center gap-2 px-2 py-1 text-[10px] font-medium sm:text-xs ${step === item.id ? 'text-[var(--accent)]' : currentIndex > index ? 'text-[var(--text-soft)]' : 'text-[var(--muted)]'}`}><span className={`grid size-5 place-items-center rounded-full border text-[9px] ${step === item.id ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]' : currentIndex > index ? 'border-[var(--line-bright)] bg-[var(--panel-raised)]' : 'border-[var(--line)]'}`}>{index + 1}</span>{item.label}</div>;
                })}
            </nav>

            <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
                {importUnavailable && <div role="status" className="rounded-xl border border-[var(--line)] bg-[var(--page)] p-4 text-sm text-[var(--text-soft)]">{importUnavailable}</div>}
                {busy === 'setup' && <div role="status" className="rounded-xl border border-[var(--line)] bg-[var(--page)] p-4 text-sm text-[var(--text-soft)]">Loading destination tables…</div>}
                {busy === 'recover' && step === 'status' && <div role="status" className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--page)] p-3 text-xs text-[var(--text-soft)]">Checking the saved import status…</div>}

                {!importUnavailable && step === 'file' && <section aria-label="Choose and preview a file" className="space-y-4">
                    {!preview ? <>
                        <label className="block rounded-xl border border-dashed border-[var(--line-bright)] bg-[var(--page)] p-5 transition hover:border-[var(--accent)] sm:p-7">
                            <span className="block text-sm font-semibold">Choose a data file</span>
                            <span className="mt-1 block text-xs text-[var(--muted)]">CSV, JSON, NDJSON, or JSONL · up to 2 MB</span>
                            <input aria-label="Choose a CSV, JSON, or NDJSON file" type="file" accept=".csv,.json,.ndjson,.jsonl,text/csv,application/json" onChange={event => chooseFile(event.target.files?.[0])} className="mt-4 block w-full cursor-pointer text-xs text-[var(--text-soft)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--panel-raised)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--text)] hover:file:bg-[var(--panel-hover)]" />
                        </label>
                        {file && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--page)] px-4 py-3 text-xs"><span className="min-w-0 truncate font-medium">{file.name}</span><span className="text-[var(--muted)]">{format ? format.toUpperCase() : 'Unsupported'} · {(file.size / 1024).toFixed(1)} KB</span></div>}
                    </> : <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div><span className="text-xs font-semibold">{preview.name}</span><p className="mt-1 text-[11px] text-[var(--muted)]">{preview.rowCount.toLocaleString()} rows · {preview.columns.length} columns · {preview.format.toUpperCase()}</p></div>
                            <button type="button" onClick={() => { void api(`/imports/${encodeURIComponent(preview.id)}`, { method: 'DELETE' }).catch(() => undefined); setPreview(undefined); setMapping(undefined); setStep('file'); setError(''); }} className="rounded-lg border border-[var(--line)] px-3 py-2 text-[11px] text-[var(--text-soft)] hover:bg-[var(--panel-hover)]">Choose another file</button>
                        </div>
                        <PreviewTable preview={preview} columns={sampleColumns}/>
                    </>}
                    {preview && availableTargets.length === 0 && <div role="status" className="rounded-lg border border-[var(--line)] p-3 text-xs text-[var(--muted)]">No configured import destination is available for this connection.</div>}
                </section>}

                {!importUnavailable && step === 'mapping' && preview && <section aria-label="Map source columns" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                        <label className="grid gap-1.5 text-xs font-medium text-[var(--text-soft)]">Destination table
                            <select aria-label="Import target table" value={target} onChange={event => changeTarget(event.target.value)} className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--page)] px-3 text-xs text-[var(--text)]">
                                {availableTargets.map(table => <option key={table} value={table}>{table}</option>)}
                            </select>
                        </label>
                        <div className="rounded-lg border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[11px] text-[var(--muted)]"><strong className="text-[var(--text-soft)]">{preview.rowCount.toLocaleString()} rows</strong> from {preview.name}. Values are sent as parsed; ClickHouse checks destination types.</div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                        <table className="w-full min-w-[540px] border-collapse text-left text-xs">
                            <thead className="bg-[var(--page)] text-[10px] uppercase tracking-wider text-[var(--muted)]"><tr><th className="px-3 py-2.5">Source column</th><th className="px-3 py-2.5">Destination column</th><th className="px-3 py-2.5">Type</th></tr></thead>
                            <tbody>{preview.columns.map(source => <tr key={source} className="border-t border-[var(--line)]">
                                <th scope="row" className="max-w-[220px] truncate px-3 py-2.5 font-medium text-[var(--text-soft)]" title={source}>{source}</th>
                                <td className="px-3 py-2"><select aria-label={`Map ${source} to destination`} value={fields[source] ?? ''} onChange={event => { setFields(current => ({ ...current, [source]: event.target.value })); setMapping(undefined); setError(''); }} className="min-h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--page)] px-2.5 text-xs text-[var(--text)]"><option value="">Skip column</option>{destinationColumns.map(column => <option key={column.name} value={column.name}>{column.name}</option>)}</select></td>
                                <td className="px-3 py-2.5 font-mono text-[10px] text-[var(--muted)]">{destinationColumns.find(column => column.name === fields[source])?.type ?? '—'}</td>
                            </tr>)}</tbody>
                        </table>
                    </div>
                    {duplicateDestinations && <p role="alert" className="text-xs text-[var(--red)]">Each destination column can be used only once.</p>}
                    {!destinationColumns.length && <p role="alert" className="text-xs text-[var(--red)]">The selected table has no writable columns in the loaded schema.</p>}
                </section>}

                {!importUnavailable && step === 'review' && mapping && preview && <section aria-label="Review import" className="space-y-4">
                    <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 sm:p-5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Ready to insert</span>
                        <h3 className="mt-1 text-base font-semibold">{mapping.rowCount.toLocaleString()} rows into <code className="rounded bg-[var(--page)] px-1.5 py-1 font-mono text-sm">{mapping.table}</code></h3>
                        <p className="mt-2 text-xs leading-relaxed text-[var(--text-soft)]">This writes data to the selected ClickHouse table. The mapping and destination schema were checked by the server.</p>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-[var(--page)] p-4">
                        <h4 className="text-xs font-semibold">Column mapping</h4>
                        <div className="mt-3 flex flex-wrap gap-2">{Object.entries(mapping.fields).map(([source, destination]) => <span key={source} className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[10px]"><span className="text-[var(--text-soft)]">{source}</span><span className="mx-1.5 text-[var(--muted)]">→</span><span className="font-medium">{destination}</span></span>)}</div>
                    </div>
                    <label className="grid gap-1.5 text-xs font-medium text-[var(--text-soft)]">Type <code className="font-mono text-[var(--accent)]">{confirmationPhrase}</code> to confirm
                        <input aria-label={`Type ${confirmationPhrase} to confirm`} value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--page)] px-3 font-mono text-xs text-[var(--text)] placeholder:text-[var(--muted)]" placeholder={confirmationPhrase}/>
                    </label>
                </section>}

                {!importUnavailable && step === 'status' && <section aria-label="Import status" className="space-y-4">
                    <div className={`rounded-xl border p-5 ${job?.status === 'succeeded' ? 'border-[var(--green)]/30 bg-[var(--green)]/5' : job?.status === 'unknown' ? 'border-[var(--amber)]/35 bg-[var(--amber)]/5' : 'border-[var(--line)] bg-[var(--page)]'}`}>
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{job?.status === 'succeeded' ? 'Import complete' : job?.status === 'unknown' ? 'Import needs review' : 'Import running'}</span>
                        <h3 role="status" className="mt-1 text-base font-semibold">{job?.status === 'succeeded' ? `Inserted ${(job.rows ?? pendingImport?.rows ?? 0).toLocaleString()} rows into ${job.table ?? pendingImport?.table}` : job?.status === 'unknown' ? 'The insert outcome is not confirmed.' : `Inserting ${(job?.rows ?? pendingImport?.rows ?? 0).toLocaleString()} rows…`}</h3>
                        {job?.status === 'unknown' ? <p className="mt-2 text-xs leading-relaxed text-[var(--text-soft)]">{job.error ?? 'Inspect the destination table before retrying. The insert may have partially completed.'}</p> : job?.status === 'running' ? <p className="mt-2 text-xs text-[var(--muted)]">Keep this panel open while the server finishes. Imports cannot be cancelled once started.</p> : job?.status === 'succeeded' ? <p className="mt-2 text-xs text-[var(--text-soft)]">The schema has been refreshed for this connection.</p> : <p className="mt-2 text-xs text-[var(--muted)]">Checking the saved import job…</p>}
                    </div>
                    {job?.status === 'unknown' && <button type="button" onClick={() => void refreshJob()} disabled={Boolean(busy)} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-[var(--text-soft)] hover:bg-[var(--panel-hover)] disabled:opacity-50">{busy ? 'Checking…' : 'Check status again'}</button>}
                </section>}

                {error && <p role="alert" className="mt-4 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/5 px-3 py-2.5 text-xs leading-relaxed text-[var(--red)]">{error}</p>}
            </main>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--page)] px-5 py-3 sm:px-7">
                <span className="text-[10px] text-[var(--muted)]">{step === 'file' ? 'Up to 2 MB · maximum 10,000 rows' : step === 'mapping' ? `${Object.keys(selectedFields).length} columns mapped` : step === 'review' ? 'Review before writing' : 'Server-owned import status'}</span>
                <div className="flex items-center gap-2">
                    {step === 'mapping' && <button type="button" onClick={() => { setStep('file'); setError(''); }} disabled={Boolean(busy)} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-[var(--text-soft)] hover:bg-[var(--panel-hover)] disabled:opacity-50">Back</button>}
                    {step === 'review' && <button type="button" onClick={() => { setStep('mapping'); setError(''); }} disabled={Boolean(busy)} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-[var(--text-soft)] hover:bg-[var(--panel-hover)] disabled:opacity-50">Back</button>}
                    {!importUnavailable && step === 'file' && !preview && <button type="button" onClick={() => void previewFile()} disabled={!file || !format || file.size > MAX_FILE_BYTES || Boolean(busy) || availableTargets.length === 0} className="rounded-lg bg-[var(--accent-action)] px-4 py-2 text-xs font-semibold text-[var(--accent-ink)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40">{busy === 'preview' ? 'Reading file…' : 'Preview file'}</button>}
                    {!importUnavailable && step === 'file' && preview && <button type="button" onClick={startMapping} disabled={availableTargets.length === 0} className="rounded-lg bg-[var(--accent-action)] px-4 py-2 text-xs font-semibold text-[var(--accent-ink)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40">Map columns</button>}
                    {!importUnavailable && step === 'mapping' && <button type="button" onClick={() => void previewMapping()} disabled={!target || !destinationNames.length || duplicateDestinations || !destinationColumns.length || Boolean(busy)} className="rounded-lg bg-[var(--accent-action)] px-4 py-2 text-xs font-semibold text-[var(--accent-ink)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40">{busy === 'mapping' ? 'Checking mapping…' : 'Review import'}</button>}
                    {!importUnavailable && step === 'review' && <button type="button" onClick={() => void commitImport()} disabled={confirmation !== confirmationPhrase || Boolean(busy)} className="rounded-lg bg-[var(--accent-action)] px-4 py-2 text-xs font-semibold text-[var(--accent-ink)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40">{busy === 'commit' ? 'Starting…' : 'Import rows'}</button>}
                    {!importUnavailable && step === 'status' && job?.status !== 'running' && <button type="button" onClick={() => void closeWizard()} disabled={Boolean(busy)} className="rounded-lg bg-[var(--accent-action)] px-4 py-2 text-xs font-semibold text-[var(--accent-ink)] transition hover:brightness-105 disabled:opacity-40">Done</button>}
                </div>
            </footer>
        </div>
    </dialog>;
}

function PreviewTable({ preview, columns }: { preview: ImportPreview; columns: string[] }) {
    return <div className="overflow-hidden rounded-xl border border-[var(--line)]">
        <div className="flex items-center justify-between gap-3 bg-[var(--page)] px-3 py-2 text-[10px] text-[var(--muted)]"><span>Sample rows</span><span>Showing {preview.rows.length} of {preview.rowCount.toLocaleString()} · {columns.length} of {preview.columns.length} columns</span></div>
        <div className="max-h-64 overflow-auto">
            <table className="w-full min-w-[440px] border-collapse text-left text-[10px]">
                <thead className="sticky top-0 bg-[var(--panel-raised)] text-[var(--muted)]"><tr>{columns.map(column => <th key={column} className="max-w-[180px] truncate px-3 py-2 font-semibold" title={column}>{column}</th>)}</tr></thead>
                <tbody>{preview.rows.map((row, index) => <tr key={index} className="border-t border-[var(--line)]">{columns.map(column => <td key={column} className="max-w-[180px] truncate px-3 py-2 text-[var(--text-soft)]" title={displayValue(row[column])}>{displayValue(row[column])}</td>)}</tr>)}</tbody>
            </table>
        </div>
    </div>;
}
