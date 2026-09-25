import type { QueryDocument, Result, ResultPage, Run, Script } from '../shared/types.js';
import { splitSql } from '../shared/sql.js';
import { sqlForRunKind } from '../shared/explain-plan.js';
import { isResult, isRun } from '../shared/run-wire.js';
import { loadPlaygroundSchema, PLAYGROUND_CONNECTION, PLAYGROUND_CONNECTION_ID, queryPlayground, queryPlaygroundQueryTree } from './playground.js';
import {
    DEMO_PREVIEW_RUN_ID,
    DEMO_PREVIEW_SQL,
    DEMO_PREVIEW_STARTER_DOCUMENT_ID,
    DEMO_PREVIEW_STARTERS,
    DEMO_PREVIEW_STARTER_VERSIONS,
    PLAYGROUND_PREVIEW_STARTER,
    demoPreviewStarterRunId,
} from './demo-preview-data.js';
import {
    chartConfig,
    connection,
    expiresAt,
    makeRun,
    metricContract,
    now,
    owner,
    previewStorageBudget,
    previewStorageKey,
    record,
    resultFor,
    schema,
} from './demo-preview-fixtures.js';

export {
    DEMO_PREVIEW_INITIAL_STARTERS,
    DEMO_PREVIEW_RUN_ID,
    DEMO_PREVIEW_SQL,
    DEMO_PREVIEW_STARTER_DOCUMENT_ID,
    DEMO_PREVIEW_STARTERS,
    PLAYGROUND_PREVIEW_STARTER,
    demoPreviewStarterRunId,
} from './demo-preview-data.js';
export type { DemoPreviewStarter } from './demo-preview-data.js';

type RequestOptions = { method?: string; body?: unknown; signal?: AbortSignal };
const demoQueryTree = [
    'QUERY id: 0',
    '  PROJECTION COLUMNS',
    '    event_type LowCardinality(String)',
    '    events UInt64',
    '  PROJECTION',
    '    LIST id: 1, nodes: 2',
    '      COLUMN id: 2, column_name: event_type, result_type: LowCardinality(String), source_id: 5',
    '      FUNCTION id: 3, function_name: count, function_type: aggregate, result_type: UInt64',
    '  JOIN TREE',
    '    TABLE id: 5, table_name: demo.events',
] as const;

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
        this.results.set(id, resultFor(run));
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
        if (parts[0] === 'connections' && parts[2] === 'query-tree' && method === 'POST') {
            const sql = typeof body.sql === 'string' ? body.sql : '';
            const parameters = record(body.parameters) as Record<string, string>;
            if (parts[1] === PLAYGROUND_CONNECTION_ID) {
                if (Object.keys(parameters).length) throw new Error('Remove query parameters before inspecting SQL on ClickHouse Playground.');
                const response = await queryPlaygroundQueryTree(sql, options.signal);
                return response.rows.map(row => String(row[0] ?? '')).filter(Boolean);
            }
            if (parts[1] === 'demo') return [...demoQueryTree];
        }

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
                const retained = result ?? resultFor(run);
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
