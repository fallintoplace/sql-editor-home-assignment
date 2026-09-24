import { useState, type CSSProperties } from 'react';
import { displayValue, recommendChart, chartNumber, numericType, filterRows, sampleChartRows, MAX_CHART_RENDER_POINTS } from '../../shared/results';
import type { ProfilePipeline, QueryProfile, Result, ResultPage, Run } from '../../shared/types';
import type { Draft } from '../workspace-state';
import { PipelineGraph } from './PipelineGraph';
import { Button, cx, formatBytes, Icon, terminal } from './ui';
import type { IconName } from './ui';

const chartKindOptions = [
    { value: 'number', label: 'Number' },
    { value: 'line', label: 'Line' },
    { value: 'bar', label: 'Bar' },
    { value: 'scatter', label: 'Scatter' },
    { value: 'heatmap', label: 'Heatmap' },
] as const satisfies readonly { value: Draft['chart']['kind']; label: string }[];
const chartColors = ['var(--accent)', 'var(--green)', 'var(--amber)', 'var(--red)', 'var(--violet)'] as const;
const seriesColor = (index: number) => chartColors[index % chartColors.length]!;
type ChartPoint = { label: string; value: number | null; index: number };

function splitChartSegments(points: ChartPoint[]) {
    const segments: ChartPoint[][] = [];
    let current: ChartPoint[] = [];
    for (const point of points) {
        if (point.value === null) {
            if (current.length) segments.push(current);
            current = [];
        } else current.push(point);
    }
    if (current.length) segments.push(current);
    return segments;
}

export function ResultGrid({ run, page, pageIndex, loading, onPage }: { run: Run; page?: ResultPage; pageIndex: number; loading: boolean; onPage: (page: number) => void }) {
    const [filter, setFilter] = useState('');
    if (run.resultState === 'expired') return <div className="result-empty-state"><span className="empty-result-icon">⌛</span><strong>Result retention expired</strong><p>The SQL and query ID are still available. Run it again to fetch fresh data.</p></div>;
    if (run.resultState !== 'reopenable') return <div className="result-empty-state"><span className="loading-orbit"/><strong>{terminal(run) ? 'No retained result' : 'Query is running'}</strong><p>{terminal(run) ? 'This run did not produce result rows.' : 'The live execution status appears in the bottom bar.'}</p>{run.error && <div className="callout callout-error mt-4">{run.error.code}: {run.error.message}</div>}</div>;
    if (loading || !page) return <div className="result-loading"><span className="loading-orbit"/><span>Loading retained rows…</span></div>;
    const searchableRows = page.rows.map(row => row.map(value => displayValue(value).toLocaleLowerCase()).join('\u0001'));
    const matchingRows = new Set(filterRows(page.rows, filter, searchableRows));
    const visibleRows = page.rows.flatMap((row, index) => matchingRows.has(row) ? [{ row, index }] : []);
    const pageCount = Math.max(1, Math.ceil(page.totalRows / 200));
    const emptyRowsMessage = page.totalRows > 0
        ? 'No retained rows are available on this page.'
        : page.completeness === 'truncated'
            ? 'No rows fit in the retained result. The query may still have matched rows; the result limits left none to keep.'
            : 'This query returned zero rows.';
    return <div className="result-grid-wrap animate-enter"><div className="result-summary-row"><span><strong>{page.totalRows.toLocaleString()}</strong> rows <i>·</i> <strong>{page.columns.length}</strong> columns</span><span className="result-completeness"><span className={cx('status-light', page.completeness === 'truncated' ? 'is-warning' : 'is-trusted')}/>{page.completeness === 'truncated' ? 'Retained prefix · truncated' : 'Complete result'}</span><label className="result-filter"><span>Find on this page</span><input type="search" aria-label="Filter current page" placeholder="Filter rows" value={filter} onChange={event => setFilter(event.target.value)}/></label>{filter.trim() && <span>{visibleRows.length} matches on this page</span>}<span>Page {pageIndex + 1} of {pageCount}</span></div><div className="data-table-scroll"><table className="data-table" aria-label="Retained query rows"><thead><tr><th className="row-number">#</th>{page.columns.map((column, index) => <th key={`${column.name}-${index}`}><span>{column.name}</span><small>{column.type}</small></th>)}</tr></thead><tbody>{visibleRows.map(({ row, index: rowIndex }) => <tr key={`${page.offset}-${rowIndex}`} style={{ animationDelay: `${Math.min(rowIndex, 12) * 16}ms` }}><td className="row-number">{page.offset + rowIndex + 1}</td>{row.map((value, index) => <td key={index} title={displayValue(value)} className={value === null ? 'cell-null' : ''}>{displayValue(value)}</td>)}</tr>)}</tbody></table>{page.rows.length === 0 ? <div className="no-rows" role="status">{emptyRowsMessage}</div> : visibleRows.length === 0 && <div className="no-rows">No rows match on this page.</div>}</div><div className="table-pagination"><span>Showing {page.rows.length.toLocaleString()} of {page.totalRows.toLocaleString()} retained rows <i>·</i> filter applies to this page only</span><div><Button variant="secondary" disabled={pageIndex === 0} onClick={() => onPage(0)}>First</Button><Button variant="secondary" disabled={pageIndex === 0} onClick={() => onPage(pageIndex - 1)}>←</Button><Button variant="secondary" disabled={pageIndex + 1 >= pageCount} onClick={() => onPage(pageIndex + 1)}>→</Button><Button variant="secondary" disabled={pageIndex + 1 >= pageCount} onClick={() => onPage(pageCount - 1)}>Last</Button></div></div></div>;
}

export function ChartView({ result, loading, chart, onChart }: { result?: Result; loading: boolean; chart: Draft['chart']; onChart: (chart: Draft['chart']) => void }) {
    if (loading || !result) return <div className="result-loading"><span className="loading-orbit"/><span>Preparing a chart from retained rows…</span></div>;
    if (!result.columns.length) return <div className="chart-empty">This result has no columns to chart.</div>;
    const suggestion = recommendChart(result.columns, result.rows);
    const numericIndexes = result.columns.flatMap((column, index) => numericType(column.type) ? [index] : []);
    const chartKind = chart.kind === 'table'
        ? (suggestion.config.kind === 'table' ? 'bar' : suggestion.config.kind)
        : chart.kind;
    const configuredMeasures = [...new Set(chart.ys.filter(index => numericIndexes.includes(index)))];
    const suggestedMeasure = suggestion.config.ys.find(index => numericIndexes.includes(index)) ?? numericIndexes[0];
    const initialMeasure = configuredMeasures[0] ?? suggestedMeasure ?? 0;
    const validChartIndex = (index: number | undefined) => Number.isSafeInteger(index) && index! >= 0 && index! < result.columns.length;
    const initialGroupBy = chart.groupBy !== undefined && validChartIndex(chart.groupBy) && chart.groupBy !== chart.x && chart.groupBy !== initialMeasure
        ? chart.groupBy
        : result.columns.findIndex((_column, index) => index !== chart.x && index !== initialMeasure);
    const allowedX = (index: number) => chartKind === 'scatter'
        ? numericIndexes.includes(index) && index !== initialMeasure
        : chartKind === 'heatmap'
            ? index !== initialMeasure && index !== initialGroupBy
            : index !== initialMeasure;
    const fallbackX = result.columns.findIndex((_column, index) => allowedX(index));
    const xIndex = validChartIndex(chart.x) && allowedX(chart.x)
        ? chart.x
        : fallbackX >= 0 ? fallbackX : 0;
    const candidateGroupBy = chartKind === 'heatmap'
        ? chart.groupBy !== undefined && validChartIndex(chart.groupBy) && chart.groupBy !== xIndex && chart.groupBy !== initialMeasure
            ? chart.groupBy
            : result.columns.findIndex((_column, index) => index !== xIndex && index !== initialMeasure)
        : -1;
    const groupByIndex = candidateGroupBy >= 0 ? candidateGroupBy : undefined;
    const availableMeasures = numericIndexes.filter(index => index !== xIndex && index !== groupByIndex);
    const usableConfiguredMeasures = configuredMeasures.filter(index => availableMeasures.includes(index));
    const defaultMeasure = availableMeasures.includes(suggestedMeasure ?? -1) ? suggestedMeasure! : availableMeasures[0] ?? 0;
    const selectedMeasures = usableConfiguredMeasures.length ? usableConfiguredMeasures : [defaultMeasure];
    const measureIndexes = chartKind === 'line' || chartKind === 'bar' ? selectedMeasures : selectedMeasures.slice(0, 1);
    const yIndex = measureIndexes[0] ?? 0;
    const chartRows = chartKind === 'heatmap' ? result.rows : sampleChartRows(result.rows, MAX_CHART_RENDER_POINTS);
    const plotSeries = measureIndexes.map((columnIndex, seriesIndex) => ({
        columnIndex,
        color: seriesColor(seriesIndex),
        points: chartRows.map((row, index) => ({ label: displayValue(row[xIndex]), value: chartNumber(row[columnIndex]), index })),
    }));
    const values = plotSeries.flatMap(series => series.points.flatMap(point => point.value === null ? [] : [point.value]));
    const min = Math.min(0, ...values), max = Math.max(0, ...values), range = max - min || 1;
    const plotTop = 40, plotBottom = 190, zeroY = plotBottom - ((0 - min) / range) * (plotBottom - plotTop);
    const y = (value: number) => plotBottom - ((value - min) / range) * (plotBottom - plotTop);
    const x = (index: number) => 32 + index * (700 / Math.max(1, chartRows.length - 1));
    const rowSummary = chartRows.length < result.rows.length
        ? `${chartRows.length.toLocaleString()} sampled rows from ${result.rows.length.toLocaleString()} retained rows`
        : `${chartRows.length.toLocaleString()} retained rows across ${measureIndexes.length} measure${measureIndexes.length === 1 ? '' : 's'}`;
    const barWidth = Math.max(1, Math.min(28, (680 / Math.max(1, chartRows.length)) * .68 / measureIndexes.length));
    const heatmapRows = chartKind === 'heatmap' && groupByIndex !== undefined
        ? result.rows.map(row => ({ xLabel: displayValue(row[xIndex]), yLabel: displayValue(row[groupByIndex]), value: chartNumber(row[yIndex]) }))
        : [];
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const heatmapXLabels = [...new Set(heatmapRows.map(row => row.xLabel))].sort(collator.compare);
    const heatmapYLabels = [...new Set(heatmapRows.map(row => row.yLabel))].sort(collator.compare);
    const heatmapCells = new Map<string, number>();
    const heatmapPresent = new Set<string>();
    for (const cell of heatmapRows) {
        const key = `${cell.yLabel}\u0000${cell.xLabel}`;
        heatmapPresent.add(key);
        if (cell.value !== null) heatmapCells.set(key, (heatmapCells.get(key) ?? 0) + cell.value);
    }
    const heatmapMaximum = Math.max(0, ...heatmapCells.values());
    const heatmapTooLarge = heatmapXLabels.length * heatmapYLabels.length > 1_200;
    const compactNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
    const scatterPoints = chartRows.map(row => ({ x: chartNumber(row[xIndex]), y: chartNumber(row[yIndex]), label: displayValue(row[xIndex]) }))
        .filter((point): point is { x: number; y: number; label: string } => point.x !== null && point.y !== null);
    const scatterMinX = Math.min(...scatterPoints.map(point => point.x), 0);
    const scatterMaxX = Math.max(...scatterPoints.map(point => point.x), 0);
    const scatterMinY = Math.min(...scatterPoints.map(point => point.y), 0);
    const scatterMaxY = Math.max(...scatterPoints.map(point => point.y), 0);
    const scatterRangeX = scatterMaxX - scatterMinX || 1;
    const scatterRangeY = scatterMaxY - scatterMinY || 1;
    const scatterX = (value: number) => 32 + ((value - scatterMinX) / scatterRangeX) * 700;
    const scatterY = (value: number) => plotBottom - ((value - scatterMinY) / scatterRangeY) * (plotBottom - plotTop);
    return <div className="chart-workspace animate-enter">
        <div className="chart-title-row"><div><span className="eyebrow">VISUAL EXPLORATION</span><h3>{chart.title || result.columns[yIndex]?.name || 'Query result'}</h3><p>{suggestion.reason} {chartKind === 'heatmap' ? 'Cells come from returned rows; missing groups are left blank.' : 'Long results are evenly sampled for display.'}</p></div><div className="chart-controls">
            {chartKind !== 'number' && <label>{chartKind === 'scatter' ? 'X measure' : 'X axis'}<select value={xIndex} onChange={event => {
                const nextX = Number(event.target.value);
                const nextGroupCandidate = chartKind === 'heatmap' && nextX === groupByIndex ? result.columns.findIndex((_column, index) => index !== nextX && index !== yIndex) : groupByIndex;
                const nextGroupBy = nextGroupCandidate !== undefined && nextGroupCandidate >= 0 ? nextGroupCandidate : undefined;
                onChart({ ...chart, x: nextX, groupBy: nextGroupBy, ys: measureIndexes.filter(index => index !== nextX && index !== nextGroupBy) });
            }}>{result.columns.map((column, index) => <option value={index} key={index} disabled={chartKind === 'scatter' ? !numericIndexes.includes(index) || index === yIndex : index === yIndex || index === groupByIndex}>{column.name}</option>)}</select></label>}
            {chartKind === 'heatmap' && <label>Y axis<select value={groupByIndex ?? -1} onChange={event => onChart({ ...chart, groupBy: Number(event.target.value) })}>{result.columns.map((column, index) => <option value={index} key={index} disabled={index === xIndex || index === yIndex}>{column.name}</option>)}</select></label>}
            {chartKind === 'line' || chartKind === 'bar'
                ? <fieldset className="chart-measures"><legend>Measures</legend>{availableMeasures.map(index => <label key={index}><input type="checkbox" checked={measureIndexes.includes(index)} disabled={measureIndexes.length === 1 && measureIndexes.includes(index)} onChange={event => {
                    const next = event.target.checked ? [...measureIndexes, index] : measureIndexes.filter(value => value !== index);
                    onChart({ ...chart, ys: next.slice(0, 5) });
                }}/><span style={{ '--series-color': seriesColor(Math.max(0, measureIndexes.indexOf(index))) } as CSSProperties}/>{result.columns[index]?.name}</label>)}</fieldset>
                : <label>Measure<select value={yIndex} onChange={event => onChart({ ...chart, ys: [Number(event.target.value)] })}>{numericIndexes.map(index => <option value={index} key={index} disabled={index === xIndex || index === groupByIndex}>{result.columns[index]?.name}</option>)}</select></label>}
            <label>Type<select value={chartKind} onChange={event => {
                const option = chartKindOptions.find(candidate => candidate.value === event.target.value);
                if (!option) return;
                const nextGroupBy = option.value === 'heatmap' ? groupByIndex ?? result.columns.findIndex((_column, index) => index !== xIndex && index !== yIndex) : undefined;
                onChart({ ...chart, kind: option.value, groupBy: nextGroupBy !== undefined && nextGroupBy >= 0 ? nextGroupBy : undefined, ys: option.value === 'line' || option.value === 'bar' ? measureIndexes : [yIndex] });
            }}>{chartKindOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div></div>
        {chartKind === 'number' ? result.rows.length !== 1 ? <div className="chart-empty">Number view needs one retained row. Choose Line or Bar for multiple rows.</div> : !numericType(result.columns[yIndex]?.type ?? '') ? <div className="chart-empty">Choose a numeric result column to show one value.</div> : <div className="chart-number-card"><span className="eyebrow">SINGLE VALUE</span><strong>{displayValue(result.rows[0]?.[yIndex])}</strong><span>{result.columns[yIndex]?.name}</span><small>1 retained row · exact result value</small></div>
            : chartKind === 'heatmap'
                ? heatmapTooLarge ? <div className="chart-empty">This result has too many row and column labels for a readable heatmap. Group it into a smaller grid first.</div>
                    : !heatmapRows.length || groupByIndex === undefined ? <div className="chart-empty">Heatmap needs two dimensions and one numeric measure.</div>
                        : <div className="heatmap-scroll"><table className="heatmap-grid" aria-label={`${result.columns[yIndex]?.name} by ${result.columns[groupByIndex]?.name} and ${result.columns[xIndex]?.name}`}>
                            <thead><tr><th className="heatmap-corner" scope="col">{result.columns[groupByIndex]?.name} / {result.columns[xIndex]?.name}</th>
                            {heatmapXLabels.map(label => <th className="heatmap-axis-label" scope="col" key={`x-${label}`}>{label}</th>)}</tr></thead>
                            <tbody>{heatmapYLabels.map(yLabel => <tr key={`y-${yLabel}`}><th className="heatmap-axis-label heatmap-row-label" scope="row" title={yLabel}>{yLabel}</th>{heatmapXLabels.map(xLabel => {
                                const key = `${yLabel}\u0000${xLabel}`;
                                const value = heatmapCells.get(key);
                                const hasRow = heatmapPresent.has(key);
                                const missing = !hasRow;
                                const cellDescription = missing ? result.completeness === 'truncated' ? 'not retained' : 'no returned row' : value === undefined ? 'null measure' : value.toLocaleString();
                                const plotted = value ?? 0;
                                const intensity = heatmapMaximum > 0 ? plotted / heatmapMaximum : 0;
                                const displayNumber = value === undefined ? '·' : compactNumber.format(value);
                                return <td className="heatmap-cell" key={`${yLabel}-${xLabel}`} title={`${result.columns[groupByIndex]?.name}: ${yLabel} · ${result.columns[xIndex]?.name}: ${xLabel} · ${result.columns[yIndex]?.name}: ${cellDescription}`} aria-label={`${yLabel}, ${xLabel}: ${cellDescription}`} style={{ backgroundColor: missing || value === undefined ? 'var(--panel)' : `color-mix(in srgb, var(--accent) ${Math.round(intensity * 78)}%, var(--panel-raised))`, color: intensity > .55 ? 'var(--accent-ink)' : 'var(--text-soft)' }}>{missing ? '·' : displayNumber}</td>;
                            })}</tr>)}</tbody>
                        </table><div className="heatmap-caption">{result.columns[yIndex]?.name} · {heatmapYLabels.length} rows × {heatmapXLabels.length} columns · {result.completeness === 'truncated' ? 'blank cells may be outside the retained result' : 'blank cells had no returned group'}</div></div>
                : chartKind === 'scatter' && (xIndex === yIndex || !numericIndexes.includes(xIndex) || !numericIndexes.includes(yIndex)) ? <div className="chart-empty">Scatter needs two numeric columns. Choose another result or use Line or Bar.</div>
                    : !values.length ? <div className="chart-empty">Choose a numeric measure to plot.</div>
                    : <div className="chart-canvas"><div className="chart-axis-labels"><span>{max.toLocaleString()}</span><span>{((min + max) / 2).toLocaleString()}</span><span>{min.toLocaleString()}</span></div>
                        <svg viewBox="0 0 760 230" role="img" aria-label={`${chartKind} chart comparing ${result.columns[xIndex]?.name} and ${result.columns[yIndex]?.name}`}>
                            {[40, 115, 190].map(value => <line key={value} x1="32" x2="732" y1={value} y2={value} className="chart-gridline"/>)}
                            {chartKind !== 'scatter' && <line x1="32" x2="732" y1={zeroY} y2={zeroY} className="chart-zero-line"/>}
                            {chartKind === 'scatter' ? scatterPoints.map((point, index) => <circle key={index} cx={scatterX(point.x)} cy={scatterY(point.y)} r="3.5" className="chart-point" style={{ fill: seriesColor(0), stroke: seriesColor(0) }}><title>{`${result.columns[xIndex]?.name}: ${point.x} · ${result.columns[yIndex]?.name}: ${point.y}`}</title></circle>)
                                : chartKind === 'line' ? plotSeries.map(series => {
                                    const segments = splitChartSegments(series.points);
                                    return <g key={series.columnIndex} style={{ '--series-color': series.color } as CSSProperties}>
                                        {segments.filter(points => points.length > 1).map((points, index) => <polygon key={`area-${index}`} points={`${x(points[0]!.index)},${zeroY} ${points.map(point => `${x(point.index)},${y(point.value!)}`).join(' ')} ${x(points.at(-1)!.index)},${zeroY}`} className="chart-area-fill"/>)}
                                        {segments.map((points, index) => <polyline key={`line-${index}`} points={points.map(point => `${x(point.index)},${y(point.value!)}`).join(' ')} className="chart-line"/>)}
                                        {series.points.filter(point => point.value !== null).map(point => <circle key={point.index} cx={x(point.index)} cy={y(point.value!)} r="3.5" className="chart-point"/>)}</g>;
                                }) : plotSeries.flatMap((series, seriesIndex) => series.points.flatMap(point => {
                                    if (point.value === null) return [];
                                    const valueY = y(point.value), top = Math.min(zeroY, valueY), height = Math.max(1, Math.abs(valueY - zeroY));
                                    const groupOffset = (seriesIndex - (plotSeries.length - 1) / 2) * barWidth;
                                    return [<rect key={`${series.columnIndex}-${point.index}`} x={x(point.index) + groupOffset - barWidth / 2} y={top} width={barWidth} height={height} rx="3" className="chart-bar" style={{ '--series-color': series.color, animationDelay: `${point.index * 20}ms` } as CSSProperties}/>];
                                }))}
                        </svg><div className="chart-x-labels">{chartKind === 'scatter'
                            ? <><span>{scatterMinX.toLocaleString()}</span><span>{((scatterMinX + scatterMaxX) / 2).toLocaleString()}</span><span>{scatterMaxX.toLocaleString()}</span></>
                            : <><span>{plotSeries[0]?.points[0]?.label}</span><span>{plotSeries[0]?.points[Math.floor((plotSeries[0]?.points.length ?? 1) / 2)]?.label}</span><span>{plotSeries[0]?.points.at(-1)?.label}</span></>}</div>
                    </div>}
        <div className="chart-footer"><span className="chart-legend">{chartKind === 'heatmap'
            ? <><span className="chart-legend-dot"/>{result.columns[yIndex]?.name}</>
            : chartKind === 'line' || chartKind === 'bar'
                ? measureIndexes.map((index, seriesIndex) => <span key={index}><span className="chart-legend-dot" style={{ backgroundColor: seriesColor(seriesIndex) }}/>{result.columns[index]?.name}</span>)
                : <><span className="chart-legend-dot" style={{ backgroundColor: seriesColor(0) }}/>{result.columns[yIndex]?.name}</>}</span><span>{chartKind === 'number' ? result.rows.length === 1 ? '1 value' : `${result.rows.length.toLocaleString()} retained rows` : chartKind === 'heatmap' ? `${heatmapCells.size.toLocaleString()} populated cells from ${result.rows.length.toLocaleString()} rows` : chartKind === 'scatter' ? `${scatterPoints.length.toLocaleString()} plotted points` : rowSummary} <i>·</i> {result.completeness === 'truncated' ? 'retained prefix' : 'complete result'}</span></div>
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
