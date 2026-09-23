import { useState } from 'react';
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
] as const satisfies readonly { value: Draft['chart']['kind']; label: string }[];

export function ResultGrid({ run, page, pageIndex, loading, onPage }: { run: Run; page?: ResultPage; pageIndex: number; loading: boolean; onPage: (page: number) => void }) {
    const [filter, setFilter] = useState('');
    if (run.resultState === 'expired') return <div className="result-empty-state"><span className="empty-result-icon">⌛</span><strong>Result retention expired</strong><p>The SQL and query ID are still available. Run it again to fetch fresh data.</p></div>;
    if (run.resultState !== 'reopenable') return <div className="result-empty-state"><span className="loading-orbit"/><strong>{terminal(run) ? 'No retained result' : 'Query is running'}</strong><p>{terminal(run) ? 'This run did not produce result rows.' : 'The live execution status appears in the bottom bar.'}</p>{run.error && <div className="callout callout-error mt-4">{run.error.code}: {run.error.message}</div>}</div>;
    if (loading || !page) return <div className="result-loading"><span className="loading-orbit"/><span>Loading retained rows…</span></div>;
    const searchableRows = page.rows.map(row => row.map(value => displayValue(value).toLocaleLowerCase()).join('\u0001'));
    const matchingRows = new Set(filterRows(page.rows, filter, searchableRows));
    const visibleRows = page.rows.flatMap((row, index) => matchingRows.has(row) ? [{ row, index }] : []);
    const pageCount = Math.max(1, Math.ceil(page.totalRows / 200));
    return <div className="result-grid-wrap animate-enter"><div className="result-summary-row"><span><strong>{page.totalRows.toLocaleString()}</strong> rows <i>·</i> <strong>{page.columns.length}</strong> columns</span><span className="result-completeness"><span className={cx('status-light', page.completeness === 'truncated' ? 'is-warning' : 'is-trusted')}/>{page.completeness === 'truncated' ? 'Retained prefix · truncated' : 'Complete result'}</span><label className="result-filter"><span>Find on this page</span><input type="search" aria-label="Filter current page" placeholder="Filter rows" value={filter} onChange={event => setFilter(event.target.value)}/></label>{filter.trim() && <span>{visibleRows.length} matches on this page</span>}<span>Page {pageIndex + 1} of {pageCount}</span></div><div className="data-table-scroll"><table className="data-table" aria-label="Retained query rows"><thead><tr><th className="row-number">#</th>{page.columns.map((column, index) => <th key={`${column.name}-${index}`}><span>{column.name}</span><small>{column.type}</small></th>)}</tr></thead><tbody>{visibleRows.map(({ row, index: rowIndex }) => <tr key={`${page.offset}-${rowIndex}`} style={{ animationDelay: `${Math.min(rowIndex, 12) * 16}ms` }}><td className="row-number">{page.offset + rowIndex + 1}</td>{row.map((value, index) => <td key={index} title={displayValue(value)} className={value === null ? 'cell-null' : ''}>{displayValue(value)}</td>)}</tr>)}</tbody></table>{page.rows.length === 0 ? <div className="no-rows">This query returned zero rows.</div> : visibleRows.length === 0 && <div className="no-rows">No rows match on this page.</div>}</div><div className="table-pagination"><span>Showing {page.rows.length.toLocaleString()} of {page.totalRows.toLocaleString()} retained rows <i>·</i> filter applies to this page only</span><div><Button variant="secondary" disabled={pageIndex === 0} onClick={() => onPage(0)}>First</Button><Button variant="secondary" disabled={pageIndex === 0} onClick={() => onPage(pageIndex - 1)}>←</Button><Button variant="secondary" disabled={pageIndex + 1 >= pageCount} onClick={() => onPage(pageIndex + 1)}>→</Button><Button variant="secondary" disabled={pageIndex + 1 >= pageCount} onClick={() => onPage(pageCount - 1)}>Last</Button></div></div></div>;
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
