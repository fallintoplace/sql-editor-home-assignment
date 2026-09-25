import type { ClickHouseDocumentationEntry, ReferenceCategory } from '../shared/types.js';
import { POPULAR_REFERENCE, REFERENCE_TYPES_BY_CATEGORY, referenceId } from '../shared/reference.js';

export const BUNDLED_REFERENCE: readonly ClickHouseDocumentationEntry[] = [
    { name: 'MergeTree', type: 'Table Engine', description: 'The MergeTree family is designed for high insert throughput and analytical queries. Choose an `ORDER BY` key that matches common filters and grouping patterns.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'ReplacingMergeTree', type: 'Table Engine', description: 'A MergeTree engine that removes rows with matching sorting keys during background merges. Deduplication is eventual; use `FINAL` only when its cost is acceptable.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'SummingMergeTree', type: 'Table Engine', description: 'A MergeTree engine that combines rows with the same sorting key by summing selected numeric columns during merges.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'LowCardinality', type: 'Data Type', description: 'A dictionary-encoded type modifier that can reduce storage and improve processing when a column contains relatively few distinct values.\n\n```sql\nstatus LowCardinality(String)\n```', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'Nullable', type: 'Data Type', description: 'A type modifier that allows a column to contain `NULL`. Nullable columns use additional storage and can add processing overhead.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'DateTime64', type: 'Data Type', description: 'A date and time type with configurable subsecond precision.\n\n```sql\nDateTime64(3, \'UTC\')\n```', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'uniq', type: 'Aggregate Function', description: 'Estimates the number of distinct values using an adaptive sampling algorithm. Use `uniqExact` when an exact count is required.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'uniqExact', type: 'Aggregate Function', description: 'Counts distinct values exactly. Its memory use grows with the number of distinct values.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'quantile', type: 'Aggregate Function', description: 'Computes an approximate quantile. The result uses a sampling-based algorithm; use an exact variant when exact results are required.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'quantileExact', type: 'Aggregate Function', description: 'Computes an exact quantile by retaining values for the calculation. This can use substantially more memory than approximate quantile functions.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'arrayJoin', type: 'Function', description: 'Expands an array into multiple rows. Each source row can produce one output row for every array element.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'toStartOfInterval', type: 'Function', description: 'Rounds a date or time down to the start of an interval, which is useful for time-bucketed analysis.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'max_threads', type: 'Setting', description: 'Limits the maximum number of query-processing threads. The effective value can also depend on user profiles and server configuration.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'query_log', type: 'System Table', description: 'Stores query execution records for the current server. Logging and flush intervals affect when recent records become visible.\n\n```sql\nSELECT query, event_time, query_duration_ms\nFROM system.query_log\nORDER BY event_time DESC\nLIMIT 20\n```', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'parts', type: 'System Table', description: 'Exposes data parts for MergeTree tables, including their ranges, row counts, and active state.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'Parquet', type: 'Format', description: 'A columnar file format supported by ClickHouse for reading and writing analytical data.', serverVersion: 'Demo catalog', origin: 'bundled' },
    { name: 'JSONEachRow', type: 'Format', description: 'A JSON format that represents each result row as one JSON object, with column names as keys.', serverVersion: 'Demo catalog', origin: 'bundled' },
];

function displayName(entry: Pick<ClickHouseDocumentationEntry, 'name' | 'type'>) {
    return entry.type === 'System Table' ? `system.${entry.name}` : entry.name;
}

function inCategory(entry: ClickHouseDocumentationEntry, category: ReferenceCategory) {
    return category === 'all' || REFERENCE_TYPES_BY_CATEGORY[category].includes(entry.type);
}

export function searchBundledReference(query: string, category: ReferenceCategory): ClickHouseDocumentationEntry[] {
    const search = query.trim().toLocaleLowerCase();
    const popularOrder = new Map(POPULAR_REFERENCE.map((entry, index) => [referenceId(entry), index]));
    return BUNDLED_REFERENCE
        .filter(entry => inCategory(entry, category))
        .map(entry => {
            const name = displayName(entry).toLocaleLowerCase();
            const type = entry.type.toLocaleLowerCase();
            const description = entry.description.toLocaleLowerCase();
            const score = !search ? 0 : name === search ? 0 : name.startsWith(search) ? 1 : name.includes(search) ? 2 : type.includes(search) || description.includes(search) ? 3 : -1;
            return { entry, score };
        })
        .filter(item => item.score >= 0)
        .sort((left, right) => {
            if (search) return left.score - right.score || left.entry.name.localeCompare(right.entry.name) || left.entry.type.localeCompare(right.entry.type);
            if (category === 'all') return (popularOrder.get(referenceId(left.entry)) ?? Number.MAX_SAFE_INTEGER) - (popularOrder.get(referenceId(right.entry)) ?? Number.MAX_SAFE_INTEGER);
            return left.entry.name.localeCompare(right.entry.name) || left.entry.type.localeCompare(right.entry.type);
        })
        .slice(0, 30)
        .map(item => item.entry);
}

export function findBundledReference(name: string, type: string) {
    return BUNDLED_REFERENCE.find(entry => entry.name === name && entry.type === type);
}
