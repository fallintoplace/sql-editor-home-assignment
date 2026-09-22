import { useEffect, useRef, useState } from 'react';
import type { ChartConfig, Result } from '../../shared/types';
import { chartNumber, displayValue, MAX_CHART_POINTS, MAX_CHART_SERIES } from '../../shared/results';
import { Callout } from '../ui';
export function Chart({ result, config, onFilter }: {
    result: Result;
    config: ChartConfig;
    onFilter?: (column: string, value: string | null) => void;
}) {
    const element = useRef<HTMLDivElement>(null), [error, setError] = useState('');
    useEffect(() => {
        let disposed = false;
        let chart: import('echarts').ECharts | undefined;
        let resize: ResizeObserver | undefined;
        setError('');
        if (config.kind === 'table' || config.kind === 'number')
            return;
        if (config.ys.length > MAX_CHART_SERIES) {
            setError(`Charts support at most ${MAX_CHART_SERIES} measures.`);
            return;
        }
        void import('echarts').then(echarts => {
            if (disposed || !element.current)
                return;
            const x = result.columns[config.x];
            if (!x)
                throw new Error('Choose an existing X-axis column.');
            if (!config.ys.length || config.ys.some(y => !result.columns[y]))
                throw new Error('Choose at least one existing numeric series.');
            const points = result.rows.length <= MAX_CHART_POINTS ? result.rows : result.rows.filter((_row, index) => index % Math.ceil(result.rows.length / MAX_CHART_POINTS) === 0).slice(0, MAX_CHART_POINTS);
            chart = echarts.init(element.current, undefined, { renderer: 'canvas' });
            const labels = points.map(r => displayValue(r[config.x]));
            const series = config.ys.map(y => ({ name: result.columns[y]!.name, type: config.kind === 'area' ? 'line' : config.kind === 'stacked' ? 'bar' : config.kind,
                ...(config.kind === 'stacked' ? { stack: 'total' } : {}), ...(config.kind === 'area' ? { areaStyle: {} } : {}),
                data: config.kind === 'pie' ? points.map((r, i) => ({ name: labels[i], value: chartNumber(r[y]) })) : config.kind === 'scatter' ? points.map(r => [chartNumber(r[config.x]), chartNumber(r[y])]) : points.map(r => chartNumber(r[y])), connectNulls: false }));
            chart.setOption({ animation: false, tooltip: { trigger: config.kind === 'pie' ? 'item' : 'axis', renderMode: 'richText' }, legend: { show: config.ys.length > 1 }, grid: { containLabel: true, left: 16, right: 16, bottom: 30, top: 35 },
                ...(config.kind === 'pie' ? {} : { xAxis: config.kind === 'scatter' ? { type: 'value' } : { type: 'category', data: labels }, yAxis: { type: 'value' } }), series });
            chart.on('click', params => { const index = (params as {
                dataIndex?: number;
            }).dataIndex; if (index !== undefined && points[index])
                onFilter?.(x.name, points[index]![config.x] === null ? null : displayValue(points[index]![config.x])); });
            resize = new ResizeObserver(() => chart?.resize());
            resize.observe(element.current);
        }).catch(e => { if (!disposed)
            setError(e instanceof Error ? e.message : 'Chart unavailable'); });
        return () => { disposed = true; resize?.disconnect(); chart?.dispose(); };
    }, [result, config, onFilter]);
    if (config.kind === 'table')
        return null;
    if (config.kind === 'number') {
        const y = config.ys[0];
        return <div className="big-stat"><span>{y === undefined ? 'Select a measure' : result.columns[y]?.name}</span><strong>{displayValue(y === undefined ? undefined : result.rows[0]?.[y])}</strong><small>First retained row; no aggregation is applied.</small></div>;
    }
    return <><div ref={element} className="chart-canvas" role="img" aria-label={config.title || 'Query result chart'}/>{error && <Callout danger>{error} The typed table remains available.</Callout>}<p className="muted">{result.rows.length > MAX_CHART_POINTS ? `Chart sampled ${MAX_CHART_POINTS.toLocaleString()} of ${result.rows.length.toLocaleString()} retained rows.` : `Chart displays all ${result.rows.length.toLocaleString()} retained rows.`} Chart coordinates use finite JavaScript numbers. Unsafe integer coordinates are omitted; the table and JSON retain exact values. Click a mark to draft a child filter.</p></>;
}
