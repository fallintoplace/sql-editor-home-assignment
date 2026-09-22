import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog } from '@clickhouse/click-ui';
import type { ChartConfig, Json, Result, Run } from '../../shared/types';
import { columnStats, displayValue, exportCsv, filterRows, numericType, recommendChart } from '../../shared/results';
import { api, download, message } from '../api';
import { Action, Callout, Select, TextField } from '../ui';
import { Chart } from './Chart';
import { matchesDraft } from '../../shared/evidence';

export function ResultPane({ run, draftSql, draftParameters, config, onChart, onChild }: {
    run: Run;
    draftSql: string;
    draftParameters: Record<string, string>;
    config: ChartConfig;
    onChart: (c: ChartConfig) => void;
    onChild: (column: string, value: string | null) => void;
}) {
    const [filter, setFilter] = useState(''), [page, setPage] = useState(0), [inspect, setInspect] = useState<number>();
    const [showSql, setShowSql] = useState(false), [view, setView] = useState<'table' | 'chart'>('table');
    const [cell, setCell] = useState<{ column: number; value: Json }>();
    const [copyNotice, setCopyNotice] = useState(''), [copyError, setCopyError] = useState(''), [copying, setCopying] = useState(false);
    const cellOrigin = useRef<HTMLElement | null>(null);
    const query = useQuery({ queryKey: ['snapshot', run.connectionId, run.id, run.resultState], queryFn: ({ signal }) => api<Result>(`/runs/${run.id}/snapshot`, { signal }), enabled: run.resultState === 'reopenable', retry: false });
    const result = query.data, filtered = useMemo(() => filterRows(result?.rows ?? [], filter), [result, filter]);
    const count = Math.max(1, Math.ceil(filtered.length / 200)), current = Math.min(page, count - 1), rows = filtered.slice(current * 200, current * 200 + 200);
    const recommendation = result ? recommendChart(result.columns, result.rows) : undefined;
    const changeFilter = (value: string) => { setFilter(value); setPage(0); };
    const inspectCell = (origin: HTMLElement, column: number, value: Json) => {
        cellOrigin.current = origin;
        setCopyNotice('');
        setCopyError('');
        setCell({ column, value });
    };
    const copyCell = async () => {
        if (!cell || copying) return;
        setCopying(true);
        setCopyNotice('');
        setCopyError('');
        try {
            await navigator.clipboard.writeText(displayValue(cell.value));
            setCopyNotice('Cell value copied.');
        } catch {
            setCopyError('Could not access the clipboard. Select and copy the full value below.');
        } finally {
            setCopying(false);
        }
    };
    return <section className="results" aria-label="Query results">
        <div className="toolbar spread"><h2>Results <span className={`status ${run.status}`}>{run.status}</span></h2>
            <div className="toolbar"><Action aria-expanded={showSql} onClick={() => setShowSql(v => !v)}>Executed SQL</Action>
                {result && <><Action aria-pressed={view === 'table'} type={view === 'table' ? 'primary' : 'secondary'} onClick={() => setView('table')}>Table</Action>
                    <Action aria-pressed={view === 'chart'} type={view === 'chart' ? 'primary' : 'secondary'} onClick={() => {
                        if (config.kind === 'table' && recommendation) onChart(recommendation.config);
                        setView('chart');
                    }}>Chart</Action></>}
            </div>
        </div>
        <div className="run-facts"><code>{run.queryId}</code><span>{Math.round(run.elapsedMs)} ms</span><span>{run.rowCount.toLocaleString()} returned rows</span><span>{run.progress ? `${run.progress.readRows} rows read · ${run.progress.readBytes} bytes read` : 'Read progress unavailable'}</span><span>Executed as {run.executedAs}</span></div>
        {showSql && <><pre className="code-block" aria-label="Executed SQL text">{run.sql}</pre><pre className="code-block" aria-label="Executed parameters">{JSON.stringify(run.parameters, null, 2)}</pre></>}
        {!matchesDraft(run, draftSql, draftParameters) && <Callout>This result belongs to an earlier or selected statement, or different bound parameters. Editing the draft does not change executed evidence.</Callout>}
        {run.warnings.map((w, i) => <Callout key={i}>{w}</Callout>)}
        {run.error && <Callout danger>{run.error.code}: {run.error.message}</Callout>}
        {run.resultState === 'expired' && <Callout>Result data expired or was evicted. The SQL and query ID remain. Rerun explicitly for fresh data.</Callout>}
        {query.isFetching && <p role="status">Loading retained result…</p>}
        {query.error && <Callout danger>{message(query.error)}<Action disabled={query.isFetching} onClick={() => void query.refetch()}>Retry loading result</Action><p>Reloads retained data only. Does not execute SQL.</p></Callout>}
        {result && <>
            <p className="muted">{result.completeness === 'truncated' ? 'Truncated retained prefix' : 'Complete returned result'} · executed {new Date(result.createdAt).toLocaleString()} · retained until {new Date(result.expiresAt).toLocaleString()}</p>
            <div className="toolbar wrap"><Action onClick={() => download(`${run.queryId}.csv`, exportCsv(result), 'text/csv')}>CSV</Action><Action onClick={() => download(`${run.queryId}.json`, { run, result })}>Evidence JSON</Action><span className="muted">Exports include all {result.rows.length.toLocaleString()} retained rows, not just the local filter or page.</span></div>
            {view === 'chart' ? <>
                <div className="chart-controls"><Select label="Chart type" value={config.kind} options={['table', 'number', 'line', 'bar', 'stacked', 'area', 'pie', 'scatter'].map(value => ({ value, label: value }))} onSelect={kind => onChart({ ...config, kind: kind as ChartConfig['kind'] })}/><Select label="X axis" value={String(config.x)} options={result.columns.map((c, i) => ({ value: String(i), label: c.name }))} onSelect={x => onChart({ ...config, x: Number(x) })}/><Select label="Measure" value={String(config.ys[0] ?? '')} options={result.columns.flatMap((c, i) => numericType(c.type) ? [{ value: String(i), label: c.name }] : [])} onSelect={y => onChart({ ...config, ys: [Number(y)] })}/><TextField label="Title" value={config.title} onChange={title => onChart({ ...config, title })}/></div>
                <p className="muted">{recommendation?.reason} The chart uses all retained rows, not the local table filter.</p>
                <Chart result={result} config={config} onFilter={onChild}/>
            </> : <>
                <div className="toolbar wrap"><TextField aria-label="Filter retained rows" placeholder="Filter retained rows locally" value={filter} onChange={changeFilter} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); changeFilter(''); } }}/>
                    {filter && <Action onClick={() => changeFilter('')}>Clear filter</Action>}
                </div>
                <p className="muted" role="status">Local filter: {filtered.length.toLocaleString()} of {result.rows.length.toLocaleString()} retained rows. No new query or database cost.</p>
                <p className="result-cell-help">Focus a cell and press Enter, or double-click, to inspect its full value, copy it, or create a filtered draft.</p>
                <div className="table-scroll"><table aria-label="Retained query rows"><thead><tr><th scope="col">Row</th>{result.columns.map((c, i) => <th key={i} scope="col"><Action type="empty" aria-expanded={inspect === i} onClick={() => setInspect(inspect === i ? undefined : i)}>{c.name}</Action><small>{c.type}</small></th>)}</tr></thead>
                    <tbody>{rows.map((row, r) => <tr key={r}><th scope="row">{current * 200 + r + 1}</th>{row.map((value, c) => <td key={c} title={displayValue(value)} tabIndex={0}
                        onDoubleClick={event => inspectCell(event.currentTarget, c, value)}
                        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); inspectCell(event.currentTarget, c, value); } }}>{displayValue(value)}</td>)}</tr>)}</tbody>
                </table></div>
                {result.rows.length === 0 ? <div className="result-empty" role="status"><h3>This query returned no rows.</h3><p>The execution completed without row data. Review the SQL and bound parameters before choosing to run again. No totals are inferred.</p></div>
                    : filtered.length === 0 && <div className="result-empty" role="status"><h3>No retained rows match this filter.</h3><p>Your {result.rows.length.toLocaleString()} retained rows are still available. Clear the local filter to show them again.</p></div>}
                {inspect !== undefined && result.columns[inspect] && <Callout><strong>{result.columns[inspect]!.name}</strong><pre>{JSON.stringify(columnStats(filtered, inspect), null, 2)}</pre>Statistics describe the locally filtered retained rows only.</Callout>}
                <nav className="toolbar spread result-pagination" aria-label="Result pages"><span className="muted">{filtered.length ? `Rows ${(current * 200 + 1).toLocaleString()}-${Math.min((current + 1) * 200, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()} · ` : ''}Page {current + 1} of {count} · at most 200 rendered rows</span>
                    <div className="toolbar"><Action disabled={current === 0} onClick={() => setPage(0)}>First</Action><Action disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Action><Action disabled={current + 1 >= count} onClick={() => setPage(current + 1)}>Next</Action><Action disabled={current + 1 >= count} onClick={() => setPage(count - 1)}>Last</Action></div>
                </nav>
            </>}
        </>}
        <Dialog open={Boolean(cell)} onOpenChange={open => { if (!open) setCell(undefined); }}>
            <Dialog.Content title="Inspect cell" description="The exact retained value. Inspecting and copying never executes a query." showClose onCloseAutoFocus={event => {
                event.preventDefault();
                if (cellOrigin.current?.isConnected) cellOrigin.current.focus();
            }}>
                {cell && <div className="cell-inspector"><p><strong>{result?.columns[cell.column]?.name}</strong> · {result?.columns[cell.column]?.type}</p>
                    <pre className="code-block" aria-label="Full cell value" tabIndex={0}>{displayValue(cell.value)}</pre>
                    <div className="toolbar wrap"><Action disabled={copying} onClick={() => void copyCell()}>{copying ? 'Copying…' : 'Copy value'}</Action><Action onClick={() => {
                        const column = result?.columns[cell.column];
                        if (column) onChild(column.name, cell.value === null ? null : displayValue(cell.value));
                        setCell(undefined);
                    }}>Create filtered draft</Action></div>
                    <p className="muted">A filtered draft is a new editable tab. Review it and press Run separately.</p>
                    {copyNotice && <p role="status">{copyNotice}</p>}{copyError && <Callout danger>{copyError}</Callout>}
                </div>}
            </Dialog.Content>
        </Dialog>
    </section>;
}
