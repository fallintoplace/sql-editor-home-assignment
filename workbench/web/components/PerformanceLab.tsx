import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Run } from '../../shared/types';
import { api, message } from '../api';
import { Action, Callout, Select } from '../ui';

export interface ProfileResponse {
    queryId: string;
    runId: string;
    evidence: unknown;
    traceUrl?: string;
    notice: string;
}
type EvidenceRow = Record<string, unknown>;
interface Snapshot {
    durationMs: number;
    readRows?: string;
    readBytes?: string;
    resultRows: number;
    resultBytes?: string;
    memory?: string;
}

const objectRows = (value: unknown): EvidenceRow[] => Array.isArray(value) ? value.filter(row => Boolean(row) && typeof row === 'object') as EvidenceRow[] : [];
const value = (row: EvidenceRow | undefined, key: string) => row?.[key];
const numberValue = (input: unknown) => {
    const number = typeof input === 'number' ? input : typeof input === 'string' && input.trim() ? Number(input) : NaN;
    return Number.isFinite(number) ? number : undefined;
};
const integerText = (input: unknown) => input === undefined || input === null || input === '' ? undefined : String(input);
const formatInteger = (input: unknown) => {
    const text = integerText(input);
    if (!text)
        return '—';
    const number = Number(text);
    return Number.isSafeInteger(number) ? number.toLocaleString() : text;
};
const formatBytes = (input: unknown) => {
    const number = numberValue(input);
    if (number === undefined)
        return '—';
    if (number >= 1024 * 1024 * 1024)
        return `${(number / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
    if (number >= 1024 * 1024)
        return `${(number / (1024 * 1024)).toFixed(1)} MiB`;
    if (number >= 1024)
        return `${(number / 1024).toFixed(1)} KiB`;
    return `${number.toLocaleString()} B`;
};
const formatDuration = (milliseconds: number | undefined) => milliseconds === undefined ? '—' : milliseconds < 1000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1000).toFixed(2)} s`;
const evidenceFor = (profile: ProfileResponse | undefined, queryId: string) => {
    const rows = objectRows(profile?.evidence), matching = rows.filter(row => String(value(row, 'query_id') ?? '') === queryId);
    return matching.find(row => ['QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart'].includes(String(value(row, 'type')))) ?? matching[0] ?? rows[0];
};
function snapshot(run: Run, row: EvidenceRow | undefined): Snapshot {
    return {
        durationMs: numberValue(value(row, 'query_duration_ms')) ?? run.elapsedMs,
        readRows: integerText(value(row, 'read_rows')) ?? run.progress?.readRows,
        readBytes: integerText(value(row, 'read_bytes')) ?? run.progress?.readBytes,
        resultRows: numberValue(value(row, 'result_rows')) ?? run.rowCount,
        resultBytes: integerText(value(row, 'result_bytes')) ?? (run.bytes ? String(run.bytes) : undefined),
        memory: integerText(value(row, 'memory_usage')) ?? run.progress?.memory,
    };
}
function delta(current: number | undefined, baseline: number | undefined) {
    if (current === undefined || baseline === undefined || baseline === 0)
        return undefined;
    const percent = ((current - baseline) / baseline) * 100;
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}
function Metric({ label, value: metricValue, delta: metricDelta }: { label: string; value: string; delta?: string }) {
    return <article className="performance-metric"><span>{label}</span><strong>{metricValue}</strong>{metricDelta && <small className={metricDelta.startsWith('-') ? 'performance-better' : 'performance-worse'}>{metricDelta} vs comparison</small>}</article>;
}

export function PerformanceLab({ connectionId, run, runs, available, current, loading, error, onLoad }: {
    connectionId: string;
    run?: Run;
    runs: readonly Run[];
    available: boolean;
    current?: ProfileResponse;
    loading: boolean;
    error?: string;
    onLoad: () => void;
}) {
    const [compareId, setCompareId] = useState('');
    const comparison = useMemo(() => runs.find(candidate => candidate.id === compareId), [runs, compareId]);
    const comparisonProfile = useQuery({
        queryKey: ['profile', connectionId, comparison?.id],
        queryFn: () => api<ProfileResponse>(`/runs/${comparison!.id}/profile`),
        enabled: Boolean(comparison && available),
        retry: false,
    });
    if (!run)
        return <div className="performance-lab stack"><h2>ClickHouse Performance Lab</h2><Callout>Select a completed run to inspect measured execution evidence.</Callout></div>;
    const currentSnapshot = snapshot(run, evidenceFor(current, run.queryId));
    const comparisonSnapshot = comparison ? snapshot(comparison, evidenceFor(comparisonProfile.data, comparison.queryId)) : undefined;
    return <div className="performance-lab stack"><div><h2>ClickHouse Performance Lab</h2><p className="muted">Measured execution evidence for <code>{run.queryId}</code>. The editor and retained result remain authoritative.</p></div>
        <div className="performance-toolbar"><Action disabled={!available || loading} onClick={onLoad}>{loading ? 'Loading evidence…' : current ? 'Refresh evidence' : 'Load server evidence'}</Action><Select label="Compare with" value={compareId} options={[{ value: '', label: 'No comparison' }, ...runs.filter(candidate => candidate.id !== run.id && ['succeeded', 'truncated', 'failed'].includes(candidate.status)).slice(0, 20).map(candidate => ({ value: candidate.id, label: `${candidate.status} · ${Math.round(candidate.elapsedMs)} ms · ${candidate.queryId}` }))]} onSelect={setCompareId}/></div>
        {!available && <Callout>Query-log evidence is unavailable on this connection. The live run progress below still comes from the execution path.</Callout>}
        {error && <Callout danger>{error}</Callout>}
        {comparisonProfile.error && <Callout danger>{message(comparisonProfile.error)}</Callout>}
        <div className="performance-metrics"><Metric label="Duration" value={formatDuration(currentSnapshot.durationMs)} delta={delta(currentSnapshot.durationMs, comparisonSnapshot?.durationMs)}/><Metric label="Rows read" value={formatInteger(currentSnapshot.readRows)} delta={delta(numberValue(currentSnapshot.readRows), numberValue(comparisonSnapshot?.readRows))}/><Metric label="Bytes read" value={formatBytes(currentSnapshot.readBytes)} delta={delta(numberValue(currentSnapshot.readBytes), numberValue(comparisonSnapshot?.readBytes))}/><Metric label="Result rows" value={formatInteger(currentSnapshot.resultRows)} delta={delta(currentSnapshot.resultRows, comparisonSnapshot?.resultRows)}/><Metric label="Result bytes" value={formatBytes(currentSnapshot.resultBytes)} delta={delta(numberValue(currentSnapshot.resultBytes), numberValue(comparisonSnapshot?.resultBytes))}/><Metric label="Peak memory" value={formatBytes(currentSnapshot.memory)}/></div>
        {comparison && <p className="muted">Comparison run: <code>{comparison.queryId}</code>. Negative duration, rows, bytes, or memory deltas are generally better, but query shape and data freshness still matter.</p>}
        {current?.notice && <p className="muted">{current.notice}</p>}
        {current && <details><summary>Raw server evidence</summary><pre className="code-block">{JSON.stringify(current.evidence, null, 2)}</pre></details>}
        {current?.traceUrl && <a href={current.traceUrl} target="_blank" rel="noreferrer">Open trace in configured observability service</a>}
    </div>;
}
