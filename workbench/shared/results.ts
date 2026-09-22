import type { ChartConfig, Column, Json, Result, Row } from './types.js';
export function displayValue(value: Json | undefined): string {
    if (value === null || value === undefined)
        return 'NULL';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
export function baseType(type: string): string {
    while (/^(Nullable|LowCardinality)\(/.test(type))
        type = type.slice(type.indexOf('(') + 1, -1);
    return type;
}
export function numericType(type: string) { return /^(U?Int\d+|Float\d+|Decimal)/.test(baseType(type)); }
export function chartNumber(value: Json | undefined): number | null {
    if (value === null || value === undefined || typeof value === 'object' || typeof value === 'boolean' || value === '')
        return null;
    const n = Number(value);
    if (!Number.isFinite(n) || (Number.isInteger(n) && !Number.isSafeInteger(n)))
        return null;
    return n;
}
export function recommendChart(columns: Column[], rows: Row[]): {
    config: ChartConfig;
    reason: string;
} {
    const numeric = columns.flatMap((c, i) => numericType(c.type) ? [i] : []);
    if (!numeric.length)
        return { config: { kind: 'table', x: 0, ys: [], title: 'Query result' }, reason: 'No numeric measure; preserve the typed table.' };
    if (rows.length === 1)
        return { config: { kind: 'number', x: 0, ys: [numeric[0]!], title: columns[numeric[0]!]!.name }, reason: 'One row with a numeric measure.' };
    const time = columns.findIndex(c => /^Date/.test(baseType(c.type)));
    const category = columns.findIndex((_, i) => !numeric.includes(i));
    const x = time >= 0 ? time : category >= 0 ? category : 0;
    const ys = numeric.filter(i => i !== x).slice(0, 4);
    if (!ys.length)
        ys.push(numeric[0]!);
    return { config: { kind: time >= 0 ? 'line' : 'bar', x, ys, title: 'Query result' },
        reason: time >= 0 ? 'A date/time dimension with numeric measures.' : 'A dimension with numeric measures; no hidden aggregation is performed.' };
}
export function filterRows(rows: Row[], term: string): Row[] {
    const needle = term.toLocaleLowerCase();
    return needle ? rows.filter(r => r.some(v => displayValue(v).toLocaleLowerCase().includes(needle))) : rows;
}
export function csvCell(value: Json | undefined): string {
    let cell = value === null || value === undefined ? '' : displayValue(value);
    // Make CSV safe to open in spreadsheet programs; JSON export remains exact.
    if (/^[\t\r\n ]*[=+\-@]/.test(cell))
        cell = "'" + cell;
    return /[",\r\n]/.test(cell) ? '"' + cell.replace(/"/g, '""') + '"' : cell;
}
export function exportCsv(result: Pick<Result, 'columns' | 'rows'>): string {
    return [result.columns.map(c => csvCell(c.name)).join(','), ...result.rows.map(r => r.map(csvCell).join(','))].join('\r\n');
}
export function columnStats(rows: Row[], index: number) {
    let nulls = 0;
    const values = new Set<string>();
    const numbers: number[] = [];
    for (const row of rows) {
        const value = row[index];
        if (value === null || value === undefined) {
            nulls++;
            continue;
        }
        values.add(displayValue(value));
        const n = chartNumber(value);
        if (n !== null)
            numbers.push(n);
    }
    return { scope: 'retained rows only' as const, rows: rows.length, nulls, distinct: values.size,
        min: numbers.length ? numbers.reduce((a, b) => Math.min(a, b)) : null,
        max: numbers.length ? numbers.reduce((a, b) => Math.max(a, b)) : null };
}
