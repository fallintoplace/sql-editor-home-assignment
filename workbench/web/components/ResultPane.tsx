import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChartConfig, Result, Run } from '../../shared/types';
import { columnStats, displayValue, exportCsv, filterRows, numericType, recommendChart } from '../../shared/results';
import { api, download, message } from '../api';
import { Action, Callout, Select, TextField } from '../ui';
import { Chart } from './Chart';
export function ResultPane({ run, draftSql, config, onChart, onChild }: {
    run: Run;
    draftSql: string;
    config: ChartConfig;
    onChart: (c: ChartConfig) => void;
    onChild: (column: string, value: string | null) => void;
}) {
    const [filter, setFilter] = useState(''), [page, setPage] = useState(0), [inspect, setInspect] = useState<number>(), [showSql, setShowSql] = useState(false), [view, setView] = useState<'table' | 'chart'>('table');
    const query = useQuery({ queryKey: ['snapshot', run.connectionId, run.id, run.resultState], queryFn: ({ signal }) => api<Result>(`/runs/${run.id}/snapshot`, { signal }), enabled: run.resultState === 'reopenable', retry: false });
    const result = query.data, filtered = useMemo(() => filterRows(result?.rows ?? [], filter), [result, filter]);
    const count = Math.max(1, Math.ceil(filtered.length / 200)), current = Math.min(page, count - 1), rows = filtered.slice(current * 200, current * 200 + 200);
    const recommendation = result ? recommendChart(result.columns, result.rows) : undefined;
    return <section className="results" aria-label="Query results"><div className="toolbar spread"><h2>Results <span className={`status ${run.status}`}>{run.status}</span></h2><div className="toolbar"><Action onClick={() => setShowSql(v => !v)}>Executed SQL</Action>{result && <><Action onClick={() => setView('table')}>Table</Action><Action onClick={() => { if (config.kind === 'table' && recommendation)
        onChart(recommendation.config); setView('chart'); }}>Chart</Action></>}</div></div>
 <div className="run-facts"><code>{run.queryId}</code><span>{Math.round(run.elapsedMs)} ms</span><span>{run.rowCount.toLocaleString()} returned rows</span><span>{run.progress ? `${run.progress.readRows} rows read · ${run.progress.readBytes} bytes read` : 'Read progress unavailable'}</span><span>Executed as {run.executedAs}</span></div>
 {showSql && <pre className="code-block">{run.sql}</pre>}
 {draftSql.trim() !== run.sql.trim() && <Callout>This result belongs to an earlier or selected statement. Editing the draft does not change executed evidence.</Callout>}
 {run.warnings.map((w, i) => <Callout key={i}>{w}</Callout>)}
 {run.error && <Callout danger>{run.error.code}: {run.error.message}</Callout>}
 {run.resultState === 'expired' && <Callout>Result data expired or was evicted. The SQL and query ID remain. Rerun explicitly for fresh data.</Callout>}
 {query.isFetching && <p role="status">Loading retained result…</p>}{query.error && <Callout danger>{message(query.error)}</Callout>}
 {result && <><p className="muted">{result.completeness === 'truncated' ? 'Truncated retained prefix' : 'Complete returned result'} · executed {new Date(result.createdAt).toLocaleString()} · retained until {new Date(result.expiresAt).toLocaleString()}</p>
 <div className="toolbar"><TextField aria-label="Filter retained rows" placeholder="Filter retained rows locally" value={filter} onChange={value => { setFilter(value); setPage(0); }}/><Action onClick={() => download(`${run.queryId}.csv`, exportCsv(result), 'text/csv')}>CSV</Action><Action onClick={() => download(`${run.queryId}.json`, { run, result })}>Evidence JSON</Action></div>
 <p className="muted">Local filter: {filtered.length.toLocaleString()} of {result.rows.length.toLocaleString()} retained rows. No new query or database cost.</p>
 {view === 'chart' && <><div className="chart-controls"><Select label="Chart type" value={config.kind} options={['table', 'number', 'line', 'bar', 'stacked', 'area', 'pie', 'scatter'].map(value => ({ value, label: value }))} onSelect={kind => onChart({ ...config, kind: kind as ChartConfig['kind'] })}/><Select label="X axis" value={String(config.x)} options={result.columns.map((c, i) => ({ value: String(i), label: c.name }))} onSelect={x => onChart({ ...config, x: Number(x) })}/><Select label="Measure" value={String(config.ys[0] ?? '')} options={result.columns.flatMap((c, i) => numericType(c.type) ? [{ value: String(i), label: c.name }] : [])} onSelect={y => onChart({ ...config, ys: [Number(y)] })}/><TextField label="Title" value={config.title} onChange={title => onChart({ ...config, title })}/></div><p className="muted">{recommendation?.reason} The chart uses all retained rows, not the local table filter.</p><Chart result={result} config={config} onFilter={onChild}/></>}
 <div className="table-scroll"><table><thead><tr><th scope="col">Row</th>{result.columns.map((c, i) => <th key={i} scope="col"><Action type="empty" onClick={() => setInspect(inspect === i ? undefined : i)}>{c.name}</Action><small>{c.type}</small></th>)}</tr></thead><tbody>{rows.map((row, r) => <tr key={r}><th scope="row">{current * 200 + r + 1}</th>{row.map((value, c) => <td key={c} title={displayValue(value)} tabIndex={0} onDoubleClick={() => onChild(result.columns[c]!.name, value === null ? null : displayValue(value))}>{displayValue(value)}</td>)}</tr>)}</tbody></table></div>
 {!filtered.length && <Callout>No rows match the local filter, or this query returned no rows. No totals are inferred.</Callout>}
 {inspect !== undefined && result.columns[inspect] && <Callout><strong>{result.columns[inspect]!.name}</strong><pre>{JSON.stringify(columnStats(filtered, inspect), null, 2)}</pre>Statistics describe the locally filtered retained rows only.</Callout>}
 <div className="toolbar spread"><span>Page {current + 1} of {count} · at most 200 rendered rows</span><div className="toolbar"><Action disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Action><Action disabled={current + 1 >= count} onClick={() => setPage(current + 1)}>Next</Action></div></div></>}
 </section>;
}
