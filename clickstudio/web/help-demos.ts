import type { SqlExample } from './sql-examples.js';

export const GEO_HELP_EXAMPLE: SqlExample = {
    id: 'clickhouse-geo-cities',
    name: 'Native Point cities',
    description: 'Compare sample event volume across four cities in the Americas, Europe, and Asia using native ClickHouse Point values.',
    dataset: 'ClickHouse Geo',
    category: 'clickhouse',
    sql: `SELECT 'San Francisco' AS city, (-122.4194, 37.7749)::Point AS location, 240 AS events
UNION ALL
SELECT 'São Paulo', (-46.6333, -23.5505)::Point, 180
UNION ALL
SELECT 'Berlin', (13.405, 52.52)::Point, 120
UNION ALL
SELECT 'Singapore', (103.8198, 1.3521)::Point, 310`,
    chart: { kind: 'table', x: 0, ys: [], title: 'Native Point cities' },
};
