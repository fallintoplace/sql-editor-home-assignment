import { DEFAULT_LIMITS, type ChartConfig, type Connection, type QueryDocument, type Result, type ResultPage, type Run, type Schema, type SchemaColumn, type Script } from '../shared/types.js';
import { splitSql } from '../shared/sql.js';
import { sqlForRunKind } from '../shared/explain-plan.js';
import { isResult, isRun } from '../shared/run-wire.js';
import { loadPlaygroundSchema, PLAYGROUND_CONNECTION, PLAYGROUND_CONNECTION_ID, PLAYGROUND_STARTER_ID, PLAYGROUND_STARTER_NAME, PLAYGROUND_STARTER_SQL, queryPlayground } from './playground.js';

export const DEMO_PREVIEW_RUN_ID = 'preview-sample-run';
export const DEMO_PREVIEW_STARTER_DOCUMENT_ID = 'preview-starter-getting-started';
export const DEMO_PREVIEW_SQL = `SELECT
    toDate(event_time) AS day,
    count() AS events,
    uniqExact(user_id) AS unique_users,
    round(sum(revenue), 2) AS revenue
FROM events
WHERE event_time >= now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day`;

export type DemoPreviewStarter = { id: string; name: string; sql: string; chart: ChartConfig; initial?: boolean; revision?: number };
export const DEMO_PREVIEW_STARTERS: DemoPreviewStarter[] = [
    { id: DEMO_PREVIEW_STARTER_DOCUMENT_ID, name: 'Getting started.sql', sql: DEMO_PREVIEW_SQL, chart: { kind: 'line', x: 0, ys: [1, 2], title: 'Daily activity' }, initial: true, revision: 5 },
    { id: 'preview-starter-top-countries', name: 'Top countries.sql', sql: `SELECT
    country,
    count() AS events,
    uniqExact(user_id) AS unique_users,
    round(sum(revenue), 2) AS revenue
FROM events
WHERE event_time >= now() - INTERVAL 7 DAY
GROUP BY country
ORDER BY events DESC
LIMIT 10`, chart: { kind: 'bar', x: 0, ys: [1], title: 'Events by country' }, initial: true },
    { id: 'preview-starter-revenue-channel', name: 'Revenue by channel.sql', sql: `SELECT
    channel,
    countIf(order_status = 'completed') AS orders,
    round(sumIf(total, order_status = 'completed'), 2) AS revenue,
    round(revenue / nullIf(orders, 0), 2) AS average_order_value
FROM orders
WHERE order_time >= now() - INTERVAL 30 DAY
GROUP BY channel
ORDER BY revenue DESC`, chart: { kind: 'bar', x: 0, ys: [2], title: 'Revenue by channel' }, initial: true },
    { id: 'preview-starter-latency', name: 'Request latency.sql', sql: `SELECT
    page_path,
    count() AS requests,
    quantile(0.50)(duration_ms) AS p50_ms,
    quantile(0.95)(duration_ms) AS p95_ms,
    quantile(0.99)(duration_ms) AS p99_ms
FROM events
WHERE event_time >= now() - INTERVAL 1 DAY
GROUP BY page_path
ORDER BY p95_ms DESC
LIMIT 10`, chart: { kind: 'bar', x: 0, ys: [3], title: '95th percentile latency' }, initial: true },
    { id: 'preview-starter-hourly', name: 'Hourly traffic.sql', sql: `SELECT
    toStartOfHour(event_time) AS hour,
    count() AS events,
    countIf(status >= 500) AS server_errors
FROM events
WHERE event_time >= now() - INTERVAL 24 HOUR
GROUP BY hour
ORDER BY hour`, chart: { kind: 'line', x: 0, ys: [1, 2], title: 'Hourly traffic' } },
    { id: 'preview-starter-funnel', name: 'Signup funnel.sql', sql: `SELECT
    multiIf(event_type = 'page_view', 'Visit', event_type = 'signup_start', 'Create account', event_type = 'signup_complete', 'Activate', 'Other') AS step,
    uniqExact(user_id) AS users,
    round(users / nullIf(max(users) OVER (), 0) * 100, 1) AS conversion_pct
FROM events
WHERE event_time >= now() - INTERVAL 30 DAY
GROUP BY step
HAVING step != 'Other'
ORDER BY users DESC`, chart: { kind: 'bar', x: 0, ys: [1], title: 'Signup conversion' } },
    { id: 'preview-starter-device-engagement', name: 'Device engagement.sql', sql: `SELECT
    device_type,
    count() AS sessions,
    round(avg(page_views), 1) AS avg_page_views,
    round(avg(converted) * 100, 1) AS conversion_rate
FROM sessions
WHERE started_at >= now() - INTERVAL 30 DAY
GROUP BY device_type
ORDER BY sessions DESC`, chart: { kind: 'bar', x: 0, ys: [1], title: 'Sessions by device' } },
    { id: 'preview-starter-customer-value', name: 'Customer value.sql', sql: `SELECT
    plan,
    count() AS users,
    round(avg(lifetime_value), 2) AS average_lifetime_value
FROM users
GROUP BY plan
ORDER BY average_lifetime_value DESC`, chart: { kind: 'bar', x: 0, ys: [2], title: 'Average customer value' } },
    { id: 'preview-starter-daily-rollup', name: 'Daily rollup.sql', sql: `SELECT
    day,
    sum(events) AS events,
    sum(orders) AS orders,
    round(sum(revenue), 2) AS revenue
FROM daily_metrics
WHERE day >= today() - 30
GROUP BY day
ORDER BY day`, chart: { kind: 'line', x: 0, ys: [1], title: 'Daily events from the rollup' } },
    { id: 'preview-starter-latency-anomaly', name: 'Latency anomaly baseline.sql', sql: `WITH hourly_latency AS (
    SELECT
        toStartOfHour(event_time) AS hour,
        page_path,
        quantileTDigest(0.95)(duration_ms) AS p95_ms
    FROM events
    WHERE event_time >= now() - INTERVAL 14 DAY
    GROUP BY hour, page_path
), rolling_baseline AS (
    SELECT
        hour,
        page_path,
        p95_ms,
        avg(p95_ms) OVER (
            PARTITION BY page_path
            ORDER BY hour
            ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING
        ) AS baseline_ms,
        stddevPop(p95_ms) OVER (
            PARTITION BY page_path
            ORDER BY hour
            ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING
        ) AS deviation_ms
    FROM hourly_latency
)
SELECT
    hour,
    page_path,
    p95_ms,
    round(baseline_ms, 1) AS baseline_ms,
    round(baseline_ms + 3 * deviation_ms, 1) AS alert_threshold_ms
FROM rolling_baseline
WHERE baseline_ms IS NOT NULL
ORDER BY hour
LIMIT 500`, chart: { kind: 'line', x: 0, ys: [2, 3, 4], title: 'P95 latency vs rolling baseline' } },
    { id: 'preview-starter-latest-event', name: 'Latest event per user.sql', sql: `SELECT
    user_id,
    argMax(event_type, event_time) AS last_event,
    argMax(page_path, event_time) AS last_page,
    max(event_time) AS last_seen
FROM events
WHERE event_time >= now() - INTERVAL 30 DAY
GROUP BY user_id
ORDER BY last_seen DESC
LIMIT 20`, chart: { kind: 'table', x: 0, ys: [], title: 'Latest event per user' } },
    { id: 'preview-starter-top-pages-country', name: 'Top pages by country.sql', sql: `SELECT
    country,
    page_path,
    count() AS page_views,
    uniqExact(user_id) AS visitors
FROM events
WHERE event_time >= now() - INTERVAL 7 DAY
GROUP BY country, page_path
ORDER BY country, visitors DESC
LIMIT 3 BY country
LIMIT 30`, chart: { kind: 'bar', x: 0, ys: [3], title: 'Top pages by country' } },
    { id: 'preview-starter-distinct-estimates', name: 'Exact vs estimated visitors.sql', sql: `WITH visitor_counts AS (
    SELECT
        uniqExact(user_id) AS exact_visitors,
        uniqCombined64(user_id) AS estimated_visitors
    FROM events
    WHERE event_time >= now() - INTERVAL 30 DAY
)
SELECT
    exact_visitors,
    estimated_visitors,
    round(abs(toFloat64(exact_visitors) - estimated_visitors) / nullIf(exact_visitors, 0) * 100, 2) AS difference_pct
FROM visitor_counts`, chart: { kind: 'table', x: 0, ys: [], title: 'Exact vs estimated visitors' } },
];
export const DEMO_PREVIEW_INITIAL_STARTERS = DEMO_PREVIEW_STARTERS.filter(starter => starter.initial);
const DEMO_PREVIEW_STARTER_VERSIONS = [
    `SELECT
    toDate(event_time) AS day,
    count() AS events
FROM events
GROUP BY day
ORDER BY day`,
    `SELECT
    toDate(event_time) AS day,
    count() AS events,
    uniqExact(user_id) AS unique_users
FROM events
GROUP BY day
ORDER BY day`,
    `SELECT
    toDate(event_time) AS day,
    count() AS events,
    uniqExact(user_id) AS unique_users,
    round(sum(revenue), 2) AS revenue
FROM events
GROUP BY day
ORDER BY day`,
    `SELECT
    toDate(event_time) AS day,
    count() AS events,
    uniqExact(user_id) AS unique_users,
    round(sum(revenue), 2) AS revenue
FROM events
WHERE event_time >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day`,
    DEMO_PREVIEW_SQL,
] as const;
export const PLAYGROUND_PREVIEW_STARTER = {
    id: PLAYGROUND_STARTER_ID,
    name: PLAYGROUND_STARTER_NAME,
    sql: PLAYGROUND_STARTER_SQL,
    chart: { kind: 'table', x: 0, ys: [], title: 'GitHub events' } satisfies ChartConfig,
};

export function demoPreviewStarterRunId(id: string) {
    return id === DEMO_PREVIEW_STARTER_DOCUMENT_ID ? DEMO_PREVIEW_RUN_ID : `preview-run-${id}`;
}

type RequestOptions = { method?: string; body?: unknown; signal?: AbortSignal };

const owner = 'preview-user';
const previewStorageKey = 'clickstudio:vercel-preview-database:v1';
const previewStorageBudget = 1_500_000;
const expiresAt = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const now = () => new Date().toISOString();
const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const record = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {};

const schemaColumns = (table: string, values: Array<[string, string, string]>): SchemaColumn[] => values.map(([name, type, comment]) => ({
    database: 'demo', table, name, type, comment, defaultKind: '',
}));

const schema: Schema = {
    connectionId: 'demo',
    fetchedAt: now(),
    tables: [
        { database: 'demo', name: 'events', engine: 'MergeTree', orderBy: '(tenant_id, event_time)', primaryKey: 'tenant_id, event_time', partitionKey: 'toYYYYMM(event_time)', samplingKey: 'tenant_id', ttlConfigured: true, rowEstimate: '2840000000', sizeBytes: '442381631488', uncompressedBytes: '1724663015424', parts: '58', activeParts: '52', skipIndexTypes: ['bloom_filter', 'minmax'], projections: [{ name: 'daily_revenue', type: 'Aggregate', sortingKey: 'event_time, country, channel' }, { name: 'by_user_time', type: 'Normal', sortingKey: 'tenant_id, user_id, event_time' }], skipIndexes: [{ name: 'tenant_bloom', type: 'bloom_filter', expression: 'tenant_id', granularity: '4' }, { name: 'event_type_minmax', type: 'minmax', expression: 'event_type', granularity: '1' }] },
        { database: 'demo', name: 'sessions', engine: 'ReplacingMergeTree', orderBy: '(tenant_id, session_id)', primaryKey: 'tenant_id, session_id', partitionKey: 'toYYYYMM(started_at)', rowEstimate: '184000000', sizeBytes: '62794342400', uncompressedBytes: '221459251200', parts: '42', activeParts: '38', skipIndexTypes: ['set'], projections: [{ name: 'sessions_by_country', type: 'Normal', sortingKey: 'country, started_at' }] },
        { database: 'demo', name: 'orders', engine: 'ReplacingMergeTree', orderBy: '(tenant_id, order_id)', primaryKey: 'tenant_id, order_id', partitionKey: 'toYYYYMM(order_time)', rowEstimate: '42800000', sizeBytes: '18622709760', uncompressedBytes: '59362078720', parts: '36', activeParts: '32', skipIndexTypes: ['bloom_filter'] },
        { database: 'demo', name: 'daily_metrics', engine: 'SummingMergeTree', orderBy: '(day, country, channel)', primaryKey: 'day, country', partitionKey: 'toYYYYMM(day)', rowEstimate: '1095', sizeBytes: '1048576', uncompressedBytes: '3145728', parts: '3', activeParts: '3', projections: [{ name: 'by_channel', type: 'Normal', sortingKey: 'channel, day' }], skipIndexes: [] },
        { database: 'demo', name: 'users', engine: 'ReplacingMergeTree', orderBy: '(tenant_id, user_id)', primaryKey: 'tenant_id, user_id', rowEstimate: '4120000', sizeBytes: '1207959552', uncompressedBytes: '3892314112', parts: '18', activeParts: '16' },
    ],
    columns: [
        ...schemaColumns('events', [
            ['tenant_id', 'UInt64', 'Synthetic tenant identifier'], ['event_time', 'DateTime64(3)', 'Synthetic event timestamp'],
            ['event_type', 'LowCardinality(String)', 'Event name such as page_view, signup_start, or purchase'], ['user_id', 'UInt64', 'Synthetic user identifier'],
            ['session_id', 'UUID', 'Synthetic session identifier'], ['country', 'LowCardinality(String)', 'Visitor country'],
            ['region', 'LowCardinality(String)', 'Visitor region'], ['device_type', 'LowCardinality(String)', 'Device category'],
            ['page_path', 'String', 'Page or endpoint path'], ['channel', 'LowCardinality(String)', 'Acquisition channel'],
            ['campaign_id', 'UInt32', 'Marketing campaign identifier'], ['status', 'UInt16', 'HTTP-like response status'],
            ['duration_ms', 'UInt32', 'Synthetic request duration in milliseconds'], ['revenue', 'Decimal(18, 2)', 'Synthetic attributed revenue'],
            ['currency', 'FixedString(3)', 'ISO currency code'],
        ]),
        ...schemaColumns('sessions', [
            ['tenant_id', 'UInt64', 'Synthetic tenant identifier'], ['session_id', 'UUID', 'Synthetic session identifier'],
            ['user_id', 'UInt64', 'Synthetic user identifier'], ['started_at', 'DateTime', 'Session start time'],
            ['ended_at', 'DateTime', 'Session end time'], ['landing_page', 'String', 'First page visited'],
            ['exit_page', 'String', 'Last page visited'], ['country', 'LowCardinality(String)', 'Visitor country'],
            ['device_type', 'LowCardinality(String)', 'Device category'], ['channel', 'LowCardinality(String)', 'Acquisition channel'],
            ['page_views', 'UInt16', 'Pages viewed in this session'], ['converted', 'UInt8', 'Whether the session converted'],
        ]),
        ...schemaColumns('orders', [
            ['tenant_id', 'UInt64', 'Synthetic tenant identifier'], ['order_id', 'UInt64', 'Synthetic order identifier'],
            ['user_id', 'UInt64', 'Synthetic user identifier'], ['order_time', 'DateTime', 'Order creation time'],
            ['order_status', 'LowCardinality(String)', 'Order lifecycle status'], ['channel', 'LowCardinality(String)', 'Acquisition channel'],
            ['currency', 'FixedString(3)', 'ISO currency code'], ['subtotal', 'Decimal(18, 2)', 'Order subtotal'],
            ['tax', 'Decimal(18, 2)', 'Tax amount'], ['total', 'Decimal(18, 2)', 'Total order value'],
            ['item_count', 'UInt8', 'Number of items in the order'],
        ]),
        ...schemaColumns('daily_metrics', [
            ['day', 'Date', 'UTC date bucket'], ['country', 'LowCardinality(String)', 'Visitor country'],
            ['channel', 'LowCardinality(String)', 'Acquisition channel'], ['events', 'UInt64', 'Aggregated event count'],
            ['unique_users', 'UInt64', 'Distinct users for the day'], ['sessions', 'UInt64', 'Session count'],
            ['orders', 'UInt64', 'Completed order count'], ['revenue', 'Decimal(20, 2)', 'Attributed revenue'],
        ]),
        ...schemaColumns('users', [
            ['tenant_id', 'UInt64', 'Synthetic tenant identifier'], ['user_id', 'UInt64', 'Synthetic user identifier'],
            ['created_at', 'DateTime', 'Account creation time'], ['plan', 'LowCardinality(String)', 'Subscription plan'],
            ['country', 'LowCardinality(String)', 'Account country'], ['lifetime_value', 'Decimal(18, 2)', 'Synthetic lifetime value'],
        ]),
    ],
    dictionaries: [
        { database: 'demo', name: 'campaign_lookup', status: 'LOADED', type: 'Hashed', keyColumns: 'campaign_id UInt32', attributeColumns: 'campaign_name String, channel String, start_date Date', elementCount: '18240', memoryBytes: '5242880', lastSuccessfulUpdate: now().replace('T', ' ').slice(0, 19) },
        { database: 'demo', name: 'country_lookup', status: 'LOADED', type: 'Flat', keyColumns: 'country_code FixedString(2)', attributeColumns: 'country_name String, region String, currency FixedString(3)', elementCount: '249', memoryBytes: '196608', lastSuccessfulUpdate: now().replace('T', ' ').slice(0, 19) },
    ],
    warnings: ['Schema estimates, sample rows, and query results are synthetic browser fixtures, not live ClickHouse data.'],
    truncated: false,
};

function connection(trusted: boolean): Connection & { trusted: boolean } {
    const available = { available: true };
    return {
        dataSource: 'fixture', id: 'demo', name: 'Sample data', host: 'fixture://browser-preview', database: 'demo', username: 'sample-reader',
        readonly: true, trusted, limits: { ...DEFAULT_LIMITS },
        manifest: {
            version: 1, serverVersion: 'Frontend sample data', testedAt: now(), schema: available, progress: available,
            cancellation: available, explain: available, pipeline: available, queryLog: available,
            documentation: { available: false, reason: 'System-table documentation is not connected in preview mode.' },
            import: { available: false, reason: 'File import is not connected in preview mode.' }, scripts: available,
            parameters: { available: false, reason: 'Sample results do not evaluate SQL parameters.' },
        },
    };
}

type PreviewRows = Pick<Result, 'columns' | 'rows'>;
const countries = [
    ['United States', 18420, 6120, 14892.4], ['United Kingdom', 12680, 4380, 10340.75], ['Germany', 9820, 3510, 8451.2],
    ['France', 8240, 2960, 7118.9], ['Japan', 7160, 2540, 6294.35], ['Canada', 6840, 2310, 5740.8],
    ['Australia', 5380, 1890, 4632.5], ['Netherlands', 4920, 1720, 4198.25], ['Spain', 4310, 1510, 3620.1],
    ['Sweden', 3680, 1260, 3182.65],
] as const;
const channels = [
    ['Organic search', 286, 38240.5, 133.71], ['Direct', 224, 31418.2, 140.26], ['Paid search', 178, 26749.8, 150.28],
    ['Referral', 116, 16892.4, 145.62], ['Email', 94, 12480.75, 132.77], ['Social', 62, 7386.1, 119.13],
] as const;
const endpoints = [
    ['/api/events', 48620, 38, 142, 286], ['/api/reports/summary', 12840, 86, 318, 742], ['/api/users', 9720, 54, 224, 508],
    ['/api/orders', 7860, 62, 268, 624], ['/api/search', 5210, 112, 486, 1086], ['/api/exports', 1840, 328, 1260, 2418],
    ['/api/segments', 1460, 94, 412, 980], ['/api/billing', 980, 48, 186, 422],
] as const;
const steps = [['Visit', 84200, 100], ['Create account', 12640, 15], ['Activate', 7840, 9.3]] as const;

function dateDaysAgo(daysAgo: number) {
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dailyRows(): PreviewRows {
    const rows = Array.from({ length: 30 }, (_, index) => {
        const daysAgo = 29 - index;
        const events = 26800 + ((index * 947 + index * index * 19) % 13900);
        const users = Math.round(events * (0.31 + (index % 5) * 0.012));
        const revenue = Math.round((events * (0.041 + (index % 7) * 0.0023)) * 100) / 100;
        return [dateDaysAgo(daysAgo), events, users, revenue];
    });
    return { columns: [{ name: 'day', type: 'Date' }, { name: 'events', type: 'UInt64' }, { name: 'unique_users', type: 'UInt64' }, { name: 'revenue', type: 'Decimal(18, 2)' }], rows };
}

function normalizePreviewSql(sql: string) {
    return sql.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hourlyTrafficRows(): PreviewRows {
    const rows = Array.from({ length: 24 }, (_, index) => {
        const hour = new Date(Date.now() - (23 - index) * 60 * 60 * 1000).toISOString().slice(0, 13) + ':00:00';
        const events = 1250 + ((index * 173 + index * index * 11) % 2340);
        return [hour, events, Math.round(events * (0.006 + (index % 4) * 0.001))];
    });
    return { columns: [{ name: 'hour', type: 'DateTime' }, { name: 'events', type: 'UInt64' }, { name: 'server_errors', type: 'UInt64' }], rows };
}

function latencyAnomalyRows(): PreviewRows {
    const p95Values = [218, 205, 212, 224, 216, 208, 230, 226, 219, 305, 468, 612];
    const rows = p95Values.flatMap((p95, index) => {
        const history = p95Values.slice(Math.max(0, index - 7), index);
        if (history.length === 0) return [];
        const hour = new Date(Date.now() - (p95Values.length - index) * 60 * 60 * 1000).toISOString().slice(0, 13) + ':00:00';
        const baseline = history.reduce((sum, value) => sum + value, 0) / history.length;
        const deviation = Math.sqrt(history.reduce((sum, value) => sum + (value - baseline) ** 2, 0) / history.length);
        return [[hour, '/api/checkout', p95, Math.round(baseline * 10) / 10, Math.round((baseline + 3 * deviation) * 10) / 10]];
    });
    return { columns: [{ name: 'hour', type: 'DateTime' }, { name: 'page_path', type: 'String' }, { name: 'p95_ms', type: 'Float64' }, { name: 'baseline_ms', type: 'Float64' }, { name: 'alert_threshold_ms', type: 'Float64' }], rows };
}

function recentEventRows(): PreviewRows {
    const recentUsers: Array<[number, string, string, number]> = [
        [1042, 'purchase', '/pricing/checkout', 8], [2088, 'signup_complete', '/welcome', 20],
        [3811, 'page_view', '/docs/sql', 35], [4927, 'add_to_cart', '/products/analytics', 52],
        [6120, 'purchase', '/pricing/checkout', 71],
    ];
    const rows = recentUsers.map(([userId, event, page, minutesAgo]) => [
        userId, event, page, new Date(Date.now() - minutesAgo * 60_000).toISOString().slice(0, 19).replace('T', ' '),
    ]);
    return { columns: [{ name: 'user_id', type: 'UInt64' }, { name: 'last_event', type: 'String' }, { name: 'last_page', type: 'String' }, { name: 'last_seen', type: 'DateTime' }], rows };
}

const demoResultRows: Record<string, PreviewRows> = {
    'preview-starter-getting-started': dailyRows(),
    'preview-starter-top-countries': { columns: [{ name: 'country', type: 'String' }, { name: 'events', type: 'UInt64' }, { name: 'unique_users', type: 'UInt64' }, { name: 'revenue', type: 'Decimal(18, 2)' }], rows: countries.map(row => [...row]) },
    'preview-starter-revenue-channel': { columns: [{ name: 'channel', type: 'String' }, { name: 'orders', type: 'UInt64' }, { name: 'revenue', type: 'Decimal(18, 2)' }, { name: 'average_order_value', type: 'Decimal(18, 2)' }], rows: channels.map(row => [...row]) },
    'preview-starter-latency': { columns: [{ name: 'page_path', type: 'String' }, { name: 'requests', type: 'UInt64' }, { name: 'p50_ms', type: 'UInt32' }, { name: 'p95_ms', type: 'UInt32' }, { name: 'p99_ms', type: 'UInt32' }], rows: endpoints.map(row => [...row]) },
    'preview-starter-hourly': hourlyTrafficRows(),
    'preview-starter-funnel': { columns: [{ name: 'step', type: 'String' }, { name: 'users', type: 'UInt64' }, { name: 'conversion_pct', type: 'Float64' }], rows: steps.map(row => [...row]) },
    'preview-starter-device-engagement': { columns: [{ name: 'device_type', type: 'String' }, { name: 'sessions', type: 'UInt64' }, { name: 'avg_page_views', type: 'Float64' }, { name: 'conversion_rate', type: 'Float64' }], rows: [['Desktop', 24820, 5.8, 8.4], ['Mobile', 38640, 3.6, 5.1], ['Tablet', 4280, 4.2, 6.3]] },
    'preview-starter-customer-value': { columns: [{ name: 'plan', type: 'String' }, { name: 'users', type: 'UInt64' }, { name: 'average_lifetime_value', type: 'Decimal(18, 2)' }], rows: [['Free', 18420, 0], ['Starter', 12680, 48.5], ['Growth', 6420, 286.4], ['Business', 1280, 1842.75]] },
    'preview-starter-daily-rollup': { columns: [{ name: 'day', type: 'Date' }, { name: 'events', type: 'UInt64' }, { name: 'orders', type: 'UInt64' }, { name: 'revenue', type: 'Decimal(18, 2)' }], rows: dailyRows().rows.map((row, index) => [row[0]!, row[1]!, Math.round(Number(row[1]) * (0.004 + (index % 4) * 0.0007)), row[3]!]) },
    'preview-starter-latency-anomaly': latencyAnomalyRows(),
    'preview-starter-latest-event': recentEventRows(),
    'preview-starter-top-pages-country': { columns: [{ name: 'country', type: 'String' }, { name: 'page_path', type: 'String' }, { name: 'page_views', type: 'UInt64' }, { name: 'visitors', type: 'UInt64' }], rows: [['United States', '/pricing', 3240, 1940], ['United States', '/docs/sql', 2860, 1710], ['United States', '/blog/clickhouse', 1940, 1280], ['United Kingdom', '/docs/sql', 1620, 980], ['United Kingdom', '/pricing', 1480, 910], ['United Kingdom', '/blog/clickhouse', 1140, 740], ['Germany', '/docs/sql', 1320, 810], ['Germany', '/pricing', 1080, 640], ['Germany', '/blog/clickhouse', 920, 580]] },
    'preview-starter-distinct-estimates': { columns: [{ name: 'exact_visitors', type: 'UInt64' }, { name: 'estimated_visitors', type: 'UInt64' }, { name: 'difference_pct', type: 'Float64' }], rows: [[84216, 84102, 0.14]] },
};
const demoStarterIdBySql = new Map(DEMO_PREVIEW_STARTERS.map(starter => [normalizePreviewSql(starter.sql), starter.id]));

function previewRowsFor(sql: string): PreviewRows {
    const starterId = demoStarterIdBySql.get(normalizePreviewSql(sql));
    return starterId ? demoResultRows[starterId] ?? dailyRows() : dailyRows();
}

function resultFor(run: Run, sequence: number): Result {
    const preview = previewRowsFor(run.sql);
    const columns = run.kind === 'query'
        ? preview.columns
        : [{ name: 'explain', type: 'String' }];
    const resultRows = run.kind === 'query'
        ? preview.rows
        : [[run.kind === 'plan'
            ? JSON.stringify([{ Plan: { 'Node Type': 'Expression', 'Node Id': 'Expression_2', Description: 'Sample plan only; SQL is not evaluated.', Plans: [{ 'Node Type': 'ReadFromFixture', 'Node Id': 'ReadFromFixture_0' }] } }])
            : run.kind === 'pipeline'
                ? 'digraph { read [label="ReadFromFixture"]; filter [label="FilterTransform × 2"]; output [label="Output"]; read -> filter; filter -> output; }'
                : `Sample index analysis for run ${sequence}. SQL is not evaluated.`]];
    return {
        runId: run.id, queryId: run.queryId, columns, rows: resultRows,
        completeness: 'complete', createdAt: now(), expiresAt: expiresAt(),
    };
}

function chartConfig(value: unknown): QueryDocument['chart'] {
    const chart = record(value);
    const chartIndex = (index: unknown): index is number => typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 && index <= 499;
    if (chart.kind === 'candlestick' && chartIndex(chart.x) && Array.isArray(chart.ys) && chart.ys.every(chartIndex) && typeof chart.title === 'string') {
        const candle = record(chart.candlestick);
        return {
            kind: 'candlestick', x: chart.x, ys: chart.ys.filter(chartIndex), title: chart.title,
            candlestick: {
                ...(chartIndex(candle.open) ? { open: candle.open } : {}), ...(chartIndex(candle.high) ? { high: candle.high } : {}),
                ...(chartIndex(candle.low) ? { low: candle.low } : {}), ...(chartIndex(candle.close) ? { close: candle.close } : {}),
                ...(chartIndex(candle.bid) ? { bid: candle.bid } : {}), ...(chartIndex(candle.ask) ? { ask: candle.ask } : {}),
                ...(chartIndex(candle.spread) ? { spread: candle.spread } : {}), ...(chartIndex(candle.quoteActivity) ? { quoteActivity: candle.quoteActivity } : {}),
            },
        };
    }
    if ((chart.kind === 'table' || chart.kind === 'number' || chart.kind === 'line' || chart.kind === 'bar' || chart.kind === 'scatter' || chart.kind === 'heatmap') &&
        chartIndex(chart.x) && Array.isArray(chart.ys) && chart.ys.every(chartIndex) && typeof chart.title === 'string')
        return { kind: chart.kind, x: chart.x, ...(chartIndex(chart.groupBy) ? { groupBy: chart.groupBy } : {}), ys: chart.ys.filter(chartIndex), title: chart.title };
    return { kind: 'table', x: 0, ys: [], title: 'Query result' };
}

function metricContract(value: unknown): QueryDocument['metric'] {
    const metric = record(value);
    if (typeof metric.definition === 'string' && typeof metric.grain === 'string' && typeof metric.timezone === 'string' &&
        typeof metric.filters === 'string' && typeof metric.nullTreatment === 'string' && Array.isArray(metric.dimensions) &&
        metric.dimensions.every(item => typeof item === 'string') && Array.isArray(metric.sourceColumns) &&
        metric.sourceColumns.every(item => typeof item === 'string'))
        return {
            definition: metric.definition, grain: metric.grain, timezone: metric.timezone,
            filters: metric.filters, nullTreatment: metric.nullTreatment,
            dimensions: metric.dimensions.filter((item): item is string => typeof item === 'string'),
            sourceColumns: metric.sourceColumns.filter((item): item is string => typeof item === 'string'),
        };
    return undefined;
}

function makeRun(id: string, sql: string, kind: Run['kind'], sequence: number, parameters: Record<string, string> = {}): Run {
    const createdAt = now();
    const queryId = `preview-${sequence}`;
    const resultState = 'reopenable' as const;
    const preview = previewRowsFor(sql);
    const columns = kind === 'query'
        ? preview.columns
        : [{ name: 'explain', type: 'String' }];
    const resultRows = kind === 'query' ? preview.rows.length : 1;
    return {
        dataSource: 'fixture', id, queryId, owner, connectionId: 'demo', sql, kind, parameters,
        limits: { ...DEFAULT_LIMITS }, tags: { workspace: 'clickstudio', mode: 'sample preview' },
        status: 'succeeded', createdAt, startedAt: createdAt, finishedAt: createdAt, elapsedMs: 38 + sequence,
        rowCount: resultRows, bytes: kind === 'query' ? JSON.stringify(preview.rows).length : 90, columns, warnings: ['DEMO FIXTURE: these generated rows do not evaluate the SQL in the editor.'],
        sequence, resultExpiresAt: expiresAt(), resultState, requestedBy: owner, executedAs: 'sample-reader',
        permissionSnapshot: { readonly: true, role: 'owner' }, retryPolicy: 'never',
    };
}

export class DemoPreviewApi {
    private trusted = true;
    private runs = new Map<string, Run>();
    private results = new Map<string, Result>();
    private scripts = new Map<string, Script>();
    private documents = new Map<string, QueryDocument>();
    private revisions = new Map<string, QueryDocument[]>();
    private sequence = 0;

    constructor() {
        this.restore();
        if (!this.runs.has(DEMO_PREVIEW_RUN_ID)) this.addRun(DEMO_PREVIEW_RUN_ID, DEMO_PREVIEW_SQL, 'query', {});
        for (const starter of DEMO_PREVIEW_STARTERS) {
            if (this.documents.has(starter.id)) continue;
            const runId = demoPreviewStarterRunId(starter.id);
            const run = this.runs.get(runId) ?? this.addRun(runId, starter.sql, 'query', {});
            const timestamp = now();
            const document: QueryDocument = {
                id: starter.id, owner, name: starter.name, connectionId: 'demo', sql: starter.sql,
                revision: starter.revision ?? 1, createdAt: timestamp, updatedAt: timestamp, parameters: {}, chart: starter.chart,
                runId: run.id, dependencies: [], kind: 'query',
            };
            const sqlVersions = starter.id === DEMO_PREVIEW_STARTER_DOCUMENT_ID ? DEMO_PREVIEW_STARTER_VERSIONS : [starter.sql];
            const nowMs = Date.now(), firstSavedAt = nowMs - (sqlVersions.length - 1) * 86_400_000;
            const versions = sqlVersions.map((sql, index): QueryDocument => ({
                ...document,
                sql,
                revision: index + 1,
                createdAt: new Date(firstSavedAt).toISOString(),
                updatedAt: new Date(firstSavedAt + index * 86_400_000).toISOString(),
                runId: index === sqlVersions.length - 1 ? run.id : undefined,
            }));
            this.documents.set(starter.id, versions[versions.length - 1]!);
            this.revisions.set(starter.id, versions);
        }
        if (!this.documents.has(PLAYGROUND_PREVIEW_STARTER.id)) {
            const timestamp = now();
            this.documents.set(PLAYGROUND_PREVIEW_STARTER.id, {
                id: PLAYGROUND_PREVIEW_STARTER.id, owner, name: PLAYGROUND_PREVIEW_STARTER.name,
                connectionId: PLAYGROUND_CONNECTION_ID, sql: PLAYGROUND_PREVIEW_STARTER.sql,
                revision: 1, createdAt: timestamp, updatedAt: timestamp, parameters: {},
                chart: PLAYGROUND_PREVIEW_STARTER.chart, dependencies: [], kind: 'query',
            });
        }
        for (const document of this.documents.values())
            if (!this.revisions.has(document.id)) this.revisions.set(document.id, [document]);
        this.persist();
    }

    private restore() {
        try {
            const saved: unknown = JSON.parse(localStorage.getItem(previewStorageKey) ?? 'null');
            if (record(saved).version !== 1) return;
            const state = record(saved);
            if (typeof state.trusted === 'boolean') this.trusted = state.trusted;
            if (typeof state.sequence === 'number' && Number.isSafeInteger(state.sequence) && state.sequence >= 0) this.sequence = state.sequence;
            if (Array.isArray(state.runs)) for (const value of state.runs) {
                if (isRun(value))
                    this.runs.set(value.id, value);
            }
            if (Array.isArray(state.results)) for (const value of state.results) {
                if (!isResult(value)) continue;
                const run = this.runs.get(value.runId);
                const expiredPlaygroundResult = run?.connectionId === PLAYGROUND_CONNECTION_ID &&
                    Date.parse(value.expiresAt) <= Date.now();
                if (!expiredPlaygroundResult)
                    this.results.set(value.runId, value);
            }
            if (Array.isArray(state.scripts)) for (const value of state.scripts) {
                const script = record(value);
                if (typeof script.id === 'string' && typeof script.sql === 'string') this.scripts.set(script.id, value as Script);
            }
            if (Array.isArray(state.documents)) for (const value of state.documents) {
                const document = record(value);
                if (typeof document.id === 'string' && typeof document.sql === 'string' && typeof document.name === 'string')
                    this.documents.set(document.id, value as QueryDocument);
            }
            if (Array.isArray(state.revisions)) for (const entry of state.revisions) {
                if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) continue;
                const versions = entry[1].filter((value): value is QueryDocument => {
                    const revision = record(value);
                    return typeof revision.id === 'string' && typeof revision.name === 'string' && typeof revision.sql === 'string' &&
                        typeof revision.revision === 'number' && Number.isSafeInteger(revision.revision) && revision.revision > 0;
                });
                if (versions.length) this.revisions.set(entry[0], versions);
            }
            for (const run of this.runs.values()) {
                if (run.connectionId === PLAYGROUND_CONNECTION_ID && run.resultState === 'reopenable' && !this.results.has(run.id))
                    this.runs.set(run.id, { ...run, resultState: 'expired' });
            }
            for (const run of this.runs.values()) this.sequence = Math.max(this.sequence, run.sequence);
        } catch {
            this.runs.clear();
            this.results.clear();
            this.scripts.clear();
            this.documents.clear();
            this.revisions.clear();
            this.sequence = 0;
        }
    }

    private persist() {
        try {
            const runs = [...this.runs.values()].slice(-100);
            const results = [...this.results.values()].slice(-100);
            const serialize = () => JSON.stringify({
                version: 1, trusted: this.trusted, sequence: this.sequence,
                runs, results, scripts: [...this.scripts.values()].slice(-50), documents: [...this.documents.values()].slice(-100),
                revisions: [...this.revisions.entries()].slice(-100),
            });
            let serialized = serialize();
            while (serialized.length > previewStorageBudget) {
                const oldestPlaygroundResult = results.findIndex(result => this.runs.get(result.runId)?.connectionId === PLAYGROUND_CONNECTION_ID);
                if (oldestPlaygroundResult < 0) break;
                results.splice(oldestPlaygroundResult, 1);
                serialized = serialize();
            }
            localStorage.setItem(previewStorageKey, serialized);
        } catch {}
    }

    private addRun(id: string, sql: string, kind: Run['kind'], parameters: Record<string, string>) {
        const run = makeRun(id, sql, kind, ++this.sequence, parameters);
        this.runs.set(id, run);
        this.results.set(id, resultFor(run, this.sequence));
        this.persist();
        return run;
    }

    private getRun(id: string) {
        let run = this.runs.get(id);
        if (!run) throw new Error('This retained run is no longer available in this browser. Run the SQL again.');
        const expiresAtMs = run.resultExpiresAt ? Date.parse(run.resultExpiresAt) : Number.NaN;
        if (run.connectionId === PLAYGROUND_CONNECTION_ID && run.resultState === 'reopenable' &&
            (!this.results.has(run.id) || Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now())) {
            this.results.delete(run.id);
            run = { ...run, resultState: 'expired' };
            this.runs.set(run.id, run);
            this.persist();
        }
        return run;
    }

    private documentsFor(trash: boolean, connectionId?: string | null) {
        return [...this.documents.values()].filter(document =>
            (trash || !document.deletedAt) && (!connectionId || document.connectionId === connectionId));
    }

    private saveDocument(input: Record<string, unknown>, id?: string) {
        const previous = id ? this.documents.get(id) : undefined;
        const timestamp = now();
        const parameters = Object.fromEntries(Object.entries(record(input.parameters)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
        const document: QueryDocument = {
            id: previous?.id ?? id ?? crypto.randomUUID(), owner, name: typeof input.name === 'string' ? input.name : 'Untitled.sql',
            connectionId: input.connectionId === PLAYGROUND_CONNECTION_ID ? PLAYGROUND_CONNECTION_ID : 'demo',
            sql: typeof input.sql === 'string' ? input.sql : DEMO_PREVIEW_SQL,
            revision: (previous?.revision ?? 0) + 1, createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp,
            parameters,
            chart: chartConfig(input.chart),
            runId: typeof input.runId === 'string' ? input.runId : undefined,
            parentDocumentId: typeof input.parentDocumentId === 'string' ? input.parentDocumentId : undefined,
            dependencies: Array.isArray(input.dependencies) ? input.dependencies.filter((value): value is string => typeof value === 'string') : [],
            kind: input.kind === 'metric' || input.kind === 'snippet' ? input.kind : 'query',
            metric: metricContract(input.metric),
            ...(previous?.deletedAt ? { deletedAt: previous.deletedAt } : {}),
        };
        this.documents.set(document.id, document);
        const versions = this.revisions.get(document.id) ?? (previous ? [previous] : []);
        this.revisions.set(document.id, [...versions, document]);
        this.persist();
        return document;
    }

    async request(path: string, options: RequestOptions = {}): Promise<unknown> {
        if (options.signal?.aborted) throw options.signal.reason ?? new Error('The request was cancelled.');
        const url = new URL(path, 'https://preview.invalid');
        const pathname = url.pathname.replace(/\/+$/, '') || '/';
        const method = options.method ?? 'GET';
        const parts = pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
        const body = record(options.body);

        if (pathname === '/session') return { principal: { id: owner, role: 'owner' }, requiresLogin: false, demo: true };
        if (pathname === '/connections' && method === 'GET') return [connection(this.trusted), PLAYGROUND_CONNECTION];
        if (parts[0] === 'connections' && parts[1] === 'demo' && parts[2] === 'schema') return schema;
        if (parts[0] === 'connections' && parts[1] === PLAYGROUND_CONNECTION_ID && parts[2] === 'schema')
            return loadPlaygroundSchema(options.signal, url.searchParams.get('refresh') === 'true');
        if (parts[0] === 'connections' && parts[1] === 'demo' && parts[2] === 'trust' && method === 'POST') {
            this.trusted = body.trusted === true;
            this.persist();
            return { trusted: this.trusted };
        }
        if (parts[0] === 'connections' && parts[1] === 'demo' && parts[2] === 'import-targets') return [];
        if (parts[0] === 'connections' && parts[1] === PLAYGROUND_CONNECTION_ID && parts[2] === 'import-targets') return [];

        if (pathname === '/runs' && method === 'POST') {
            const requestedKind = body.kind === 'explain' || body.kind === 'plan' || body.kind === 'pipeline' ? body.kind : 'query';
            const parameters = record(body.parameters) as Record<string, string>;
            if (body.connectionId === PLAYGROUND_CONNECTION_ID) {
                if (Object.keys(parameters).length) throw new Error('Remove query parameters before running SQL on ClickHouse Playground.');
                const sql = typeof body.sql === 'string' ? body.sql : '';
                const executionSql = sqlForRunKind(sql, requestedKind);
                const response = await queryPlayground(executionSql, options.signal);
                const finishedAt = now();
                const startedAt = new Date(Date.now() - response.elapsedMs).toISOString();
                const runId = crypto.randomUUID();
                const status = response.truncated ? 'truncated' as const : 'succeeded' as const;
                const warnings = response.truncated
                    ? ['The result reached the 1,000-row display limit and may be incomplete.']
                    : [];
                const resultExpiresAt = expiresAt();
                const run: Run = {
                    dataSource: 'clickhouse', id: runId, queryId: response.queryId, owner,
                    connectionId: PLAYGROUND_CONNECTION_ID, sql, kind: requestedKind, parameters: {},
                    limits: { ...PLAYGROUND_CONNECTION.limits },
                    tags: { workspace: 'clickstudio', source: 'ClickHouse SQL Playground', execution: 'browser direct' },
                    status, createdAt: startedAt, startedAt, finishedAt, elapsedMs: response.elapsedMs,
                    rowCount: response.rows.length, bytes: response.bytes, columns: response.columns, warnings,
                    sequence: ++this.sequence, resultExpiresAt, resultState: 'reopenable',
                    requestedBy: owner, executedAs: PLAYGROUND_CONNECTION.username,
                    permissionSnapshot: { readonly: true, role: 'public demo' }, retryPolicy: 'never',
                };
                const result: Result = {
                    runId, queryId: response.queryId, columns: response.columns, rows: response.rows,
                    completeness: response.truncated ? 'truncated' : 'complete', createdAt: finishedAt, expiresAt: resultExpiresAt,
                };
                this.runs.set(run.id, run);
                this.results.set(run.id, result);
                this.persist();
                return run;
            }
            const run = this.addRun(crypto.randomUUID(), typeof body.sql === 'string' ? body.sql : DEMO_PREVIEW_SQL, requestedKind, parameters);
            return run;
        }
        if (pathname === '/runs' && method === 'GET') {
            const connectionId = url.searchParams.get('connectionId');
            return [...this.runs.values()].filter(run => !connectionId || run.connectionId === connectionId).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.sequence - left.sequence);
        }
        if (parts[0] === 'runs' && parts[1]) {
            const run = this.getRun(parts[1]);
            if (parts[2] === 'result' || parts[2] === 'snapshot') {
                const result = this.results.get(run.id);
                if (!result && run.connectionId === PLAYGROUND_CONNECTION_ID)
                    throw new Error('This retained Playground result is no longer available in this browser. Run the SQL again.');
                const retained = result ?? resultFor(run, run.sequence);
                if (parts[2] === 'snapshot') return retained;
                const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
                const count = Math.max(1, Math.min(500, Number(url.searchParams.get('count') ?? 200) || 200));
                return { ...retained, rows: retained.rows.slice(offset, offset + count), offset, totalRows: retained.rows.length, nextOffset: offset + count < retained.rows.length ? offset + count : null } satisfies ResultPage;
            }
            if (parts[2] === 'cancel' && method === 'POST') {
                const cancelled = { ...run, status: 'cancelled' as const, resultState: 'unavailable' as const, finishedAt: now() };
                this.runs.set(run.id, cancelled);
                this.results.delete(run.id);
                this.persist();
                return cancelled;
            }
            if (parts[2] === 'profile') {
                if (run.connectionId === PLAYGROUND_CONNECTION_ID)
                    throw new Error('Query-log and pipeline profiling are unavailable on ClickHouse Playground.');
                const pipeline = {
                    available: true, source: 'query_shape' as const, truncated: false,
                    nodes: [
                        { id: 'read', label: 'Sample rows', kind: 'read' as const, status: 'estimated' as const, rows: String(run.rowCount) },
                        { id: 'output', label: 'Output', kind: 'output' as const, status: 'estimated' as const, rows: String(run.rowCount) },
                    ],
                    edges: [{ source: 'read', target: 'output' }],
                };
                if (parts[3] === 'pipeline') return pipeline;
                return {
                    version: 1, queryId: run.queryId, runId: run.id,
                    summary: { durationMs: run.elapsedMs, resultRows: run.rowCount, readRows: String(run.rowCount), readBytes: String(run.bytes) },
                    insights: [], pipeline,
                    capabilities: { queryLog: false, pipelineGraph: true, indexAnalysis: false, runtimePlan: false },
                    evidence: [], notice: 'Generated preview data only. This is not a ClickHouse profile.',
                };
            }
            return run;
        }

        if (pathname === '/scripts' && method === 'POST') {
            if (body.connectionId === PLAYGROUND_CONNECTION_ID)
                throw new Error('Run one statement at a time on ClickHouse Playground.');
            const sql = typeof body.sql === 'string' ? body.sql : DEMO_PREVIEW_SQL;
            const id = crypto.randomUUID();
            const statements = splitSql(sql);
            const items = statements.map(statement => {
                const run = this.addRun(crypto.randomUUID(), statement.sql, 'query', record(body.parameters) as Record<string, string>);
                return { ...statement, runId: run.id, status: 'succeeded' as const };
            });
            const script: Script = { id, owner, connectionId: 'demo', sql, createdAt: now(), status: 'succeeded', stopOnError: body.stopOnError !== false, cancelled: false, statements: items };
            this.scripts.set(id, script);
            this.persist();
            return script;
        }
        if (parts[0] === 'scripts' && parts[1]) return this.scripts.get(parts[1]) ?? { id: parts[1], owner, connectionId: 'demo', sql: DEMO_PREVIEW_SQL, createdAt: now(), status: 'succeeded', stopOnError: true, cancelled: false, statements: [] } satisfies Script;

        if (pathname === '/documents' && method === 'GET') return this.documentsFor(url.searchParams.get('trash') === 'true', url.searchParams.get('connectionId'));
        if (pathname === '/documents' && method === 'POST') return this.saveDocument(body);
        if (parts[0] === 'documents' && parts[1]) {
            const id = parts[1];
            if (parts.length === 2 && method === 'PUT') return this.saveDocument(body, id);
            if (parts[2] === 'revisions' && method === 'GET') {
                const current = this.documents.get(id);
                if (!current) throw new Error('Sample document not found.');
                return [...(this.revisions.get(id) ?? [current])].sort((left, right) => right.revision - left.revision);
            }
            if (parts[2] === 'restore-revision' && method === 'POST') {
                const current = this.documents.get(id);
                if (!current) throw new Error('Sample document not found.');
                const revisionNumber = typeof body.revision === 'number' ? body.revision : Number(body.revision);
                const baseRevision = typeof body.baseRevision === 'number' ? body.baseRevision : Number(body.baseRevision);
                if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1 || !Number.isSafeInteger(baseRevision) || baseRevision < 1)
                    throw new Error('Choose a valid saved version to restore.');
                if (current.revision !== baseRevision) throw new Error('A newer version exists. Refresh version history and try again.');
                const historical = this.revisions.get(id)?.find(version => version.revision === revisionNumber);
                if (!historical) throw new Error('This saved version is no longer available. Refresh version history and try again.');
                const restored: QueryDocument = { ...historical, revision: current.revision + 1, updatedAt: now(), runId: undefined };
                this.documents.set(id, restored);
                this.revisions.set(id, [...(this.revisions.get(id) ?? [current]), restored]);
                this.persist();
                return restored;
            }
            if (parts.length === 2 && method === 'DELETE') {
                const document = this.documents.get(id);
                if (document) {
                    this.documents.set(id, { ...document, deletedAt: now() });
                    this.persist();
                }
                return { ok: true };
            }
            if (parts[2] === 'restore' && method === 'POST') {
                const document = this.documents.get(id);
                if (document) {
                    const { deletedAt: _deletedAt, ...restored } = document;
                    this.documents.set(id, restored);
                    this.persist();
                    return restored;
                }
            }
            if (parts.length === 2) return this.documents.get(id) ?? { error: { code: 'NOT_FOUND', message: 'Sample document not found.' } };
        }

        if (pathname === '/assistant/status') return { available: false, reason: 'Assistant features are unavailable in the static sample preview.' };
        if (pathname === '/voice/status') return { available: false, reason: 'Voice features are unavailable in the static sample preview.' };
        if (pathname === '/imports' || pathname === '/monitors' || pathname === '/notices' || pathname === '/audit' || pathname === '/published') return [];
        if (pathname === '/health') return { ok: true, demo: true, version: '0.1.0' };
        return {};
    }
}
