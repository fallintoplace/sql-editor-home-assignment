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

test('Playground examples use ClickHouse-owned datasets with chart-ready result shapes', () => {
    const examples = sqlExamplesFor({ id: 'playground', dataSource: 'clickhouse' });
    const byId = new Map(examples.map(example => [example.id, example]));
    const cases = [
        ['hackernews-daily-pulse', 'Hacker News', 'line', 'FROM hackernews.hackernews'],
        ['nyc-taxi-weekly-rhythm', 'NYC Taxi', 'heatmap', 'FROM nyc_taxi.trips_small'],
        ['nyc-taxi-fare-distance', 'NYC Taxi', 'scatter', 'FROM nyc_taxi.trips_small'],
        ['bluesky-activity-by-hour', 'Bluesky', 'heatmap', 'FROM bluesky.events_per_hour_of_day'],
        ['stock-jnj-history', 'Stock sample', 'line', 'FROM stock.stock'],
    ];

    for (const [id, dataset, kind, table] of cases) {
        const example = byId.get(id);
        assert.ok(example, `missing ${id}`);
        assert.equal(example.dataset, dataset);
        assert.equal(example.chart.kind, kind);
        assert.ok(example.sql.includes(table), `${id} should query ${table}`);
        assert.match(example.sql, /^SELECT\b/);
    }

    assert.deepEqual(byId.get('hackernews-daily-pulse')?.chart.ys, [1, 2]);
    for (const id of ['nyc-taxi-weekly-rhythm', 'bluesky-activity-by-hour']) {
        const chart = byId.get(id)?.chart;
        assert.ok(chart?.kind === 'heatmap');
        assert.notEqual(chart.x, chart.groupBy);
        assert.ok(chart.groupBy !== undefined && !chart.ys.includes(chart.groupBy));
        assert.ok(!chart.ys.includes(chart.x));
    }
    assert.match(byId.get('nyc-taxi-fare-distance')?.sql ?? '', /LIMIT 240\s*$/);
    assert.match(byId.get('stock-jnj-history')?.description ?? '', /historical/i);
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
