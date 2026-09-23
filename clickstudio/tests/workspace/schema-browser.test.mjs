import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSchemaTables, indexSchemaColumns } from '../../.workspace-build/shared/schema-browser.js';

const tables = [
    { database: 'analytics', name: 'events', engine: 'MergeTree', orderBy: 'event_id' },
    { database: 'analytics', name: 'users', engine: 'ReplacingMergeTree' },
];
const columns = [
    { database: 'analytics', table: 'events', name: 'event_id', type: 'UInt64' },
    { database: 'analytics', table: 'events', name: 'payload', type: 'String' },
    { database: 'analytics', table: 'users', name: 'email', type: 'String' },
];

test('Schema browser indexes columns once and searches only the matching table columns', () => {
    const index = indexSchemaColumns(columns);
    assert.deepEqual(filterSchemaTables(tables, index, 'email').map(table => table.name), ['users']);
    assert.deepEqual(filterSchemaTables(tables, index, 'payload').map(table => table.name), ['events']);
    assert.deepEqual(filterSchemaTables(tables, index, 'event_id').map(table => table.name), ['events']);
    assert.deepEqual(filterSchemaTables(tables, index, '  '), tables);
    assert.equal(index.get('analytics\u0000events')?.length, 2);
});
