import { DEFAULT_LIMITS, type Connection, type QueryDocument, type Result, type ResultPage, type Run, type Schema, type Script } from '../shared/types';
import { SAMPLE_SQL } from './workspace-state';

export const DEMO_PREVIEW_RUN_ID = 'preview-sample-run';

type RequestOptions = { method?: string; body?: unknown; signal?: AbortSignal };

const owner = 'preview-user';
const expiresAt = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const now = () => new Date().toISOString();
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const schema: Schema = {
    connectionId: 'demo',
    fetchedAt: now(),
    tables: [
        { database: 'demo', name: 'events', engine: 'MergeTree', orderBy: '(tenant_id, day)', primaryKey: 'tenant_id, day', partitionKey: 'toYYYYMM(day)', rowEstimate: '2840000000', sizeBytes: '442381631488', uncompressedBytes: '1724663015424', parts: '58', activeParts: '52', skipIndexTypes: ['bloom_filter', 'minmax'], projections: [{ name: 'by_tenant_day', type: 'Normal', sortingKey: 'tenant_id, day' }], skipIndexes: [{ name: 'tenant_bloom', type: 'bloom_filter', expression: 'tenant_id', granularity: '4' }] },
        { database: 'demo', name: 'daily_rollup', engine: 'SummingMergeTree', orderBy: '(day)', rowEstimate: '365', sizeBytes: '65536', uncompressedBytes: '131072', parts: '1', activeParts: '1' },
    ],
    columns: [
        { database: 'demo', table: 'events', name: 'tenant_id', type: 'UInt64', comment: 'Sample tenant identifier', defaultKind: '' },
        { database: 'demo', table: 'events', name: 'day', type: 'Date', comment: 'Sample event date', defaultKind: '' },
        { database: 'demo', table: 'events', name: 'event_type', type: 'LowCardinality(String)', comment: 'Sample event category', defaultKind: '' },
        { database: 'demo', table: 'events', name: 'revenue', type: 'Decimal(18, 2)', comment: 'Sample revenue amount', defaultKind: '' },
        { database: 'demo', table: 'daily_rollup', name: 'day', type: 'Date', comment: 'Daily date bucket', defaultKind: '' },
        { database: 'demo', table: 'daily_rollup', name: 'events', type: 'UInt64', comment: 'Daily event count', defaultKind: '' },
    ],
    dictionaries: [{ database: 'demo', name: 'campaign_lookup', status: 'LOADED', type: 'Hashed', keyColumns: 'campaign_id UInt64', attributeColumns: 'campaign_name String, channel String', elementCount: '18240', memoryBytes: '5242880', lastSuccessfulUpdate: '2026-09-23 08:15:00' }],
    warnings: ['Sample schema and values are generated for the frontend preview.'],
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

function resultFor(run: Run, sequence: number): Result {
    const rows = Array.from({ length: 7 }, (_, index) => [
        `2026-01-${String(index + 1).padStart(2, '0')}`,
        String((index + 1) * 10 + Math.max(sequence - 1, 0) * 3),
    ]);
    const columns = run.kind === 'query'
        ? [{ name: 'day', type: 'Date' }, { name: 'events', type: 'UInt64' }]
        : [{ name: run.kind === 'explain' ? 'explain' : 'pipeline', type: 'String' }];
    const resultRows = run.kind === 'query'
        ? rows
        : [[run.kind === 'explain' ? 'Sample plan. SQL is not evaluated.' : 'digraph { read -> filter -> output }']];
    return {
        runId: run.id, queryId: run.queryId, columns, rows: resultRows,
        completeness: 'complete', createdAt: now(), expiresAt: expiresAt(),
    };
}

function chartConfig(value: unknown): QueryDocument['chart'] {
    const chart = record(value);
    if ((chart.kind === 'table' || chart.kind === 'number' || chart.kind === 'line' || chart.kind === 'bar') &&
        typeof chart.x === 'number' && Number.isFinite(chart.x) && Array.isArray(chart.ys) && chart.ys.every(index => Number.isInteger(index)) && typeof chart.title === 'string')
        return { kind: chart.kind, x: chart.x, ys: chart.ys.filter((index): index is number => Number.isInteger(index)), title: chart.title };
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
    const columns = kind === 'query'
        ? [{ name: 'day', type: 'Date' }, { name: 'events', type: 'UInt64' }]
        : [{ name: kind === 'explain' ? 'explain' : 'pipeline', type: 'String' }];
    const resultRows = kind === 'query' ? 7 : 1;
    return {
        dataSource: 'fixture', id, queryId, owner, connectionId: 'demo', sql, kind, parameters,
        limits: { ...DEFAULT_LIMITS }, tags: { workspace: 'clickstudio', mode: 'sample preview' },
        status: 'succeeded', createdAt, startedAt: createdAt, finishedAt: createdAt, elapsedMs: 38 + sequence,
        rowCount: resultRows, bytes: resultRows * 24, columns, warnings: ['DEMO FIXTURE: these generated rows do not evaluate the SQL in the editor.'],
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
    private sequence = 0;

    constructor() {
        this.addRun(DEMO_PREVIEW_RUN_ID, SAMPLE_SQL, 'query', {});
    }

    private addRun(id: string, sql: string, kind: Run['kind'], parameters: Record<string, string>) {
        const run = makeRun(id, sql, kind, ++this.sequence, parameters);
        this.runs.set(id, run);
        this.results.set(id, resultFor(run, this.sequence));
        return run;
    }

    private getRun(id: string) {
        let run = this.runs.get(id);
        if (!run) run = this.addRun(id, SAMPLE_SQL, 'query', {});
        return run;
    }

    private documentsFor(trash: boolean) {
        return [...this.documents.values()].filter(document => Boolean(document.deletedAt) === trash);
    }

    private saveDocument(input: Record<string, unknown>, id?: string) {
        const previous = id ? this.documents.get(id) : undefined;
        const timestamp = now();
        const parameters = Object.fromEntries(Object.entries(record(input.parameters)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
        const document: QueryDocument = {
            id: previous?.id ?? id ?? crypto.randomUUID(), owner, name: typeof input.name === 'string' ? input.name : 'Untitled.sql',
            connectionId: 'demo', sql: typeof input.sql === 'string' ? input.sql : SAMPLE_SQL,
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
        if (pathname === '/connections' && method === 'GET') return [connection(this.trusted)];
        if (parts[0] === 'connections' && parts[1] === 'demo' && parts[2] === 'schema') return schema;
        if (parts[0] === 'connections' && parts[1] === 'demo' && parts[2] === 'trust' && method === 'POST') {
            this.trusted = body.trusted === true;
            return { trusted: this.trusted };
        }
        if (parts[0] === 'connections' && parts[1] === 'demo' && parts[2] === 'import-targets') return [];

        if (pathname === '/runs' && method === 'POST') {
            const requestedKind = body.kind === 'explain' || body.kind === 'pipeline' ? body.kind : 'query';
            const parameters = record(body.parameters) as Record<string, string>;
            const run = this.addRun(crypto.randomUUID(), typeof body.sql === 'string' ? body.sql : SAMPLE_SQL, requestedKind, parameters);
            return run;
        }
        if (pathname === '/runs' && method === 'GET') {
            const connectionId = url.searchParams.get('connectionId');
            return [...this.runs.values()].filter(run => !connectionId || run.connectionId === connectionId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        }
        if (parts[0] === 'runs' && parts[1]) {
            const run = this.getRun(parts[1]);
            if (parts[2] === 'result' || parts[2] === 'snapshot') {
                const result = this.results.get(run.id) ?? resultFor(run, run.sequence);
                if (parts[2] === 'snapshot') return result;
                const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
                const count = Math.max(1, Math.min(500, Number(url.searchParams.get('count') ?? 200) || 200));
                return { ...result, rows: result.rows.slice(offset, offset + count), offset, totalRows: result.rows.length, nextOffset: offset + count < result.rows.length ? offset + count : null } satisfies ResultPage;
            }
            if (parts[2] === 'cancel' && method === 'POST') {
                const cancelled = { ...run, status: 'cancelled' as const, resultState: 'unavailable' as const, finishedAt: now() };
                this.runs.set(run.id, cancelled);
                this.results.delete(run.id);
                return cancelled;
            }
            if (parts[2] === 'profile') {
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
            const sql = typeof body.sql === 'string' ? body.sql : SAMPLE_SQL;
            const id = crypto.randomUUID();
            const statements = sql.split(';').map(value => value.trim()).filter(Boolean);
            const items = statements.map((statement, index) => {
                const run = this.addRun(crypto.randomUUID(), statement, 'query', record(body.parameters) as Record<string, string>);
                return { sql: statement, from: 0, to: statement.length, runId: run.id, status: 'succeeded' as const };
            });
            const script: Script = { id, owner, connectionId: 'demo', sql, createdAt: now(), status: 'succeeded', stopOnError: body.stopOnError !== false, cancelled: false, statements: items };
            this.scripts.set(id, script);
            return script;
        }
        if (parts[0] === 'scripts' && parts[1]) return this.scripts.get(parts[1]) ?? { id: parts[1], owner, connectionId: 'demo', sql: SAMPLE_SQL, createdAt: now(), status: 'succeeded', stopOnError: true, cancelled: false, statements: [] } satisfies Script;

        if (pathname === '/documents' && method === 'GET') return this.documentsFor(url.searchParams.get('trash') === 'true');
        if (pathname === '/documents' && method === 'POST') return this.saveDocument(body);
        if (parts[0] === 'documents' && parts[1]) {
            const id = parts[1];
            if (parts.length === 2 && method === 'PUT') return this.saveDocument(body, id);
            if (parts.length === 2 && method === 'DELETE') {
                const document = this.documents.get(id);
                if (document) this.documents.set(id, { ...document, deletedAt: now() });
                return { ok: true };
            }
            if (parts[2] === 'restore' && method === 'POST') {
                const document = this.documents.get(id);
                if (document) {
                    const { deletedAt: _deletedAt, ...restored } = document;
                    this.documents.set(id, restored);
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
