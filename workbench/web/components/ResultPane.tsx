import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog } from '@clickhouse/click-ui';
import type { ChartConfig, Json, Result, ResultPage, Run } from '../../shared/types';
import type { Copy } from '../i18n';
import { columnStats, displayValue, filterRows, MAX_CHART_SERIES, numericType, recommendChart } from '../../shared/results';
import { api, download, message } from '../api';
import { Action, Callout, Select, TextField } from '../ui';
import { Chart } from './Chart';
import { matchesDraft } from '../../shared/evidence';
import { visibleColumns, exportFilteredCsv } from '../../shared/result-columns';
import { ResultColumnControls } from './ResultColumnControls';

const RESULT_PAGE_SIZE = 200;
const RESULT_COLUMN_PAGE_SIZE = 50;

function ResultProfile({ result, rows }: { result: Result; rows: Result['rows'] }) {
    return <div className="result-profile" aria-label="Result profile"><div className="toolbar spread"><strong>Retained result profile</strong><span className="muted">{rows.length.toLocaleString()} rows · local filter scope</span></div><div className="result-profile-grid">{result.columns.map((column, index) => {
        const stats = columnStats(rows, index), nullRate = rows.length ? Math.round((stats.nulls / rows.length) * 100) : 0;
        return <article className="profile-card" key={`${column.name}-${index}`}><div className="toolbar spread"><strong title={column.name}>{column.name}</strong><code>{column.type}</code></div><dl><div><dt>Distinct</dt><dd>{stats.distinct.toLocaleString()}</dd></div><div><dt>Nulls</dt><dd>{stats.nulls.toLocaleString()} <small>({nullRate}%)</small></dd></div><div><dt>Minimum</dt><dd>{stats.min === null ? '—' : String(stats.min)}</dd></div><div><dt>Maximum</dt><dd>{stats.max === null ? '—' : String(stats.max)}</dd></div></dl></article>;
    })}</div><p className="muted">Profiles describe retained rows after the local filter. They never run another query and never change the authoritative result.</p></div>;
}

export function ResultPane({ run, draftSql, draftParameters, config, copy, onChart, onChild }: {
    run: Run;
    draftSql: string;
    draftParameters: Record<string, string>;
    config: ChartConfig;
    copy: Copy;
    onChart: (c: ChartConfig) => void;
    onChild: (column: string, value: string | null) => void;
}) {
    const [filter, setFilter] = useState(''), [page, setPage] = useState(0), [inspect, setInspect] = useState<number>();
    const [hiddenColumns, setHiddenColumns] = useState<number[]>([]);
    const [columnPage, setColumnPage] = useState(0), [fullRequested, setFullRequested] = useState(false);
    const [showSql, setShowSql] = useState(false), [view, setView] = useState<'table' | 'chart' | 'profile'>('table');
    const [cell, setCell] = useState<{ column: number; value: Json }>();
    const [copyNotice, setCopyNotice] = useState(''), [copyError, setCopyError] = useState(''), [copying, setCopying] = useState(false);
    const cellOrigin = useRef<HTMLElement | null>(null);
    const deferredFilter = useDeferredValue(filter);
    const requiresFullResult = fullRequested || view !== 'table' || Boolean(filter);
    const pageQuery = useQuery({ queryKey: ['result-page', run.connectionId, run.id, run.resultState, page], queryFn: ({ signal }) => api<ResultPage>(`/runs/${run.id}/result?offset=${page * RESULT_PAGE_SIZE}&count=${RESULT_PAGE_SIZE}`, { signal }), enabled: run.resultState === 'reopenable' && !requiresFullResult, retry: false });
    const fullQuery = useQuery({ queryKey: ['snapshot', run.connectionId, run.id, run.resultState], queryFn: ({ signal }) => api<Result>(`/runs/${run.id}/snapshot`, { signal }), enabled: run.resultState === 'reopenable' && requiresFullResult, retry: false });
    const activeQuery = requiresFullResult ? fullQuery : pageQuery;
    const fullResult = fullQuery.data;
    const result = fullResult ?? pageQuery.data;
    const searchableRows = useMemo(() => fullResult?.rows.map(row => row.map(value => displayValue(value).toLocaleLowerCase()).join('\u0001')), [fullResult]);
    const filtered = useMemo(() => fullResult ? filterRows(fullResult.rows, deferredFilter, searchableRows) : [], [fullResult, deferredFilter, searchableRows]);
    const filtering = filter !== deferredFilter || (Boolean(filter) && !fullResult);
    const displayedColumns = useMemo(() => visibleColumns(result?.columns.length ?? 0, hiddenColumns), [result?.columns.length, hiddenColumns]);
    const retainedRows = fullResult?.rows.length ?? pageQuery.data?.totalRows ?? 0;
    const count = Math.max(1, Math.ceil((fullResult ? filtered.length : retainedRows) / RESULT_PAGE_SIZE)), current = Math.min(page, count - 1);
    const rows = fullResult ? filtered.slice(current * RESULT_PAGE_SIZE, current * RESULT_PAGE_SIZE + RESULT_PAGE_SIZE) : pageQuery.data?.rows ?? [];
    const columnPageCount = Math.max(1, Math.ceil(displayedColumns.length / RESULT_COLUMN_PAGE_SIZE)), currentColumnPage = Math.min(columnPage, columnPageCount - 1);
    const renderedColumns = displayedColumns.slice(currentColumnPage * RESULT_COLUMN_PAGE_SIZE, currentColumnPage * RESULT_COLUMN_PAGE_SIZE + RESULT_COLUMN_PAGE_SIZE);
    const recommendation = fullResult ? recommendChart(fullResult.columns, fullResult.rows) : undefined;
    const changeFilter = (value: string) => { setFilter(value); if (value.trim()) setFullRequested(true); setPage(0); };
    const exportFull = (format: 'csv' | 'json') => {
        const link = document.createElement('a');
        link.href = `/api/runs/${encodeURIComponent(run.id)}/export?format=${format}`;
        link.download = `${run.queryId}.${format}`;
        link.click();
    };
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
    return <section id="query-results" className="results" aria-label="Query results">
        <div className="toolbar spread"><h2>Results <span className={`status ${run.status}`}>{run.status}</span></h2>
            <div className="toolbar"><Action aria-expanded={showSql} onClick={() => setShowSql(v => !v)}>Executed SQL</Action>
                {result && <><Action aria-pressed={view === 'table'} type={view === 'table' ? 'primary' : 'secondary'} onClick={() => setView('table')}>Table</Action>
                    <Action aria-pressed={view === 'chart'} type={view === 'chart' ? 'primary' : 'secondary'} onClick={() => {
                        if (config.kind === 'table' && recommendation) onChart(recommendation.config);
                        setView('chart');
                    }}>Chart</Action><Action aria-pressed={view === 'profile'} type={view === 'profile' ? 'primary' : 'secondary'} onClick={() => setView('profile')}>{copy.editor.profile}</Action></>}
            </div>
        </div>
        <div className="run-facts"><code>{run.queryId}</code><span>{Math.round(run.elapsedMs)} ms</span><span>{run.rowCount.toLocaleString()} returned rows</span><span>{run.progress ? `${run.progress.readRows} rows read · ${run.progress.readBytes} bytes read` : 'Read progress unavailable'}</span><span>Executed as {run.executedAs}</span></div>
        {showSql && <><pre className="code-block" aria-label="Executed SQL text">{run.sql}</pre><pre className="code-block" aria-label="Executed parameters">{JSON.stringify(run.parameters, null, 2)}</pre></>}
        {!matchesDraft(run, draftSql, draftParameters) && <Callout>This result belongs to an earlier or selected statement, or different bound parameters. Editing the draft does not change executed evidence.</Callout>}
        {run.warnings.map((w, i) => <Callout key={i}>{w}</Callout>)}
        {run.error && <Callout danger>{run.error.code}: {run.error.message}</Callout>}
        {run.resultState === 'expired' && <Callout>Result data expired or was evicted. The SQL and query ID remain. Rerun explicitly for fresh data.</Callout>}
        {activeQuery.isFetching && <p role="status">Loading retained result…</p>}
        {activeQuery.error && <Callout danger>{message(activeQuery.error)}<Action disabled={activeQuery.isFetching} onClick={() => void activeQuery.refetch()}>Retry loading result</Action><p>Reloads retained data only. Does not execute SQL.</p></Callout>}
        {result && <>
            <p className="muted">{result.completeness === 'truncated' ? 'Truncated retained prefix' : 'Complete returned result'} · executed {new Date(result.createdAt).toLocaleString()} · retained until {new Date(result.expiresAt).toLocaleString()}</p>
            <div className="toolbar wrap"><Action onClick={() => exportFull('csv')}>CSV</Action><Action onClick={() => exportFull('json')}>Evidence JSON</Action><span className="muted">Full CSV and Evidence JSON: exports include all {retainedRows.toLocaleString()} retained rows, not just the local page. All columns are included.</span></div>
            {view === 'profile' ? fullResult ? <ResultProfile result={fullResult} rows={filtered}/> : <p role="status">Loading all retained rows for the profile…</p> : view === 'chart' ? fullResult ? <>
                <div className="chart-controls"><Select label="Chart type" value={config.kind} options={['table', 'number', 'line', 'bar', 'stacked', 'area', 'pie', 'scatter'].map(value => ({ value, label: value }))} onSelect={kind => { onChart({ ...config, kind: kind as ChartConfig['kind'] }); if (kind === 'table') setView('table'); }}/><Select label="X axis" value={String(config.x)} options={fullResult.columns.map((c, i) => ({ value: String(i), label: c.name }))} onSelect={x => onChart({ ...config, x: Number(x) })}/><div className="measure-picker"><span className="field-label">Measures · max {MAX_CHART_SERIES}</span><div className="toolbar wrap">{fullResult.columns.map((column, index) => { const selected = config.ys.includes(index), limitReached = config.ys.length >= MAX_CHART_SERIES && !selected; return numericType(column.type) && <Action key={index} disabled={limitReached} title={limitReached ? `Choose up to ${MAX_CHART_SERIES} measures.` : undefined} type={selected ? 'primary' : 'secondary'} aria-pressed={selected} onClick={() => { const ys = selected ? config.ys.filter(value => value !== index) : [...config.ys, index]; if (ys.length) onChart({ ...config, ys }); }}>{column.name}</Action>; })}</div></div><TextField label="Title" value={config.title} onChange={title => onChart({ ...config, title })}/></div>
                <p className="muted">{recommendation?.reason} The chart uses all retained rows, not the local table filter.</p>
                {config.kind === 'table' ? <Callout>Choose a chart type and numeric measure, or select Table to inspect the retained values.</Callout> : <Chart result={fullResult} config={config} onFilter={onChild}/>}
            </> : <p role="status">Loading all retained rows for the chart…</p> : <>
                <div className="toolbar wrap"><TextField aria-label="Filter retained rows" placeholder="Filter retained rows locally" value={filter} onChange={changeFilter} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); changeFilter(''); } }}/>
                    {filter && <Action onClick={() => changeFilter('')}>Clear filter</Action>}
                </div>
                <p className="muted" role="status">{filtering ? 'Filtering retained rows…' : fullResult ? `Local filter: ${filtered.length.toLocaleString()} of ${fullResult.rows.length.toLocaleString()} retained rows.` : `Showing page ${current + 1} of ${count} from ${retainedRows.toLocaleString()} retained rows.`} No new query or database cost.</p>
                <ResultColumnControls columns={result.columns} hidden={hiddenColumns} onChange={hidden => { setHiddenColumns(hidden); setInspect(undefined); setColumnPage(0); }}/>
                <div className="toolbar wrap"><Action disabled={!fullResult || !displayedColumns.length} onClick={() => fullResult && download(`${run.queryId}-filtered.csv`, exportFilteredCsv({ columns: fullResult.columns, rows: filtered }, displayedColumns), 'text/csv')}>Filtered CSV</Action><span className="muted">Filtered CSV: all {filtered.length.toLocaleString()} matching retained rows and {displayedColumns.length} visible columns, across every page.</span></div>
                <p className="result-cell-help">Focus a cell and press Enter, or double-click, to inspect its full value, copy it, or create a filtered draft.</p>
                {columnPageCount > 1 && <nav className="toolbar spread result-column-pagination" aria-label="Result column pages"><span className="muted">Columns {currentColumnPage * RESULT_COLUMN_PAGE_SIZE + 1}-{Math.min((currentColumnPage + 1) * RESULT_COLUMN_PAGE_SIZE, displayedColumns.length)} of {displayedColumns.length}</span><div className="toolbar"><Action disabled={currentColumnPage === 0} onClick={() => setColumnPage(0)}>First columns</Action><Action disabled={currentColumnPage === 0} onClick={() => setColumnPage(currentColumnPage - 1)}>Previous columns</Action><Action disabled={currentColumnPage + 1 >= columnPageCount} onClick={() => setColumnPage(currentColumnPage + 1)}>Next columns</Action></div></nav>}
                <div className="table-scroll"><table aria-label="Retained query rows"><thead><tr><th scope="col">Row</th>{renderedColumns.map(i => <th key={i} scope="col"><Action type="empty" aria-expanded={inspect === i} onClick={() => setInspect(inspect === i ? undefined : i)}>{result.columns[i]!.name}</Action><small>{result.columns[i]!.type}</small></th>)}</tr></thead>
                    <tbody>{rows.map((row, r) => <tr key={r}><th scope="row">{current * RESULT_PAGE_SIZE + r + 1}</th>{renderedColumns.map(c => <td key={c} title={displayValue(row[c])} tabIndex={0}
                        onDoubleClick={event => inspectCell(event.currentTarget, c, row[c]!)}
                        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); inspectCell(event.currentTarget, c, row[c]!); } }}>{displayValue(row[c])}</td>)}</tr>)}</tbody>
                </table></div>
                {retainedRows === 0 ? <div className="result-empty" role="status">{result.completeness === 'truncated' ? <><h3>No rows fit in the retained result.</h3><p>This result was truncated. An empty retained prefix does not mean the query matched no rows. Review the output limits before choosing to run again.</p></> : <><h3>This query returned no rows.</h3><p>The execution completed without row data. Review the SQL and bound parameters before choosing to run again. No totals are inferred.</p></>}</div>
                    : fullResult && deferredFilter && filtered.length === 0 && <div className="result-empty" role="status"><h3>No retained rows match this filter.</h3><p>Your {fullResult.rows.length.toLocaleString()} retained rows are still available. Clear the local filter to show them again.</p></div>}
                {inspect !== undefined && result.columns[inspect] && <Callout><strong>{result.columns[inspect]!.name}</strong><pre>{JSON.stringify(columnStats(fullResult ? filtered : rows, inspect), null, 2)}</pre>Statistics describe the currently loaded retained rows only.</Callout>}
                <nav className="toolbar spread result-pagination" aria-label="Result pages"><span className="muted">{(fullResult ? filtered.length : retainedRows) ? `Rows ${(current * RESULT_PAGE_SIZE + 1).toLocaleString()}-${Math.min((current + 1) * RESULT_PAGE_SIZE, fullResult ? filtered.length : retainedRows).toLocaleString()} of ${(fullResult ? filtered.length : retainedRows).toLocaleString()} · ` : ''}Page {current + 1} of {count} · at most {RESULT_PAGE_SIZE} rows and {RESULT_COLUMN_PAGE_SIZE} columns rendered</span>
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
