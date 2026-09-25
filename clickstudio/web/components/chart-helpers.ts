import type { Draft } from '../workspace-state';
import type { Copy, Locale } from '../i18n';

export const chartKindOptions = [
    { value: 'number' },
    { value: 'line' },
    { value: 'bar' },
    { value: 'scatter' },
    { value: 'heatmap' },
    { value: 'candlestick' },
] as const satisfies readonly { value: Draft['chart']['kind'] }[];

const chartColors = ['var(--accent)', 'var(--green)', 'var(--amber)', 'var(--red)', 'var(--violet)'] as const;
export const seriesColor = (index: number) => chartColors[index % chartColors.length]!;
export type ChartPoint = { label: string; value: number | null; index: number };

export function chartText(template: string, values: Record<string, string | number> = {}) {
    return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ''));
}

export function chartTypeLabel(kind: Draft['chart']['kind'], copy: Copy['chart']) {
    return ({ number: copy.numberType, line: copy.lineType, bar: copy.barType, scatter: copy.scatterType, heatmap: copy.heatmapType, candlestick: copy.candlestickType, table: copy.queryResult })[kind];
}

export function formatCount(value: number, locale: Locale) {
    return new Intl.NumberFormat(locale).format(value);
}

export function splitChartSegments(points: ChartPoint[]) {
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
