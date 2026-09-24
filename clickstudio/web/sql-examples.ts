import type { ChartConfig, Connection, Schema } from '../shared/types.js';
import { DEMO_PREVIEW_STARTERS } from './demo-preview.js';
import { PLAYGROUND_CONNECTION_ID, PLAYGROUND_STARTER_SQL } from './playground.js';

export type SqlExampleCategory = 'basics' | 'aggregation' | 'timeSeries' | 'clickhouse' | 'schema';

export type SqlExample = {
    id: string;
    name: string;
    description: string;
    dataset?: string;
    category: SqlExampleCategory;
    sql: string;
    chart: ChartConfig;
};

const playgroundExamples: SqlExample[] = [
    {
        id: 'github-recent-events', name: 'Recent GitHub events', category: 'basics',
        description: 'Inspect real events, repositories, actors, and timestamps.', dataset: 'GitHub', sql: PLAYGROUND_STARTER_SQL,
        chart: { kind: 'table', x: 0, ys: [], title: 'GitHub events' },
    },
    {
        id: 'github-daily-activity', name: 'Daily activity', category: 'timeSeries',
        description: 'Compare event volume and active actors over the last 30 days.', dataset: 'GitHub',
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
        description: 'Rank repositories by recent GitHub star events.', dataset: 'GitHub',
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
        description: 'Count distinct contributors to ClickHouse pull request activity.', dataset: 'GitHub',
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
        description: 'See how the project release pace changes by year.', dataset: 'GitHub',
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
        description: 'Track issue titles mentioning ClickHouse across repositories.', dataset: 'GitHub',
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
    {
        id: 'hackernews-daily-pulse', name: 'Stories and comments', category: 'timeSeries', dataset: 'Hacker News',
        description: 'Compare daily stories and comments from the last 90 days.',
        sql: `SELECT
    toDate(time) AS day,
    countIf(type = 'story') AS stories,
    countIf(type = 'comment') AS comments
FROM hackernews.hackernews
WHERE time >= now() - INTERVAL 90 DAY
GROUP BY day
ORDER BY day`,
        chart: { kind: 'line', x: 0, ys: [1, 2], title: 'Hacker News activity' },
    },
    {
        id: 'nyc-taxi-weekly-rhythm', name: 'Taxi trips by weekday and hour', category: 'timeSeries', dataset: 'NYC Taxi',
        description: 'Find rush-hour patterns across the week in a 168-cell heatmap.',
        sql: `SELECT
    toDayOfWeek(pickup_datetime) AS weekday,
    toHour(pickup_datetime) AS hour,
    count() AS trips
FROM nyc_taxi.trips_small
GROUP BY weekday, hour
ORDER BY weekday, hour`,
        chart: { kind: 'heatmap', x: 1, groupBy: 0, ys: [2], title: 'Taxi pickups by weekday and hour' },
    },
    {
        id: 'nyc-taxi-fare-distance', name: 'Fare vs. trip distance', category: 'aggregation', dataset: 'NYC Taxi',
        description: 'Explore how trip distance relates to the metered fare.',
        sql: `SELECT
    trip_distance,
    fare_amount
FROM nyc_taxi.trips_small
WHERE trip_distance > 0 AND fare_amount > 0
ORDER BY trip_id
LIMIT 240`,
        chart: { kind: 'scatter', x: 0, ys: [1], title: 'Fare by trip distance' },
    },
    {
        id: 'bluesky-activity-by-hour', name: 'Bluesky activity by hour', category: 'timeSeries', dataset: 'Bluesky',
        description: 'Compare posts, likes, and reposts across the day using ClickHouse hourly rollups.',
        sql: `SELECT
    event,
    hour_of_day,
    sum(count) AS events
FROM bluesky.events_per_hour_of_day
WHERE event IN ('app.bsky.feed.post', 'app.bsky.feed.like', 'app.bsky.feed.repost')
GROUP BY event, hour_of_day
ORDER BY event, hour_of_day`,
        chart: { kind: 'heatmap', x: 1, groupBy: 0, ys: [2], title: 'Bluesky events by hour' },
    },
    {
        id: 'stock-jnj-history', name: 'Johnson & Johnson price history', category: 'timeSeries', dataset: 'Stock sample',
        description: 'Plot 180 historical trading sessions from the sample stock table.',
        sql: `SELECT
    date,
    price
FROM (
    SELECT date, price
    FROM stock.stock
    WHERE symbol = 'JNJ'
    ORDER BY date DESC
    LIMIT 180
)
ORDER BY date`,
        chart: { kind: 'line', x: 0, ys: [1], title: 'JNJ historical price' },
    },
    {
        id: 'pypi-package-downloads', name: 'Package downloads by month', category: 'timeSeries', dataset: 'PyPI',
        description: 'Compare monthly downloads of pandas, Polars, and ClickHouse Python drivers.',
        sql: `SELECT
    month,
    project,
    sum(count) AS downloads
FROM pypi.pypi_downloads_per_month
WHERE month >= addMonths(toStartOfMonth(today()), -17)
    AND project IN ('clickhouse-connect', 'clickhouse-driver', 'pandas', 'polars')
GROUP BY month, project
ORDER BY month, project
LIMIT 100`,
        chart: { kind: 'heatmap', x: 0, groupBy: 1, ys: [2], title: 'Monthly package downloads' },
    },
    {
        id: 'stackoverflow-qa-volume', name: 'Stack Overflow Q&A volume', category: 'timeSeries', dataset: 'Stack Overflow',
        description: 'See how monthly question and answer counts changed in the archive.',
        sql: `SELECT
    toStartOfMonth(CreationDate) AS month,
    countIf(PostTypeId = 'Question') AS questions,
    countIf(PostTypeId = 'Answer') AS answers
FROM stackoverflow.posts
WHERE CreationDate >= toDateTime('2020-01-01 00:00:00')
    AND CreationDate < toDateTime('2024-04-01 00:00:00')
GROUP BY month
ORDER BY month
LIMIT 100`,
        chart: { kind: 'line', x: 0, ys: [1, 2], title: 'Monthly Stack Overflow Q&A' },
    },
    {
        id: 'uk-house-prices-by-county', name: 'UK house prices by county', category: 'aggregation', dataset: 'UK property data',
        description: 'Rank counties by median sale price since 2020.',
        sql: `SELECT
    county,
    quantile(0.5)(price) AS median_price,
    count() AS sales
FROM uk.uk_price_paid
WHERE date >= toDate('2020-01-01')
    AND price > 0
GROUP BY county
HAVING sales >= 1000
ORDER BY median_price DESC
LIMIT 12`,
        chart: { kind: 'bar', x: 0, ys: [1], title: 'Median sale price by county' },
    },
    {
        id: 'imdb-ratings-by-year', name: 'Movie ratings by year', category: 'aggregation', dataset: 'IMDb',
        description: 'Compare average IMDb ratings across movie release years.',
        sql: `SELECT
    year,
    round(avg(rank), 2) AS average_rating
FROM imdb.movies
WHERE year >= 1980
    AND rank > 0
GROUP BY year
ORDER BY year
LIMIT 200`,
        chart: { kind: 'scatter', x: 0, ys: [1], title: 'Average movie rating by year' },
    },
    {
        id: 'noaa-central-park-weather', name: 'New York weather patterns', category: 'timeSeries', dataset: 'NOAA weather',
        description: 'Explore monthly weather types recorded at Central Park from 2018 to 2022.',
        sql: `SELECT
    toStartOfMonth(date) AS month,
    weatherType,
    count() AS observations
FROM noaa.noaa
WHERE station_id = 'USW00094728'
    AND date >= toDate('2018-01-01')
    AND date < toDate('2023-01-01')
GROUP BY month, weatherType
ORDER BY month, weatherType
LIMIT 240`,
        chart: { kind: 'heatmap', x: 0, groupBy: 1, ys: [2], title: 'Central Park weather by month' },
    },
    {
        id: 'forex-eur-usd-monthly', name: 'EUR/USD monthly midpoint', category: 'timeSeries', dataset: 'Forex',
        description: 'Follow historical monthly average bid/ask midpoints for EUR/USD.',
        sql: `SELECT
    toStartOfMonth(datetime) AS month,
    round(avg((bid + ask) / 2), 5) AS midpoint
FROM forex.forex
WHERE base = 'EUR'
    AND quote = 'USD'
    AND datetime >= toDateTime('2019-01-01 00:00:00')
    AND datetime < toDateTime('2023-01-01 00:00:00')
GROUP BY month
ORDER BY month`,
        chart: { kind: 'line', x: 0, ys: [1], title: 'EUR/USD monthly midpoint' },
    },
    {
        id: 'nyc-taxi-fare-quantiles', name: 'Taxi fare percentiles by hour', category: 'clickhouse', dataset: 'NYC Taxi',
        description: 'Compare median and 95th-percentile fares by weekday and pickup hour.',
        sql: `SELECT
    toDayOfWeek(pickup_datetime) AS weekday,
    toHour(pickup_datetime) AS hour,
    quantile(0.50)(fare_amount) AS median_fare,
    quantile(0.95)(fare_amount) AS p95_fare
FROM nyc_taxi.trips_small
WHERE trip_distance > 0
    AND fare_amount > 0
    AND fare_amount < 200
GROUP BY weekday, hour
ORDER BY weekday, hour`,
        chart: { kind: 'heatmap', x: 1, groupBy: 0, ys: [2], title: 'Taxi fare percentiles by hour' },
    },
    {
        id: 'github-rolling-activity', name: 'GitHub activity with a rolling average', category: 'clickhouse', dataset: 'GitHub',
        description: 'Smooth daily ClickHouse repository activity with a seven-day window.',
        sql: `WITH daily AS (
    SELECT
        toDate(created_at) AS day,
        count() AS events
    FROM github.events
    WHERE repo_name = 'ClickHouse/ClickHouse'
        AND created_at >= now() - INTERVAL 90 DAY
    GROUP BY day
)
SELECT
    day,
    events,
    round(avg(events) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1) AS seven_day_average
FROM daily
ORDER BY day`,
        chart: { kind: 'line', x: 0, ys: [1, 2], title: 'Daily GitHub events and seven-day average' },
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
