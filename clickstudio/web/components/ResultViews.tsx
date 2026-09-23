import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { baseType, displayValue, recommendChart, chartNumber, numericType, filterRows, sampleChartRows, MAX_CHART_RENDER_POINTS } from '../../shared/results';
import type { Json, ProfilePipeline, QueryProfile, Result, ResultPage, Row, Run } from '../../shared/types';
import type { Draft } from '../workspace-state';
import { PipelineGraph } from './PipelineGraph';
import { Button, cx, formatBytes, Icon, terminal } from './ui';
import type { IconName } from './ui';

const chartKindOptions = [
    { value: 'number', label: 'Number' },
    { value: 'line', label: 'Line' },
    { value: 'bar', label: 'Bar' },
] as const satisfies readonly { value: Draft['chart']['kind']; label: string }[];

type GridCellAddress = { rowIndex: number; columnIndex: number };
type JsonToken = { text: string; kind: 'string' | 'number' | 'literal' | 'punctuation' | 'whitespace' };
type CopyFeedback = { key: string; message: string; copied: boolean };
type InspectedJsonCell = GridCellAddress & { raw: string; pretty: string; originalText: boolean };

const pinnedColumnsByRun = new Map<string, number[]>();
const jsonTokenPattern = /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]|\s+/gy;

function scanJsonTokens(source: string): JsonToken[] | undefined {
    const tokens: JsonToken[] = [];
    let offset = 0;
    while (offset < source.length) {
        jsonTokenPattern.lastIndex = offset;
        const match = jsonTokenPattern.exec(source);
        if (!match || match.index !== offset)
            return undefined;
        const token = match[0];
        const kind = /^\s+$/.test(token) ? 'whitespace'
            : token.startsWith('"') ? 'string'
                : /^[{}\[\],:]$/.test(token) ? 'punctuation'
                    : /^(?:true|false|null)$/.test(token) ? 'literal'
                        : 'number';
        tokens.push({ text: token, kind });
        offset = jsonTokenPattern.lastIndex;
    }
    return tokens;
}

function prettyJsonSource(source: string): string | undefined {
    try {
        JSON.parse(source);
    } catch {
        return undefined;
    }
    const tokens = scanJsonTokens(source);
    if (!tokens?.length)
        return undefined;
    let depth = 0;
    let previous = '';
    let pretty = '';
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index]!.text;
        if (token === '{' || token === '[') {
            pretty += token;
            depth++;
            const matchingClose = token === '{' ? '}' : ']';
            if (tokens[index + 1]?.text !== matchingClose)
                pretty += `\n${'  '.repeat(depth)}`;
        } else if (token === '}' || token === ']') {
            depth--;
            const matchingOpen = token === '}' ? '{' : '[';
            if (previous !== matchingOpen)
                pretty += `\n${'  '.repeat(depth)}`;
            pretty += token;
        } else if (token === ',') {
            pretty += `,\n${'  '.repeat(depth)}`;
        } else if (token === ':') {
            pretty += ': ';
        } else if (tokens[index]!.kind !== 'whitespace') {
            pretty += token;
        }
        if (tokens[index]!.kind !== 'whitespace')
            previous = token;
    }
    return pretty;
}

function highlightedJson(pretty: string) {
    const tokens = scanJsonTokens(pretty) ?? [];
    return tokens.map((token, index) => {
        if (token.kind === 'whitespace')
            return { ...token, className: undefined };
        let className = `json-token-${token.kind}`;
        if (token.kind === 'string') {
            const next = tokens.slice(index + 1).find(item => item.kind !== 'whitespace');
            className = next?.text === ':' ? 'json-token-key' : 'json-token-string';
        }
        return { ...token, className };
    });
}

function cachedPinnedColumns(runId: string): number[] {
    return [...(pinnedColumnsByRun.get(runId) ?? [])];
}

function rememberPinnedColumns(runId: string, columns: number[]) {
    pinnedColumnsByRun.delete(runId);
    pinnedColumnsByRun.set(runId, columns);
    while (pinnedColumnsByRun.size > 64) {
        const oldest = pinnedColumnsByRun.keys().next().value;
        if (oldest === undefined)
            break;
        pinnedColumnsByRun.delete(oldest);
    }
}

export function ResultGrid({ run, page, pageIndex, loading, onPage }: { run: Run; page?: ResultPage; pageIndex: number; loading: boolean; onPage: (page: number) => void }) {
    const [filter, setFilter] = useState('');
    const [pinnedColumns, setPinnedColumns] = useState(() => cachedPinnedColumns(run.id));
    const [activeCell, setActiveCell] = useState<GridCellAddress>({ rowIndex: 0, columnIndex: 0 });
    const [inspectedCell, setInspectedCell] = useState<InspectedJsonCell | null>(null);
    const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>();
    const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
    const [columnWidths, setColumnWidths] = useState<number[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeCellRef = useRef<HTMLTableCellElement>(null);
    const restoreGridFocus = useRef(false);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const searchableRows = page?.rows.map(row => row.map(value => displayValue(value).toLocaleLowerCase()).join('\u0001')) ?? [];
    const matchingRows: Set<Row> = page ? new Set(filterRows(page.rows, filter, searchableRows)) : new Set<Row>();
    const visibleRows: Array<{ row: Row; index: number }> = page
        ? page.rows.flatMap((row, index): Array<{ row: Row; index: number }> => matchingRows.has(row) ? [{ row, index }] : [])
        : [];
    useEffect(() => {
        const scroll = scrollRef.current;
        const table = scroll?.querySelector('table');
        if (loading || !page || !scroll || !table)
            return;
        const measure = () => {
            setHasHorizontalOverflow(scroll.scrollWidth > scroll.clientWidth + 1);
            const widths = Array.from(table.querySelectorAll('thead th'), cell => cell.getBoundingClientRect().width);
            setColumnWidths(previous => previous.length === widths.length && widths.every((width, index) => Math.abs(width - previous[index]!) < 1) ? previous : widths);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(scroll);
        observer.observe(table);
        return () => observer.disconnect();
    }, [loading, page?.offset, page?.rows.length, page?.columns.length]);
    useEffect(() => {
        const rowIndex = Math.min(activeCell.rowIndex, Math.max(0, visibleRows.length - 1));
        const columnIndex = Math.min(activeCell.columnIndex, Math.max(0, (page?.columns.length ?? 0) - 1));
        if (rowIndex !== activeCell.rowIndex || columnIndex !== activeCell.columnIndex)
            setActiveCell({ rowIndex, columnIndex });
    }, [activeCell, page?.offset, page?.columns.length, visibleRows.length]);
    useEffect(() => {
        if (restoreGridFocus.current) {
            restoreGridFocus.current = false;
            activeCellRef.current?.focus();
        }
    }, [activeCell, inspectedCell]);
    useEffect(() => () => {
        if (copyTimer.current !== undefined)
            clearTimeout(copyTimer.current);
    }, []);
    if (run.resultState === 'expired') return <div className="result-empty-state"><span className="empty-result-icon">⌛</span><strong>Result retention expired</strong><p>The SQL and query ID are still available. Run it again to fetch fresh data.</p></div>;
    if (run.resultState !== 'reopenable') return <div className="result-empty-state"><span className="loading-orbit"/><strong>{terminal(run) ? 'No retained result' : 'Query is running'}</strong><p>{terminal(run) ? 'This run did not produce result rows.' : 'The live execution status appears in the bottom bar.'}</p>{run.error && <div className="callout callout-error mt-4">{run.error.code}: {run.error.message}</div>}</div>;
    if (loading || !page) return <div className="result-loading"><span className="loading-orbit"/><span>Loading retained rows…</span></div>;
    const pageCount = Math.max(1, Math.ceil(page.totalRows / 200));
    const emptyRowsMessage = page.totalRows > 0
        ? 'No retained rows are available on this page.'
        : page.completeness === 'truncated'
            ? 'No rows fit in the retained result. The query may still have matched rows; the result limits left none to keep.'
            : 'This query returned zero rows.';
    let nextPinnedOffset = columnWidths[0] ?? 46;
    const pinnedOffsets = new Map<number, number>();
    for (const index of [...pinnedColumns].sort((left, right) => left - right)) {
        pinnedOffsets.set(index, nextPinnedOffset);
        nextPinnedOffset += columnWidths[index + 1] ?? 128;
    }
    const flashCopy = (key: string, message: string, copied: boolean) => {
        if (copyTimer.current !== undefined)
            clearTimeout(copyTimer.current);
        setCopyFeedback({ key, message, copied });
        copyTimer.current = setTimeout(() => setCopyFeedback(undefined), 1400);
    };
    const copyText = async (key: string, label: string, value: string) => {
        try {
            if (!navigator.clipboard?.writeText)
                throw new Error('Clipboard is unavailable');
            await navigator.clipboard.writeText(value);
            flashCopy(key, `Copied ${label}`, true);
        } catch {
            flashCopy(key, `Could not copy ${label}`, false);
        }
    };
    const togglePinnedColumn = (index: number) => {
        const next = pinnedColumns.includes(index)
            ? pinnedColumns.filter(column => column !== index)
            : [...pinnedColumns, index].sort((left, right) => left - right);
        setPinnedColumns(next);
        rememberPinnedColumns(run.id, next);
    };
    const inspectJsonCell = (rowIndex: number, columnIndex: number, columnType: string, value: Json | undefined) => {
        if (!baseType(columnType).startsWith('JSON')) {
            setInspectedCell(null);
            return;
        }
        const originalText = typeof value === 'string';
        const raw = originalText ? value : value === undefined ? undefined : JSON.stringify(value);
        if (raw === undefined) {
            setInspectedCell(null);
            return;
        }
        const pretty = prettyJsonSource(raw);
        if (pretty !== undefined)
            setInspectedCell({ rowIndex, columnIndex, raw, pretty, originalText });
        else
            setInspectedCell(null);
    };
    const onCellKeyDown = (event: KeyboardEvent<HTMLTableCellElement>, rowPosition: number, columnIndex: number, rowIndex: number, columnType: string, value: Json | undefined) => {
        if (event.target !== event.currentTarget)
            return;
        if (event.key === 'Enter') {
            inspectJsonCell(rowIndex, columnIndex, columnType, value);
            event.preventDefault();
            return;
        }
        if (event.key === 'Escape') {
            if (inspectedCell)
                setInspectedCell(null);
            else event.currentTarget.blur();
            event.preventDefault();
            return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            void copyText(`${page.offset + rowIndex}:${columnIndex}:raw`, `row ${page.offset + rowIndex + 1} value`, displayValue(value));
            return;
        }
        if (event.metaKey || event.ctrlKey || event.altKey)
            return;
        let nextRow = rowPosition;
        let nextColumn = columnIndex;
        if (event.key === 'ArrowLeft') nextColumn--;
        else if (event.key === 'ArrowRight') nextColumn++;
        else if (event.key === 'ArrowUp') nextRow--;
        else if (event.key === 'ArrowDown') nextRow++;
        else if (event.key === 'Home') nextColumn = 0;
        else if (event.key === 'End') nextColumn = page.columns.length - 1;
        else return;
        event.preventDefault();
        nextRow = Math.max(0, Math.min(visibleRows.length - 1, nextRow));
        nextColumn = Math.max(0, Math.min(page.columns.length - 1, nextColumn));
        setInspectedCell(null);
        restoreGridFocus.current = true;
        setActiveCell({ rowIndex: nextRow, columnIndex: nextColumn });
    };
    const closeInspection = () => {
        restoreGridFocus.current = true;
        setInspectedCell(null);
    };
    return <div className="result-grid-wrap animate-enter">
        <div className="result-summary-row">
            <span><strong>{page.totalRows.toLocaleString()}</strong> rows <i>·</i> <strong>{page.columns.length}</strong> columns</span>
            <span className="result-completeness"><span className={cx('status-light', page.completeness === 'truncated' ? 'is-warning' : 'is-trusted')}/>{page.completeness === 'truncated' ? 'Retained prefix · truncated' : 'Complete result'}</span>
            <label className="result-filter"><span>Find on this page</span><input type="search" aria-label="Filter current page" placeholder="Filter rows" value={filter} onChange={event => { setFilter(event.target.value); setInspectedCell(null); }}/></label>
            {filter.trim() && <span>{visibleRows.length} matches on this page</span>}
            {copyFeedback && <span className={cx('result-copy-feedback', !copyFeedback.copied && 'is-error')} role="status">{copyFeedback.message}</span>}
            <span>Page {pageIndex + 1} of {pageCount}</span>
        </div>
        <div className="data-table-scroll" ref={scrollRef}>
            <table className="data-table" aria-label="Retained query rows">
                <thead><tr><th className="row-number">#</th>{page.columns.map((column, index) => {
                    const pinned = hasHorizontalOverflow && pinnedOffsets.has(index);
                    return <th key={`${column.name}-${index}`} title={`${column.name} · ${column.type}`} className={cx(pinned && 'is-pinned')} style={pinned ? { left: pinnedOffsets.get(index) } : undefined}>
                        <div className="data-column-heading"><span>{column.name}</span>{hasHorizontalOverflow && <button type="button" className="result-column-pin" aria-label={`${pinnedColumns.includes(index) ? 'Unpin' : 'Pin'} ${column.name} column`} aria-pressed={pinnedColumns.includes(index)} onClick={() => togglePinnedColumn(index)}>{pinnedColumns.includes(index) ? 'Pinned' : 'Pin'}</button>}</div>
                        <small>{column.type}</small>
                    </th>;
                })}</tr></thead>
                <tbody>{visibleRows.map(({ row, index: rowIndex }, rowPosition) => <tr key={`${page.offset}-${rowIndex}`} style={{ animationDelay: `${Math.min(rowIndex, 12) * 16}ms` }}>
                    <td className="row-number">{page.offset + rowIndex + 1}</td>
                    {row.map((value, columnIndex) => {
                        const column = page.columns[columnIndex]!;
                        const active = activeCell.rowIndex === rowPosition && activeCell.columnIndex === columnIndex;
                        const pinned = hasHorizontalOverflow && pinnedOffsets.has(columnIndex);
                        const expanded = inspectedCell?.rowIndex === rowIndex && inspectedCell.columnIndex === columnIndex;
                        const copyKey = `${page.offset + rowIndex}:${columnIndex}:raw`;
                        return <td
                            key={columnIndex}
                            id={`result-cell-${rowPosition}-${columnIndex}`}
                            ref={active ? activeCellRef : undefined}
                            tabIndex={active ? 0 : -1}
                            title={displayValue(value)}
                            aria-label={`Row ${page.offset + rowIndex + 1}, ${column.name}`}
                            className={cx(value === null && 'cell-null', pinned && 'is-pinned', expanded && 'json-cell-expanded')}
                            style={pinned ? { left: pinnedOffsets.get(columnIndex) } : undefined}
                            onFocus={() => setActiveCell({ rowIndex: rowPosition, columnIndex })}
                            onClick={() => { setActiveCell({ rowIndex: rowPosition, columnIndex }); inspectJsonCell(rowIndex, columnIndex, column.type, value); }}
                            onKeyDown={event => onCellKeyDown(event, rowPosition, columnIndex, rowIndex, column.type, value)}
                        >
                            {expanded ? <div className="json-cell-inspector">
                                <div className="json-cell-actions" onClick={event => event.stopPropagation()}>
                                    <span>JSON value</span>
                                    <button type="button" className="json-cell-copy" aria-label={inspectedCell.originalText ? 'Copy raw JSON' : 'Copy JSON'} onClick={() => void copyText(copyKey, inspectedCell.originalText ? 'raw JSON' : 'JSON', inspectedCell.raw)}>{copyFeedback?.key === copyKey && copyFeedback.copied ? 'Copied ✓' : inspectedCell.originalText ? 'Copy raw' : 'Copy JSON'}</button>
                                    <button type="button" className="json-cell-copy" aria-label="Copy pretty JSON" onClick={() => void copyText(`${copyKey}:pretty`, 'pretty JSON', inspectedCell.pretty)}>{copyFeedback?.key === `${copyKey}:pretty` && copyFeedback.copied ? 'Copied ✓' : 'Copy pretty'}</button>
                                    <button type="button" className="json-cell-close" aria-label="Close JSON inspection" onClick={closeInspection}>×</button>
                                </div>
                                <pre className="json-cell-pre">{highlightedJson(inspectedCell.pretty).map((token, index) => token.className
                                    ? <span key={index} className={token.className}>{token.text}</span>
                                    : <span key={index}>{token.text}</span>)}</pre>
                            </div> : <>
                                <span className="data-cell-value">{displayValue(value)}</span>
                                <button type="button" tabIndex={active ? 0 : -1} className="result-cell-copy" aria-label={`Copy ${column.name} value from row ${page.offset + rowIndex + 1}`} title="Copy cell value" onFocus={() => setActiveCell({ rowIndex: rowPosition, columnIndex })} onClick={event => { event.stopPropagation(); setActiveCell({ rowIndex: rowPosition, columnIndex }); void copyText(copyKey, `${column.name} value`, displayValue(value)); }}>{copyFeedback?.key === copyKey && copyFeedback.copied ? '✓' : 'Copy'}</button>
                            </>}
                        </td>;
                    })}
                </tr>)}</tbody>
            </table>
            {page.rows.length === 0 ? <div className="no-rows" role="status">{emptyRowsMessage}</div> : visibleRows.length === 0 && <div className="no-rows">No rows match on this page.</div>}
        </div>
        <div className="table-pagination"><span>Showing {page.rows.length.toLocaleString()} of {page.totalRows.toLocaleString()} retained rows <i>·</i> filter applies to this page only</span><div>
            <Button variant="secondary" disabled={pageIndex === 0} onClick={() => { setInspectedCell(null); onPage(0); }}>First</Button>
            <Button variant="secondary" disabled={pageIndex === 0} onClick={() => { setInspectedCell(null); onPage(pageIndex - 1); }}>←</Button>
            <Button variant="secondary" disabled={pageIndex + 1 >= pageCount} onClick={() => { setInspectedCell(null); onPage(pageIndex + 1); }}>→</Button>
            <Button variant="secondary" disabled={pageIndex + 1 >= pageCount} onClick={() => { setInspectedCell(null); onPage(pageCount - 1); }}>Last</Button>
        </div></div>
    </div>;
}

export function ChartView({ result, loading, chart, onChart }: { result?: Result; loading: boolean; chart: Draft['chart']; onChart: (chart: Draft['chart']) => void }) {
    if (loading || !result) return <div className="result-loading"><span className="loading-orbit"/><span>Preparing a chart from retained rows…</span></div>;
    const suggestion = recommendChart(result.columns, result.rows);
    const xIndex = Math.min(chart.x, Math.max(0, result.columns.length - 1));
    const numericIndexes = result.columns.flatMap((column, index) => numericType(column.type) ? [index] : []);
    const yIndex = chart.ys.find(index => numericIndexes.includes(index)) ?? suggestion.config.ys.find(index => numericIndexes.includes(index)) ?? numericIndexes[0] ?? 0;
    const sampledRows = sampleChartRows(result.rows, MAX_CHART_RENDER_POINTS);
    const points = sampledRows.map((row, index) => ({ label: displayValue(row[xIndex]), value: chartNumber(row[yIndex]), index }));
    const values = points.flatMap(point => point.value === null ? [] : [point.value]);
    const min = Math.min(0, ...values), max = Math.max(0, ...values), range = max - min || 1;
    const plotTop = 40, plotBottom = 190, zeroY = plotBottom - ((0 - min) / range) * (plotBottom - plotTop);
    const y = (value: number) => plotBottom - ((value - min) / range) * (plotBottom - plotTop);
    const x = (index: number) => 32 + index * (700 / Math.max(1, points.length - 1));
    const chartKind = chart.kind === 'number' ? 'number' : chart.kind === 'line' ? 'line' : 'bar';
    const rowSummary = sampledRows.length < result.rows.length
        ? `${sampledRows.length.toLocaleString()} sampled rows from ${result.rows.length.toLocaleString()} retained rows`
        : `${values.length.toLocaleString()} plotted points from ${result.rows.length.toLocaleString()} retained rows`;
    const segments: typeof points[] = [];
    let segment: typeof points = [];
    for (const point of points) {
        if (point.value === null) {
            if (segment.length) segments.push(segment);
            segment = [];
        } else segment.push(point);
    }
    if (segment.length) segments.push(segment);
    const barWidth = Math.max(1, Math.min(28, (680 / Math.max(1, points.length)) * .68));
    return <div className="chart-workspace animate-enter">
        <div className="chart-title-row"><div><span className="eyebrow">VISUAL EXPLORATION</span><h3>{chart.title || result.columns[yIndex]?.name || 'Query result'}</h3><p>{suggestion.reason} Long results are evenly sampled for display.</p></div><div className="chart-controls">
            {chartKind !== 'number' && <label>X axis<select value={xIndex} onChange={event => onChart({ ...chart, x: Number(event.target.value) })}>{result.columns.map((column, index) => <option value={index} key={index}>{column.name}</option>)}</select></label>}
            <label>Measure<select value={yIndex} onChange={event => onChart({ ...chart, ys: [Number(event.target.value)] })}>{result.columns.map((column, index) => <option value={index} key={index} disabled={!numericType(column.type)}>{column.name}</option>)}</select></label>
            <label>Type<select value={chartKind} onChange={event => { const option = chartKindOptions.find(candidate => candidate.value === event.target.value); if (option) onChart({ ...chart, kind: option.value }); }}>{chartKindOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div></div>
        {chartKind === 'number' ? result.rows.length !== 1 ? <div className="chart-empty">Number view needs one retained row. Choose Line or Bar for multiple rows.</div> : !numericType(result.columns[yIndex]?.type ?? '') ? <div className="chart-empty">Choose a numeric result column to show one value.</div> : <div className="chart-number-card"><span className="eyebrow">SINGLE VALUE</span><strong>{displayValue(result.rows[0]?.[yIndex])}</strong><span>{result.columns[yIndex]?.name}</span><small>1 retained row · exact result value</small></div>
            : !values.length ? <div className="chart-empty">Choose a numeric result column to plot.</div> : <div className="chart-canvas"><div className="chart-axis-labels"><span>{max.toLocaleString()}</span><span>{((min + max) / 2).toLocaleString()}</span><span>{min.toLocaleString()}</span></div>
            <svg viewBox="0 0 760 230" role="img" aria-label={`${chartKind} chart of ${result.columns[yIndex]?.name}`}>
                <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".28"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
                {[40, 115, 190].map(value => <line key={value} x1="32" x2="732" y1={value} y2={value} className="chart-gridline"/>)}
                <line x1="32" x2="732" y1={zeroY} y2={zeroY} className="chart-zero-line"/>
                {chartKind === 'line' ? <>
                    {segments.filter(pointsInSegment => pointsInSegment.length > 1).map((pointsInSegment, index) => <polygon key={`area-${index}`} points={`${x(pointsInSegment[0]!.index)},${zeroY} ${pointsInSegment.map(point => `${x(point.index)},${y(point.value!)}`).join(' ')} ${x(pointsInSegment.at(-1)!.index)},${zeroY}`} fill="url(#chart-fill)"/>)}
                    {segments.map((pointsInSegment, index) => <polyline key={`line-${index}`} points={pointsInSegment.map(point => `${x(point.index)},${y(point.value!)}`).join(' ')} className="chart-line"/>)}
                    {points.filter(point => point.value !== null).map(point => <circle key={point.index} cx={x(point.index)} cy={y(point.value!)} r="3.5" className="chart-point"/>)}
                </> : points.flatMap(point => {
                    if (point.value === null) return [];
                    const valueY = y(point.value), top = Math.min(zeroY, valueY), height = Math.max(1, Math.abs(valueY - zeroY));
                    return [<rect key={point.index} x={x(point.index) - barWidth / 2} y={top} width={barWidth} height={height} rx="3" className="chart-bar" style={{ animationDelay: `${point.index * 20}ms` }}/>];
                })}
            </svg><div className="chart-x-labels"><span>{points[0]?.label}</span><span>{points[Math.floor(points.length / 2)]?.label}</span><span>{points.at(-1)?.label}</span></div>
        </div>}
        <div className="chart-footer"><span><span className="chart-legend-dot"/>{result.columns[yIndex]?.name}</span><span>{chartKind === 'number' ? result.rows.length === 1 ? '1 value' : `${result.rows.length.toLocaleString()} retained rows` : rowSummary} <i>·</i> {result.completeness === 'truncated' ? 'retained prefix' : 'complete result'}</span></div>
    </div>;
}

export function InsightsView({ run, profile, pipeline, pipelineAvailable, onLoad, onLoadPipeline, loading }: { run: Run; profile?: QueryProfile; pipeline?: ProfilePipeline; pipelineAvailable: boolean; onLoad: () => void; onLoadPipeline: () => void; loading: boolean }) {
    const summary = profile?.summary;
    const plan = pipeline ?? profile?.pipeline;
    const hasClickHousePlan = plan?.source === 'explain_pipeline';
    const metrics = [
        { label: 'Execution time', value: `${Math.round(summary?.durationMs ?? run.elapsedMs)} ms`, icon: 'bolt' },
        { label: 'Rows scanned', value: summary?.readRows ? Number(summary.readRows).toLocaleString() : 'Unavailable', icon: 'schema' },
        { label: 'Data read', value: summary?.readBytes ? formatBytes(summary.readBytes) : 'Unavailable', icon: 'details' },
        { label: 'Peak memory', value: summary?.memory ? formatBytes(summary.memory) : 'Unavailable', icon: 'pipeline' },
        { label: 'Rows returned', value: run.rowCount.toLocaleString(), icon: 'chart' },
        { label: 'Result size', value: formatBytes(run.bytes), icon: 'documents' },
    ] satisfies Array<{ label: string; value: string; icon: IconName }>;
    const measuredStages = plan?.nodes.filter(node => node.status === 'measured').length ?? 0;
    const plannedStages = plan?.nodes.filter(node => node.status === 'planned').length ?? 0;
    const estimatedStages = plan?.nodes.filter(node => node.status === 'estimated').length ?? 0;
    return <div className="insights-view animate-enter">
        <div className="insights-heading"><div><span className="eyebrow">EXECUTION INSIGHTS</span><h3>What happened when this ran?</h3><p>Measurements come from this run's execution and ClickHouse query log.</p></div>{!profile && <Button variant="secondary" onClick={onLoad} disabled={loading}>{loading ? 'Loading…' : 'Load execution details'}</Button>}</div>
        <div className="insight-metrics">{metrics.map(metric => <article className="insight-metric" key={metric.label}><span className="insight-icon"><Icon name={metric.icon}/></span><span className="eyebrow">{metric.label}</span><strong>{metric.value}</strong></article>)}</div>
        <section className="run-analysis" aria-label="Run and query plan comparison">
            <div className="run-analysis-heading"><div><span className="eyebrow">RUN + EXPLAIN</span><strong>Measured execution, then its plan</strong></div>{pipelineAvailable && <Button variant="secondary" className="toolbar-small" onClick={onLoadPipeline} disabled={loading}>{loading ? 'Loading…' : hasClickHousePlan ? 'Refresh pipeline' : 'Load ClickHouse pipeline'}</Button>}</div>
            <div className="run-analysis-columns"><article><span className="eyebrow">THIS RUN</span><strong>{Math.round(summary?.durationMs ?? run.elapsedMs)} ms</strong><small>{summary?.readRows ? `${Number(summary.readRows).toLocaleString()} rows scanned` : 'Scan count unavailable'} · {summary?.readBytes ? formatBytes(summary.readBytes) : 'bytes unavailable'}</small><code>{run.queryId}</code></article><article><span className="eyebrow">QUERY PLAN</span><strong>{plan?.nodes.length ?? 0} operators</strong><small>{hasClickHousePlan ? 'EXPLAIN PIPELINE · ClickHouse' : 'Estimated from SQL shape'}</small><small>{plannedStages} planned · {measuredStages} measured · {estimatedStages} estimated</small></article></div>
            {plan ? <><div className="run-analysis-stages" aria-label="Pipeline stages">{plan.nodes.slice(0, 8).map((node, index) => <span key={node.id}><i>{String(index + 1).padStart(2, '0')}</i><strong>{node.label}</strong><small>{node.status}</small></span>)}{plan.nodes.length > 8 && <small>+{plan.nodes.length - 8} more operators</small>}</div><p className="profile-note">{plan.notice}</p><PipelineGraph pipeline={plan}/></> : <div className="pipeline-graph-empty">{pipelineAvailable ? 'Load the ClickHouse pipeline to inspect its operators and data flow.' : 'Pipeline graph evidence is unavailable for this connection.'}</div>}
        </section>
        {profile?.insights.length ? <div className="insight-list">{profile.insights.map(insight => <article key={insight.id} className={`insight-card severity-${insight.severity}`}><span className="insight-severity">{insight.severity}</span><div><strong>{insight.title}</strong><p>{insight.description}</p></div></article>)}</div> : profile ? <div className="profile-empty">No deterministic issue was identified in the available evidence.</div> : <p className="profile-note">Query log details can take a short time to appear after execution. Values marked unavailable are not inferred.</p>}
        {profile?.notice && <p className="profile-note">{profile.notice}</p>}
    </div>;
}
