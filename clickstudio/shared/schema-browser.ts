import type { SchemaColumn, SchemaTable } from './types.js';

export type SchemaColumnsByTable = ReadonlyMap<string, readonly SchemaColumn[]>;

export function schemaTableKey(database: string, table: string) {
    return `${database}\u0000${table}`;
}

export function indexSchemaColumns(columns: readonly SchemaColumn[]): SchemaColumnsByTable {
    const index = new Map<string, SchemaColumn[]>();
    for (const column of columns) {
        const key = schemaTableKey(column.database, column.table), grouped = index.get(key) ?? [];
        grouped.push(column);
        index.set(key, grouped);
    }
    return index;
}

function tableSearchText(table: SchemaTable) {
    return [
        table.database, table.name, table.engine, table.orderBy, table.primaryKey, table.partitionKey, table.samplingKey,
        table.materializedViewTarget, table.rowEstimate, table.sizeBytes, table.uncompressedBytes,
        table.parts, table.activeParts, table.ttlConfigured === undefined ? '' : table.ttlConfigured ? 'ttl configured' : 'no ttl',
        table.skipIndexTypes?.join(' '),
        ...(table.projections ?? []).flatMap(projection => [projection.name, projection.type, projection.sortingKey]),
        ...(table.skipIndexes ?? []).flatMap(index => [index.name, index.type, index.expression, index.granularity]),
    ].filter(Boolean).join(' ').toLowerCase();
}

export function filterSchemaTables(tables: readonly SchemaTable[], columnsByTable: SchemaColumnsByTable, search: string) {
    const query = search.trim().toLowerCase();
    if (!query)
        return tables;
    return tables.filter(table => {
        if (tableSearchText(table).includes(query))
            return true;
        return (columnsByTable.get(schemaTableKey(table.database, table.name)) ?? [])
            .some(column => `${column.name} ${column.type}`.toLowerCase().includes(query));
    });
}
