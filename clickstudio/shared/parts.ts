export type PartsMetric = 'compressedBytes' | 'rows' | 'marks';
export type PartsLayout = 'treemap' | 'galaxy';

export interface MergeTreePart {
    partition: string;
    name: string;
    rows: string;
    marks: string;
    compressedBytes: string;
    uncompressedBytes: string;
    level: number;
    modifiedAt: string;
}

export interface MergeTreePartsSnapshot {
    database: string;
    table: string;
    parts: MergeTreePart[];
    totalParts: string;
    truncated: boolean;
    measuredAt: string;
    totals: Pick<MergeTreePart, 'rows' | 'marks' | 'compressedBytes' | 'uncompressedBytes'>;
}

export const MAX_MERGETREE_PARTS = 1_000;
const partColumns = ['partition', 'name', 'rows', 'marks', 'compressed_bytes', 'uncompressed_bytes', 'level', 'modified_at', 'total_parts'] as const;

function text(value: unknown, fallback = '') {
    if (typeof value === 'string') return value.slice(0, 500);
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'bigint') return value.toString();
    return fallback;
}

function nonNegativeInteger(value: unknown) {
    const valueText = text(value);
    return /^\d{1,80}$/.test(valueText) ? valueText : '0';
}

function sum(values: readonly string[]) {
    return values.reduce((total, value) => total + BigInt(value), 0n).toString();
}

function rowRecord(value: unknown): Record<string, unknown> | undefined {
    if (Array.isArray(value)) return Object.fromEntries(partColumns.map((key, index) => [key, value[index]]));
    if (value === null || typeof value !== 'object') return undefined;
    return value as Record<string, unknown>;
}

export function parseMergeTreeParts(database: string, table: string, input: readonly unknown[], maxParts = MAX_MERGETREE_PARTS): MergeTreePartsSnapshot {
    const boundedLimit = Number.isSafeInteger(maxParts) ? Math.min(MAX_MERGETREE_PARTS, Math.max(1, maxParts)) : MAX_MERGETREE_PARTS;
    const candidates = input.slice(0, boundedLimit + 1).map(rowRecord).filter((row): row is Record<string, unknown> => Boolean(row));
    const sourceRows = candidates.slice(0, boundedLimit);
    const parts = sourceRows.map(row => {
        const level = Number(nonNegativeInteger(row.level));
        return {
            partition: text(row.partition, '(unpartitioned)') || '(unpartitioned)',
            name: text(row.name, 'unknown part') || 'unknown part',
            rows: nonNegativeInteger(row.rows),
            marks: nonNegativeInteger(row.marks),
            compressedBytes: nonNegativeInteger(row.compressed_bytes ?? row.compressedBytes),
            uncompressedBytes: nonNegativeInteger(row.uncompressed_bytes ?? row.uncompressedBytes),
            level: Math.min(Number.isFinite(level) ? level : 0, 1_000_000),
            modifiedAt: text(row.modified_at ?? row.modifiedAt, 'Unknown'),
        } satisfies MergeTreePart;
    });
    const totals = {
        rows: sum(parts.map(part => part.rows)),
        marks: sum(parts.map(part => part.marks)),
        compressedBytes: sum(parts.map(part => part.compressedBytes)),
        uncompressedBytes: sum(parts.map(part => part.uncompressedBytes)),
    };
    const explicitTotal = sourceRows.length ? nonNegativeInteger(sourceRows[0]!.total_parts ?? sourceRows[0]!.totalParts) : '0';
    const truncated = input.length > boundedLimit || (explicitTotal !== '0' && BigInt(explicitTotal) > BigInt(parts.length));
    return {
        database: database.slice(0, 128),
        table: table.slice(0, 128),
        parts,
        totalParts: explicitTotal === '0' ? String(parts.length + (truncated ? 1 : 0)) : explicitTotal,
        truncated,
        measuredAt: new Date().toISOString(),
        totals,
    };
}

export function partMetric(part: MergeTreePart, metric: PartsMetric) {
    return BigInt(part[metric]);
}

export function scalePartMetrics(parts: readonly MergeTreePart[], metric: PartsMetric) {
    const values = parts.map(part => partMetric(part, metric));
    const maxBits = values.reduce((max, value) => Math.max(max, value === 0n ? 0 : value.toString(2).length), 0);
    const shift = BigInt(Math.max(0, maxBits - 48));
    return values.map(value => {
        if (value === 0n) return 0;
        const scaled = Number(value >> shift);
        return scaled > 0 ? scaled : 1;
    });
}

export function formatCompressionRatio(part: Pick<MergeTreePart, 'compressedBytes' | 'uncompressedBytes'>) {
    const compressed = BigInt(part.compressedBytes), uncompressed = BigInt(part.uncompressedBytes);
    if (compressed <= 0n || uncompressed <= 0n) return '—';
    const ratio = Number((uncompressed * 100n) / compressed) / 100;
    return Number.isFinite(ratio) ? `${ratio.toFixed(ratio < 10 ? 2 : 1)}×` : '—';
}
