import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichSchemaTables } from '../../.core-build/shared/schema.js';

const tables = [
    { database: 'analytics', name: 'events', engine: 'MergeTree' },
    { database: 'archive', name: 'events', engine: 'MergeTree' },
];

test('Schema metadata stays scoped to the matching database and table', () => {
    const result = enrichSchemaTables(tables, {
        tables: [{
            database: 'analytics', name: 'events', orderBy: '(tenant_id, day)', primaryKey: 'tenant_id, day',
            partitionKey: 'toYYYYMM(day)', samplingKey: 'tenant_id', ttlConfigured: true,
            rowEstimate: '18446744073709551615', sizeBytes: '9007199254740993123', uncompressedBytes: null,
            parts: '12', activeParts: '9', skipIndexTypes: ['bloom_filter'],
        }],
        projections: [{ database: 'analytics', table: 'events', name: 'by_day', type: 'Normal', sortingKey: 'day' }],
        skipIndexes: [{ database: 'analytics', table: 'events', name: 'tenant_idx', type: 'bloom_filter', expression: 'tenant_id', granularity: '4' }],
    });

    assert.equal(result[0].rowEstimate, '18446744073709551615');
    assert.equal(result[0].sizeBytes, '9007199254740993123');
    assert.equal(result[0].uncompressedBytes, null);
    assert.deepEqual(result[0].projections, [{ name: 'by_day', type: 'Normal', sortingKey: 'day' }]);
    assert.deepEqual(result[0].skipIndexes, [{ name: 'tenant_idx', type: 'bloom_filter', expression: 'tenant_id', granularity: '4' }]);
    assert.deepEqual(result[1], { ...tables[1], projections: [], skipIndexes: [] });
});

test('Unavailable metadata stays distinguishable from an empty metadata list', () => {
    const unavailable = enrichSchemaTables(tables, {});
    const availableButEmpty = enrichSchemaTables(tables, { tables: [], projections: [], skipIndexes: [] });

    assert.equal('projections' in unavailable[0], false);
    assert.equal('skipIndexes' in unavailable[0], false);
    assert.equal('rowEstimate' in unavailable[0], false);
    assert.deepEqual(availableButEmpty[0].projections, []);
    assert.deepEqual(availableButEmpty[0].skipIndexes, []);
    assert.equal('rowEstimate' in availableButEmpty[0], false);
});

test('Schema enrichment does not mutate the base table list', () => {
    const input = structuredClone(tables);
    enrichSchemaTables(input, { tables: [{ database: 'analytics', name: 'events', ttlConfigured: false }] });
    assert.deepEqual(input, tables);
});
