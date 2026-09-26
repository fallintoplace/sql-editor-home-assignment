import type { SqlExample } from './sql-examples.js';

export const GEO_HELP_EXAMPLE: SqlExample = {
    id: 'clickhouse-geo-cities',
    name: 'Native Point cities',
    description: 'Render native ClickHouse Point values for four European cities and size them by an events measure.',
    dataset: 'ClickHouse Geo',
    category: 'clickhouse',
    sql: `SELECT 'Berlin' AS city, (13.405, 52.52)::Point AS location, 120 AS events
UNION ALL
SELECT 'Paris', (2.3522, 48.8566)::Point, 95
UNION ALL
SELECT 'London', (-0.1276, 51.5072)::Point, 140
UNION ALL
SELECT 'Madrid', (-3.7038, 40.4168)::Point, 80`,
    chart: { kind: 'table', x: 0, ys: [], title: 'Native Point cities' },
};
