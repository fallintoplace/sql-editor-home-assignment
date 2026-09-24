import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYGROUND_STARTER_SQL } from '../../.workspace-build/web/playground.js';
import { sqlExamplesFor } from '../../.workspace-build/web/sql-examples.js';

test('SQL example catalogs match the selected Playground or fixture source', () => {
    const playground = sqlExamplesFor({ id: 'playground', dataSource: 'clickhouse' });
    const fixtures = sqlExamplesFor({ id: 'demo', dataSource: 'fixture' });

    assert.equal(playground[0]?.sql, PLAYGROUND_STARTER_SQL);
    assert.ok(playground.some(example => example.name === 'Daily activity' && example.sql.includes('FROM github.events')));
    assert.ok(fixtures.some(example => example.name === 'Top countries' && example.sql.includes('FROM events')));
    assert.notEqual(fixtures[0]?.sql, playground[0]?.sql);
    assert.equal(new Set(playground.map(example => example.id)).size, playground.length);
    assert.equal(new Set(fixtures.map(example => example.id)).size, fixtures.length);
});

test('SQL examples use safe generic queries until a real connection schema is available', () => {
    const connection = { id: 'production', dataSource: 'clickhouse' };
    const generic = sqlExamplesFor(connection);
    assert.deepEqual(generic.map(example => example.name), ['ClickHouse version', 'Server time', 'Generate a number series']);
    assert.ok(generic.every(example => /^SELECT/.test(example.sql)));

    const schema = {
        connectionId: 'production', fetchedAt: '2026-09-24T00:00:00.000Z', columns: [], warnings: [], truncated: false,
        tables: [
            { database: 'system', name: 'tables' },
            { database: 'information_schema', name: 'columns' },
            { database: 'analytics`archive', name: 'event`log' },
        ],
    };
    const examples = sqlExamplesFor(connection, schema);
    const preview = examples.find(example => example.name === 'Preview analytics`archive.event`log');
    assert.ok(preview);
    assert.match(preview.sql, /FROM `analytics``archive`\.`event``log`\nLIMIT 50$/);
    assert.equal(examples.some(example => example.name.includes('system.') || example.name.includes('information_schema.')), false);
});

test('Schema examples expose only the first six non-system tables', () => {
    const connection = { id: 'production', dataSource: 'clickhouse' };
    const schema = {
        connectionId: 'production', fetchedAt: '', columns: [], warnings: [], truncated: false,
        tables: [
            ...Array.from({ length: 8 }, (_, index) => ({ database: 'analytics', name: `table_${index}` })),
            { database: 'system', name: 'tables' },
        ],
    };
    const tableExamples = sqlExamplesFor(connection, schema).filter(example => example.category === 'schema');
    assert.equal(tableExamples.length, 6);
    assert.deepEqual(tableExamples.map(example => example.name), Array.from({ length: 6 }, (_, index) => `Preview analytics.table_${index}`));
});
