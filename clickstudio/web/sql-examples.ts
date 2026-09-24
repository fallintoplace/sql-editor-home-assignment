import type { Connection, Schema } from '../shared/types.js';
import { DEMO_PREVIEW_STARTERS } from './demo-preview.js';
import { PLAYGROUND_CONNECTION_ID, PLAYGROUND_STARTER_SQL } from './playground.js';

export type SqlExampleCategory = 'basics' | 'aggregation' | 'timeSeries' | 'schema';

export type SqlExample = {
    id: string;
    name: string;
    description: string;
    category: SqlExampleCategory;
    sql: string;
};

const playgroundExamples: SqlExample[] = [
    {
        id: 'github-recent-events', name: 'Recent GitHub events', category: 'basics',
        description: 'Inspect real events, repositories, actors, and timestamps.', sql: PLAYGROUND_STARTER_SQL,
    },
    {
        id: 'github-events-by-type', name: 'Events by type', category: 'aggregation',
        description: 'Count events for each ClickHouse event type.',
        sql: `SELECT
    event_type,
    count() AS events
FROM github.events
GROUP BY event_type
ORDER BY events DESC
LIMIT 20`,
    },
    {
        id: 'github-top-repositories', name: 'Top repositories', category: 'aggregation',
        description: 'Find repositories with the most recorded events.',
        sql: `SELECT
    repo_name,
    count() AS events
FROM github.events
WHERE repo_name != ''
GROUP BY repo_name
ORDER BY events DESC
LIMIT 10`,
    },
    {
        id: 'github-active-contributors', name: 'Active contributors', category: 'aggregation',
        description: 'Rank actors by their number of recorded events.',
        sql: `SELECT
    actor_login,
    count() AS events
FROM github.events
WHERE actor_login != ''
GROUP BY actor_login
ORDER BY events DESC
LIMIT 10`,
    },
    {
        id: 'github-daily-activity', name: 'Daily activity', category: 'timeSeries',
        description: 'Plot event volume by calendar day.',
        sql: `SELECT
    toDate(created_at) AS day,
    count() AS events
FROM github.events
GROUP BY day
ORDER BY day DESC
LIMIT 30`,
    },
    {
        id: 'github-pushes-by-repository', name: 'Pushes by repository', category: 'aggregation',
        description: 'Compare repositories by their number of push events.',
        sql: `SELECT
    repo_name,
    count() AS pushes
FROM github.events
WHERE event_type = 'PushEvent'
GROUP BY repo_name
ORDER BY pushes DESC
LIMIT 10`,
    },
];

const demoStarterDetails: Record<string, Pick<SqlExample, 'description' | 'category'>> = {
    'preview-starter-getting-started': { description: 'Explore daily activity, unique users, and revenue.', category: 'timeSeries' },
    'preview-starter-top-countries': { description: 'Compare event volume and users across countries.', category: 'aggregation' },
    'preview-starter-revenue-channel': { description: 'Compare completed orders and average value by channel.', category: 'aggregation' },
    'preview-starter-latency': { description: 'Compare request latency at the 50th, 95th, and 99th percentiles.', category: 'aggregation' },
    'preview-starter-hourly': { description: 'Track hourly event volume and server errors.', category: 'timeSeries' },
    'preview-starter-funnel': { description: 'Compare users across signup funnel steps.', category: 'aggregation' },
    'preview-starter-device-engagement': { description: 'Compare sessions and conversion by device.', category: 'aggregation' },
    'preview-starter-customer-value': { description: 'Compare average customer value by plan.', category: 'aggregation' },
    'preview-starter-daily-rollup': { description: 'Read the pre-aggregated daily metrics table.', category: 'timeSeries' },
};

const demoExamples: SqlExample[] = DEMO_PREVIEW_STARTERS.map(starter => ({
    id: starter.id,
    name: starter.name.replace(/\.sql$/i, ''),
    description: demoStarterDetails[starter.id]?.description ?? 'Explore the sample ClickHouse data.',
    category: demoStarterDetails[starter.id]?.category ?? 'basics',
    sql: starter.sql,
}));

const genericExamples: SqlExample[] = [
    {
        id: 'clickhouse-server-version', name: 'ClickHouse version', category: 'basics',
        description: 'Check which ClickHouse version serves this connection.',
        sql: 'SELECT version() AS clickhouse_version',
    },
    {
        id: 'clickhouse-server-time', name: 'Server time', category: 'basics',
        description: 'Read the current time from the ClickHouse server.',
        sql: 'SELECT now() AS server_time',
    },
    {
        id: 'clickhouse-numbers', name: 'Generate a number series', category: 'basics',
        description: 'Use the numbers table function to create a small result set.',
        sql: `SELECT
    number,
    number * number AS squared
FROM numbers(10)
ORDER BY number`,
    },
];

const quoteIdentifier = (value: string) => `\`${value.replaceAll('`', '``')}\``;

export function sqlExamplesFor(connection: Pick<Connection, 'id' | 'dataSource'>, schema?: Schema): SqlExample[] {
    if (connection.id === PLAYGROUND_CONNECTION_ID) return playgroundExamples;
    if (connection.dataSource === 'fixture') return demoExamples;

    const tableExamples: SqlExample[] = (schema?.tables ?? [])
        .filter(table => !['system', 'information_schema'].includes(table.database.toLowerCase()))
        .slice(0, 6)
        .map(table => ({
            id: `table-preview-${table.database}.${table.name}`,
            name: `Preview ${table.database}.${table.name}`,
            description: 'Read up to 50 rows from this table.',
            category: 'schema',
            sql: `SELECT *\nFROM ${quoteIdentifier(table.database)}.${quoteIdentifier(table.name)}\nLIMIT 50`,
        }));

    return [...genericExamples, ...tableExamples];
}
