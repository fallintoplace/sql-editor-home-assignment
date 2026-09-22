import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProfileSummary, QueryProfile, Run } from '../../shared/types';
import { api, message } from '../api';
import { Action, Callout, Select } from '../ui';
import { PipelineGraph } from './PipelineGraph';
import { sameParameters } from '../../shared/evidence';

export type ProfileResponse = QueryProfile;

const fallbackSnapshot = (run: Run): ProfileSummary => ({ durationMs: run.elapsedMs, readRows: run.progress?.readRows, readBytes: run.progress?.readBytes, resultRows: run.rowCount, resultBytes: run.bytes ? String(run.bytes) : undefined, memory: run.progress?.memory });
const numberValue = (input: string | number | undefined) => {
    const number = typeof input === 'number' ? input : input?.trim() ? Number(input) : NaN;
    return Number.isFinite(number) ? number : undefined;
};
const formatInteger = (input: string | number | undefined) => {
    const text = input === undefined ? undefined : String(input);
    if (!text)
        return '—';
    const number = Number(text);
    return Number.isSafeInteger(number) ? number.toLocaleString() : text;
};
const formatBytes = (input: string | number | undefined) => {
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
function delta(current: number | undefined, baseline: number | undefined) {
    if (current === undefined || baseline === undefined || baseline === 0)
        return undefined;
    const percent = ((current - baseline) / baseline) * 100;
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}
function isComparable(left: Run, right: Run) {
    return left.connectionId === right.connectionId && left.kind === right.kind && left.sql.trim() === right.sql.trim() && sameParameters(left.parameters, right.parameters);
}
function Metric({ label, value: metricValue, delta: metricDelta, comparable, directional = false }: { label: string; value: string; delta?: string; comparable: boolean; directional?: boolean }) {
    const tone = comparable && directional && metricDelta ? metricDelta.startsWith('-') ? 'performance-better' : 'performance-worse' : 'performance-neutral';
    return <article className="performance-metric"><span>{label}</span><strong>{metricValue}</strong>{metricDelta && <small className={tone}>{metricDelta} {comparable ? 'vs comparable run' : 'neutral · different query'}</small>}</article>;
}
function Insight({ severity, title, description }: QueryProfile['insights'][number]) {
    return <article className={`profile-insight ${severity}`}><div className="toolbar spread"><strong>{title}</strong><span className="profile-insight-severity">{severity}</span></div><p>{description}</p></article>;
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
    const [compareId, setCompareId] = useState(''), [tab, setTab] = useState<'overview' | 'pipeline' | 'insights' | 'evidence'>('overview');
    useEffect(() => { setCompareId(''); }, [run?.id]);
    const comparison = useMemo(() => runs.find(candidate => candidate.id === compareId && candidate.id !== run?.id), [runs, compareId, run?.id]);
    const comparisonProfile = useQuery({
        queryKey: ['profile', connectionId, comparison?.id],
        queryFn: () => api<ProfileResponse>(`/runs/${comparison!.id}/profile`),
        enabled: Boolean(comparison && available),
        retry: false,
    });
    const pipelineQuery = useQuery({
        queryKey: ['profile-pipeline', connectionId, run?.id],
        queryFn: () => api<QueryProfile['pipeline']>(`/runs/${run!.id}/profile/pipeline`),
        enabled: Boolean(run && current?.capabilities.pipelineGraph && tab === 'pipeline'),
        retry: false,
    });
    if (!run)
        return <div className="performance-lab stack"><h2>Query Profile</h2><Callout>Select a completed run to inspect measured execution evidence.</Callout></div>;
    const currentSnapshot = current?.summary ?? fallbackSnapshot(run), comparisonSnapshot = comparison ? comparisonProfile.data?.summary ?? fallbackSnapshot(comparison) : undefined;
    const insights = current?.insights ?? [];
    const comparisonComparable = Boolean(comparison && isComparable(run, comparison));
    const comparisonOptions = [...runs.filter(candidate => candidate.id !== run.id && ['succeeded', 'truncated', 'failed'].includes(candidate.status))]
        .sort((left, right) => Number(!isComparable(run, left)) - Number(!isComparable(run, right)))
        .slice(0, 20)
        .map(candidate => ({ value: candidate.id, label: `${isComparable(run, candidate) ? 'Same query' : 'Different query'} · ${candidate.status} · ${Math.round(candidate.elapsedMs)} ms · ${candidate.queryId}` }));
    return <div className="performance-lab stack"><div><h2>Query Profile</h2><p className="muted">Measured execution evidence for <code>{run.queryId}</code>. The editor and retained result remain authoritative.</p></div>
        <div className="performance-toolbar"><Action disabled={!available || loading} onClick={onLoad}>{loading ? 'Loading evidence…' : current ? 'Refresh evidence' : 'Load server evidence'}</Action><Select label="Compare with" value={compareId} options={[{ value: '', label: 'No comparison' }, ...comparisonOptions]} onSelect={setCompareId}/></div>
        <nav className="profile-tabs" aria-label="Query profile views" role="tablist"><Action type={tab === 'overview' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>Overview</Action><Action type={tab === 'pipeline' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'pipeline'} onClick={() => setTab('pipeline')}>Pipeline{current?.pipeline.nodes.length ? ` · ${current.pipeline.nodes.length}` : ''}</Action><Action type={tab === 'insights' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'insights'} onClick={() => setTab('insights')}>Insights{insights.length > 0 && ` · ${insights.length}`}</Action><Action type={tab === 'evidence' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'evidence'} onClick={() => setTab('evidence')}>Raw evidence</Action></nav>
        {!available && <Callout>Query-log evidence is unavailable on this connection. The live run progress below still comes from the execution path.</Callout>}
        {error && <Callout danger>{error}</Callout>}
        {comparisonProfile.error && <Callout danger>{message(comparisonProfile.error)}</Callout>}
        {tab === 'overview' && <><div className="performance-metrics"><Metric label="Duration" value={formatDuration(currentSnapshot.durationMs)} delta={delta(currentSnapshot.durationMs, comparisonSnapshot?.durationMs)} comparable={comparisonComparable} directional/><Metric label="Rows read" value={formatInteger(currentSnapshot.readRows)} delta={delta(numberValue(currentSnapshot.readRows), numberValue(comparisonSnapshot?.readRows))} comparable={comparisonComparable} directional/><Metric label="Bytes read" value={formatBytes(currentSnapshot.readBytes)} delta={delta(numberValue(currentSnapshot.readBytes), numberValue(comparisonSnapshot?.readBytes))} comparable={comparisonComparable} directional/><Metric label="Result rows" value={formatInteger(currentSnapshot.resultRows)} delta={delta(currentSnapshot.resultRows, comparisonSnapshot?.resultRows)} comparable={comparisonComparable}/><Metric label="Result bytes" value={formatBytes(currentSnapshot.resultBytes)} delta={delta(numberValue(currentSnapshot.resultBytes), numberValue(comparisonSnapshot?.resultBytes))} comparable={comparisonComparable} directional/><Metric label="Peak memory" value={formatBytes(currentSnapshot.memory)} delta={delta(numberValue(currentSnapshot.memory), numberValue(comparisonSnapshot?.memory))} comparable={comparisonComparable} directional/></div>{comparison && <p className="muted">Comparison run: <code>{comparison.queryId}</code>. {comparisonComparable ? 'This is the same SQL, connection, kind, and bound parameters. Directional deltas are colored for easier review.' : 'This is a different SQL, connection, kind, or parameter set. Deltas are shown as neutral context only.'}</p>}<section className="profile-insights"><div className="toolbar spread"><h3>Evidence-backed insights</h3><span className="muted">Deterministic signals only</span></div>{insights.length ? insights.slice(0, 3).map(insight => <Insight key={insight.id} {...insight}/>) : <p className="muted">Load server evidence to see query-specific signals.</p>}</section></>}
        {tab === 'pipeline' && (!current ? <Callout>Load server evidence to inspect the ClickHouse execution pipeline.</Callout> : current.capabilities.pipelineGraph ? pipelineQuery.isFetching ? <p role="status">Loading ClickHouse pipeline…</p> : pipelineQuery.error ? <Callout danger>{message(pipelineQuery.error)}<Action onClick={() => void pipelineQuery.refetch()}>Retry pipeline</Action></Callout> : <PipelineGraph pipeline={pipelineQuery.data ?? current.pipeline}/> : <PipelineGraph pipeline={current.pipeline}/>)}
        {tab === 'insights' && <section className="profile-insights"><div className="toolbar spread"><h3>Evidence-backed insights</h3><span className="muted">No AI guesses or hidden aggregation</span></div>{insights.length ? insights.map(insight => <Insight key={insight.id} {...insight}/>) : <Callout>No deterministic insight is available for this run yet. Load server evidence after the ClickHouse query log flushes.</Callout>}</section>}
        {current?.notice && <p className="muted">{current.notice}</p>}
        {tab === 'evidence' && current && <details open><summary>Raw server evidence</summary><pre className="code-block">{JSON.stringify(current.evidence, null, 2)}</pre></details>}
        {current?.traceUrl && <a href={current.traceUrl} target="_blank" rel="noreferrer">Open trace in configured observability service</a>}
    </div>;
}
