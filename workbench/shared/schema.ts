import type { SchemaProjection, SchemaSkipIndex, SchemaTable } from './types.js';

export type SchemaTableMetadata = Pick<SchemaTable,
    'orderBy' | 'primaryKey' | 'partitionKey' | 'samplingKey' | 'ttlConfigured' | 'materializedViewTarget'
    | 'rowEstimate' | 'sizeBytes' | 'uncompressedBytes' | 'parts' | 'activeParts' | 'skipIndexTypes'> & {
        database: string;
        name: string;
    };

export type SchemaTableProjection = SchemaProjection & { database: string; table: string };
export type SchemaTableSkipIndex = SchemaSkipIndex & { database: string; table: string };

export function enrichSchemaTables(
    tables: SchemaTable[],
    metadata: {
        tables?: SchemaTableMetadata[];
        projections?: SchemaTableProjection[];
        skipIndexes?: SchemaTableSkipIndex[];
    },
): SchemaTable[] {
    const key = (database: string, table: string) => `${database}\0${table}`;
    const tableDetails = new Map((metadata.tables ?? []).map(detail => [key(detail.database, detail.name), detail]));
    const projections = new Map<string, SchemaProjection[]>();
    const skipIndexes = new Map<string, SchemaSkipIndex[]>();

    for (const projection of metadata.projections ?? []) {
        const tableKey = key(projection.database, projection.table);
        const entries = projections.get(tableKey) ?? [];
        entries.push({ name: projection.name, type: projection.type, sortingKey: projection.sortingKey });
        projections.set(tableKey, entries);
    }
    for (const index of metadata.skipIndexes ?? []) {
        const tableKey = key(index.database, index.table);
        const entries = skipIndexes.get(tableKey) ?? [];
        entries.push({ name: index.name, type: index.type, expression: index.expression, granularity: index.granularity });
        skipIndexes.set(tableKey, entries);
    }

    return tables.map(table => {
        const detail = tableDetails.get(key(table.database, table.name));
        const enriched: SchemaTable = { ...table };
        if (detail) {
            const { database: _database, name: _name, ...fields } = detail;
            Object.assign(enriched, fields);
        }
        if (metadata.projections !== undefined)
            enriched.projections = projections.get(key(table.database, table.name)) ?? [];
        if (metadata.skipIndexes !== undefined)
            enriched.skipIndexes = skipIndexes.get(key(table.database, table.name)) ?? [];
        return enriched;
    });
}
