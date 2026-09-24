import type { ChartConfig, Connection, Schema } from '../shared/types.js';
import { DEMO_PREVIEW_STARTERS } from './demo-preview.js';
import { PLAYGROUND_CONNECTION_ID, PLAYGROUND_STARTER_SQL } from './playground.js';

export type SqlExampleCategory = 'basics' | 'aggregation' | 'timeSeries' | 'clickhouse' | 'schema';

export type SqlExample = {
    id: string;
    name: string;
    description: string;
    category: SqlExampleCategory;
    sql: string;
    chart: ChartConfig;
};

const playgroundExamples: SqlExample[] = [
    {
        id: 'github-recent-events', name: 'Recent GitHub events', category: 'basics',
        description: 'Inspect real events, repositories, actors, and timestamps.', sql: PLAYGROUND_STARTER_SQL,
        chart: { kind: 'table', x: 0, ys: [], title: 'GitHub events' },
    },
    {
        id: 'github-daily-activity', name: 'Daily activity', category: 'timeSeries',
        description: 'Compare event volume and active actors over the last 30 days.',
        sql: `SELECT
    toDate(created_at) AS day,
    count() AS events,
    uniqExactIf(actor_login, actor_login != '') AS actors
FROM github.events
WHERE created_at >= now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day`,
        chart: { kind: 'line', x: 0, ys: [1, 2], title: 'Daily GitHub activity' },
    },
    {
        id: 'github-top-star-events', name: 'Repositories getting starred', category: 'aggregation',
        description: 'Rank repositories by recent GitHub star events.',
        sql: `SELECT
    repo_name,
    count() AS star_events
FROM github.events
WHERE event_type = 'WatchEvent'
    AND created_at >= now() - INTERVAL 30 DAY
    AND repo_name != ''
GROUP BY repo_name
ORDER BY star_events DESC
LIMIT 10`,
        chart: { kind: 'bar', x: 0, ys: [1], title: 'Star events by repository' },
    },
    {
        id: 'github-pr-contributors', name: 'PR contributors by month', category: 'clickhouse',
        description: 'Count distinct contributors to ClickHouse pull request activity.',
        sql: `SELECT
    toStartOfMonth(created_at) AS month,
    uniq(actor_login) AS contributors
FROM github.events
WHERE repo_name = 'ClickHouse/ClickHouse'
    AND event_type = 'PullRequestEvent'
    AND created_at >= now() - INTERVAL 24 MONTH
    AND actor_login != ''
GROUP BY month
ORDER BY month`,
        chart: { kind: 'line', x: 0, ys: [1], title: 'Monthly PR contributors' },
    },
    {
        id: 'github-release-cadence', name: 'ClickHouse release cadence', category: 'timeSeries',
        description: 'See how the project release pace changes by year.',
        sql: `SELECT
    toStartOfYear(created_at) AS year,
    count() AS releases
FROM github.events
WHERE repo_name = 'ClickHouse/ClickHouse'
    AND event_type = 'ReleaseEvent'
    AND created_at >= toDateTime('2015-01-01 00:00:00')
GROUP BY year
ORDER BY year`,
        chart: { kind: 'bar', x: 0, ys: [1], title: 'Releases per year' },
    },
    {
        id: 'github-issues-mentioning-clickhouse', name: 'Issues mentioning ClickHouse', category: 'aggregation',
        description: 'Track issue titles mentioning ClickHouse across repositories.',
        sql: `SELECT
    toStartOfMonth(created_at) AS month,
    count() AS issues,
    uniq(repo_name) AS repositories
FROM github.events
WHERE event_type = 'IssuesEvent'
    AND created_at >= now() - INTERVAL 12 MONTH
    AND title ILIKE '%ClickHouse%'
GROUP BY month
ORDER BY month`,
        chart: { kind: 'line', x: 0, ys: [1, 2], title: 'Issues mentioning ClickHouse' },
    },
];

const demoStarterDetails: Record<string, Pick<SqlExample, 'description' | 'category'>> = {
    'preview-starter-getting-started': { description: 'Explore daily activity, unique users, and attributed revenue.', category: 'timeSeries' },
    'preview-starter-top-countries': { description: 'Compare event volume, unique users, and revenue across countries.', category: 'aggregation' },
    'preview-starter-revenue-channel': { description: 'Compare completed orders and average value by channel.', category: 'aggregation' },
    'preview-starter-latency': { description: 'Compare request volume with median and tail latency.', category: 'aggregation' },
    'preview-starter-hourly': { description: 'Track hourly event volume and server errors.', category: 'timeSeries' },
    'preview-starter-funnel': { description: 'Compare users across signup funnel steps.', category: 'aggregation' },
    'preview-starter-device-engagement': { description: 'Compare sessions and conversion by device.', category: 'aggregation' },
    'preview-starter-customer-value': { description: 'Compare average customer value by plan.', category: 'aggregation' },
    'preview-starter-daily-rollup': { description: 'Use additive counts and revenue from a pre-aggregated table.', category: 'timeSeries' },
    'preview-starter-latency-anomaly': { description: 'Compare p95 latency with a rolling baseline and alert threshold.', category: 'clickhouse' },
    'preview-starter-latest-event': { description: 'Use argMax to find each user’s most recent event and page.', category: 'clickhouse' },
    'preview-starter-top-pages-country': { description: 'Use LIMIT BY to find the top three pages in each country.', category: 'clickhouse' },
    'preview-starter-distinct-estimates': { description: 'Compare an exact visitor count with a fast approximate count.', category: 'clickhouse' },
};

const demoExamples: SqlExample[] = DEMO_PREVIEW_STARTERS.map(starter => ({
    id: starter.id,
    name: starter.name.replace(/\.sql$/i, ''),
    description: demoStarterDetails[starter.id]?.description ?? 'Explore the sample ClickHouse data.',
    category: demoStarterDetails[starter.id]?.category ?? 'basics',
    sql: starter.sql,
    chart: starter.chart,
}));

const genericExamples: SqlExample[] = [
    {
        id: 'clickhouse-server-version', name: 'ClickHouse version', category: 'basics',
        description: 'Check which ClickHouse version serves this connection.',
        sql: 'SELECT version() AS clickhouse_version',
        chart: { kind: 'table', x: 0, ys: [], title: 'ClickHouse version' },
    },
    {
        id: 'clickhouse-server-time', name: 'Server time', category: 'basics',
        description: 'Read the current time from the ClickHouse server.',
        sql: 'SELECT now() AS server_time',
        chart: { kind: 'table', x: 0, ys: [], title: 'Server time' },
    },
    {
        id: 'clickhouse-numbers', name: 'Generate a number series', category: 'basics',
        description: 'Use the numbers table function to create a small result set.',
        sql: `SELECT
    number,
    number * number AS squared
FROM numbers(10)
ORDER BY number`,
        chart: { kind: 'table', x: 0, ys: [], title: 'Number series' },
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
            chart: { kind: 'table', x: 0, ys: [], title: `Preview ${table.name}` },
        }));

    return [...tableExamples, ...genericExamples];
}
