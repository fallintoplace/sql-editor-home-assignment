import express, { type Request, type Response, type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AssistantAction, AuditEvent, Principal, Proposal, Run, Schema } from '../shared/types.js';
import type { QueryDriver } from '../core/runs.js';
import { RunService, terminal } from '../core/runs.js';
import { ArtifactService } from '../core/artifacts.js';
import { AssistantService, type AssistantDriver } from '../core/assistant.js';
import { ImportService, type ImportDriver } from '../core/imports.js';
import { MonitorService } from '../core/monitors.js';
import { SessionService } from '../core/sessions.js';
import { FileStore, type Store } from '../core/store.js';
import { AppError, asError, requireThat } from '../core/errors.js';
import { canWrite } from '../core/guards.js';
import { identifier, integer, record, stringMap, text } from '../core/validation.js';
import { exportCsv } from '../shared/results.js';
import { buildQueryProfile } from '../shared/profile.js';
import { configuredSecrets, redactor, type Config } from './config.js';
import { ClickHouseDriver } from './clickhouse.js';
import { DemoDriver } from './demo.js';
import { OpenAIDriver } from './openai.js';
import { OpenAIVoiceService, safetyIdentifier, type VoiceService } from './voice.js';
import { telemetry, recordRun } from './telemetry.js';
type Driver = QueryDriver & ImportDriver & Pick<ClickHouseDriver, 'connection' | 'connections' | 'test' | 'targets' | 'profileEvidence' | 'profilePipeline' | 'systemTableDocumentation' | 'close'>;
const MAX_WASM_PARSER_BYTES = 64 * 1024 * 1024;
let parserWasmCache: Promise<Uint8Array> | undefined;
async function loadClickHouseParserWasm(): Promise<Uint8Array> {
    let bytes: Buffer;
    try {
        bytes = await readFile(new URL('../vendor/clickhouse-parser/parser.wasm', import.meta.url));
    } catch {
        throw new AppError(503, 'PARSER_UNAVAILABLE', 'The bundled ClickHouse native parser is unavailable');
    }
    if (bytes.length < 8 || bytes.length > MAX_WASM_PARSER_BYTES || !bytes.subarray(0, 4).equals(Buffer.from([0x00, 0x61, 0x73, 0x6d])))
        throw new AppError(503, 'PARSER_UNAVAILABLE', 'The bundled ClickHouse native parser is invalid');
    return bytes;
}
function cachedClickHouseParserWasm(): Promise<Uint8Array> {
    parserWasmCache ??= loadClickHouseParserWasm().catch(error => {
        parserWasmCache = undefined;
        throw error;
    });
    return parserWasmCache;
}
function mappingFields(value: unknown) { const fields = record(value, 'mapping'); requireThat(Object.keys(fields).length <= 200, 400, 'IMPORT_MAPPING', 'Too many mapping fields'); return Object.fromEntries(Object.entries(fields).map(([key, value]) => [text(key, 'source column', 256), text(value, 'destination column', 256)])); }
const body = (req: Request) => record(req.body), id = (req: Request, name = 'id') => identifier(req.params[name], name);
function boolean(v: unknown, name: string) { requireThat(typeof v === 'boolean', 400, 'INVALID_REQUEST', `${name} must be a boolean`); return v; }
function principal(res: Response): Principal { return res.locals.principal as Principal; }
function number(v: unknown, fallback: number) { return v === undefined ? fallback : Number(v); }
export function createApp(config: Config, overrides: {
    store?: Store;
    driver?: Driver;
    assistant?: AssistantDriver;
    voice?: VoiceService;
    parserWasm?: () => Promise<Uint8Array>;
} = {}) {
    const app = express(), store = overrides.store ?? new FileStore(config.dataDir), driver: Driver = overrides.driver ?? (config.demo ? new DemoDriver() : new ClickHouseDriver(config));
    const runs = new RunService(store, driver, (p, c) => driver.connection(p, c)), artifacts = new ArtifactService(store, runs, (p, c) => driver.connection(p, c));
    const authorized = (p: Principal, c: string) => { driver.connection(p, c); return runs.isTrusted(p, c); };
    const ai = new AssistantService(store, overrides.assistant ?? new OpenAIDriver(config.demo ? undefined : config.openaiKey, config.openaiModel), authorized);
    const voice = overrides.voice ?? new OpenAIVoiceService(config.demo ? undefined : config.openaiKey, config.openaiRealtimeModel);
    const imports = new ImportService(store, driver, authorized), monitors = new MonitorService(store, runs, artifacts), sessions = new SessionService(config.token), redact = redactor(config), parserWasm = overrides.parserWasm ?? cachedClickHouseParserWasm;
    const secretFree = (value: unknown) => !configuredSecrets(config).some(secret => JSON.stringify(value).includes(secret));
    const safeExport = (value: unknown) => requireThat(secretFree(value), 400, 'SECRET_IN_EXPORT', 'This data contains a configured secret and cannot be exported or shared');
    app.disable('x-powered-by');
    app.set('trust proxy', false);
    app.use((req, res, next) => {
        res.locals.requestId = randomUUID();
        res.setHeader('X-Request-Id', res.locals.requestId);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://localhost:5173 ws://127.0.0.1:5173; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
        if (req.path.startsWith('/api')) {
            res.setHeader('Cache-Control', 'no-store');
            if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                if (req.get('x-clickstudio-intent') !== '1')
                    return res.status(403).json({ error: { code: 'REQUEST_INTENT', message: 'The workspace action header is required' } });
            }
        }
        next();
    });
    app.use(express.json({ limit: '3mb' }));
    app.use('/api', telemetry);
    app.get('/api/health', (_req, res) => res.status(runs.acceptingRuns ? 200 : 503).json({ ok: runs.acceptingRuns, demo: config.demo, version: '0.1.0' }));
    app.get('/api/session', (req, res) => res.json({ principal: sessions.principal(req.get('cookie')) ?? null, requiresLogin: sessions.requiresLogin, demo: config.demo, storageMode: 'single-owner local-first' }));
    app.post('/api/session', (req, res) => { const token = sessions.login(body(req).token, req.socket.remoteAddress ?? 'unknown'); res.cookie('clickstudio_session', token, { httpOnly: true, sameSite: 'strict', secure: config.origin.startsWith('https:'), path: '/', maxAge: 12 * 3600000 }); res.json({ ok: true }); });
    app.delete('/api/session', (req, res) => { sessions.logout(req.get('cookie')); res.clearCookie('clickstudio_session', { path: '/', sameSite: 'strict', secure: config.origin.startsWith('https:') }); res.json({ ok: true }); });
    app.get('/api/shared/:token', (req, res) => res.json(artifacts.resolveShare(text(req.params.token, 'share token', 100))));
    app.use('/api', (req, res, next) => { const p = sessions.principal(req.get('cookie')); if (!p)
        return res.status(401).json({ error: { code: 'LOGIN_REQUIRED', message: 'Sign in to this workspace' } }); res.locals.principal = p; next(); });
    app.get('/api/editor/clickhouse-parser.wasm', async (_req, res, next) => {
        try {
            const bytes = await parserWasm();
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Cache-Control', 'private, max-age=3600');
            res.send(Buffer.from(bytes));
        } catch (error) {
            next(error);
        }
    });
    app.get('/api/connections', (_req, res) => { const p = principal(res); res.json(driver.connections(p).map(c => ({ ...c, trusted: runs.isTrusted(p, c.id) }))); });
    app.post('/api/connections/:id/test', async (req, res) => { canWrite(principal(res)); res.json(await driver.test(id(req))); });
    app.post('/api/connections/:id/trust', (req, res) => { const p = principal(res), v = body(req), connectionId = id(req); requireThat(v.confirmation === connectionId, 400, 'TRUST_CONFIRMATION', 'Confirm the selected connection ID'); runs.trust(p, connectionId, boolean(v.trusted, 'trusted')); res.json({ trusted: runs.isTrusted(p, connectionId) }); });
    app.get('/api/connections/:id/schema', async (req, res) => { const p = principal(res), c = id(req); requireThat(authorized(p, c), 403, 'WORKSPACE_UNTRUSTED', 'Trust this connection before inspecting its schema'); res.json(await driver.schema(c)); });
    app.get('/api/connections/:id/documentation', async (req, res) => {
        const p = principal(res), connectionId = id(req);
        requireThat(authorized(p, connectionId), 403, 'WORKSPACE_UNTRUSTED', 'Trust this connection before inspecting its documentation');
        const name = text(req.query.name, 'name', 128);
        requireThat(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name), 400, 'INVALID_REQUEST', 'name must be a system table name');
        const capability = driver.connection(p, connectionId).manifest?.documentation;
        requireThat(capability?.available !== false, 409, 'CAPABILITY_UNAVAILABLE', capability?.reason ?? 'System documentation is unavailable for this connection');
        const documentation = await driver.systemTableDocumentation(connectionId, name);
        requireThat(documentation, 404, 'DOCUMENTATION_NOT_FOUND', `No ClickHouse documentation is available for system.${name}`);
        res.json(documentation);
    });
    app.get('/api/connections/:id/import-targets', (req, res) => { driver.connection(principal(res), id(req)); res.json(driver.targets(id(req))); });
    app.get('/api/runs', (req, res) => res.json(runs.list(principal(res), typeof req.query.connectionId === 'string' ? req.query.connectionId : undefined, typeof req.query.documentId === 'string' ? req.query.documentId : undefined)));
    app.post('/api/runs', (req, res) => { const run = runs.submit(principal(res), req.body); if (!run.traceId && res.locals.traceId) {
        run.traceId = String(res.locals.traceId);
        store.put('runs', run.id, run);
    } recordRun(run.id, run.queryId, run.connectionId); res.status(202).json(run); });
    app.get('/api/runs/:id', (req, res) => res.json(runs.get(principal(res), id(req))));
    app.get('/api/runs/:id/events', (req, res) => {
        const p = principal(res), runId = id(req);
        runs.get(p, runId);
        res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        let unsubscribe: () => void = () => { }, ended = false;
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        const finish = () => { if (ended)
            return; ended = true; if (heartbeat)
            clearInterval(heartbeat); unsubscribe(); res.end(); };
        req.once('close', finish);
        unsubscribe = runs.subscribe(p, runId, event => { if (ended)
            return; if (!sessions.principal(req.get('cookie'))) {
            finish();
            return;
        } const accepted = res.write(`id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`); if (!accepted || terminal(event.run))
            setImmediate(finish); });
        heartbeat = setInterval(() => { if (!sessions.principal(req.get('cookie')) || !res.write(': keepalive\n\n'))
            finish(); }, 15000);
    });
    app.get('/api/runs/:id/result', (req, res) => res.json(runs.page(principal(res), id(req), number(req.query.offset, 0), number(req.query.count, 200))));
    app.get('/api/runs/:id/snapshot', (req, res) => res.json(runs.result(principal(res), id(req))));
    app.get('/api/runs/:id/export', (req, res) => {
        const p = principal(res), run = runs.get(p, id(req)), result = runs.result(p, run.id);
        safeExport({ run, result });
        res.attachment(`${run.queryId}.${req.query.format === 'csv' ? 'csv' : 'json'}`);
        if (req.query.format === 'csv')
            res.type('text/csv').send(exportCsv(result));
        else
            res.json({ format: 'clickstudio-evidence', version: 1, run, result });
    });
    app.post('/api/runs/:id/cancel', async (req, res) => res.json(await runs.cancel(principal(res), id(req))));
    app.delete('/api/runs/:id', (req, res) => { runs.remove(principal(res), id(req)); res.json({ ok: true }); });
    app.get('/api/runs/:id/profile', async (req, res) => {
        const run = runs.get(principal(res), id(req));
        requireThat(authorized(principal(res), run.connectionId), 403, 'WORKSPACE_UNTRUSTED', 'Trust this connection before inspecting live query-log evidence');
        const evidence = await driver.profileEvidence(run);
        const connection = driver.connection(principal(res), run.connectionId);
        let traceUrl: string | undefined;
        if (config.traceUrl && run.traceId) {
            const url = new URL(config.traceUrl.replace('{traceId}', encodeURIComponent(run.traceId)));
            if (['http:', 'https:'].includes(url.protocol))
                traceUrl = url.toString();
        }
        res.json(buildQueryProfile(run, evidence, { queryLogAvailable: true, pipelineAvailable: Boolean(connection.manifest?.pipeline.available), traceUrl, notice: 'Query-log rows may arrive after a server flush interval. This is server evidence, not an operator-level performance model.' }));
    });
    app.get('/api/runs/:id/profile/pipeline', async (req, res) => {
        const p = principal(res), run = runs.get(p, id(req));
        requireThat(authorized(p, run.connectionId), 403, 'WORKSPACE_UNTRUSTED', 'Trust this connection before inspecting live pipeline evidence');
        const connection = driver.connection(p, run.connectionId);
        requireThat(Boolean(connection.manifest?.pipeline.available), 409, 'CAPABILITY_UNAVAILABLE', 'EXPLAIN PIPELINE is unavailable on this connection');
        const queryLogAvailable = Boolean(connection.manifest?.queryLog.available);
        const evidence = queryLogAvailable ? await driver.profileEvidence(run).catch(() => []) : [];
        const pipelineEvidence = await driver.profilePipeline(run);
        let traceUrl: string | undefined;
        if (config.traceUrl && run.traceId) {
            const url = new URL(config.traceUrl.replace('{traceId}', encodeURIComponent(run.traceId)));
            if (['http:', 'https:'].includes(url.protocol))
                traceUrl = url.toString();
        }
        const profile = buildQueryProfile(run, evidence, { queryLogAvailable, pipelineAvailable: true, pipelineEvidence, traceUrl, notice: queryLogAvailable
            ? 'Query-log rows may arrive after a server flush interval. This is server evidence, not an operator-level performance model.'
            : 'Query-log access is unavailable. The graph uses ClickHouse pipeline evidence and retained run metrics.' });
        res.json(profile.pipeline);
    });
    app.post('/api/scripts', (req, res) => { const v = body(req); res.status(202).json(runs.submitScript(principal(res), v, v.stopOnError === undefined ? true : boolean(v.stopOnError, 'stopOnError'))); });
    app.get('/api/scripts/:id', (req, res) => res.json(runs.getScript(principal(res), id(req))));
    app.post('/api/scripts/:id/cancel', async (req, res) => res.json(await runs.cancelScript(principal(res), id(req))));
    app.get('/api/documents', (req, res) => {
        const connectionId = typeof req.query.connectionId === 'string' ? text(req.query.connectionId, 'connectionId', 128) : undefined;
        if (connectionId)
            driver.connection(principal(res), connectionId);
        res.json(artifacts.list(principal(res), req.query.trash === 'true', connectionId));
    });
    app.post('/api/documents', (req, res) => res.status(201).json(artifacts.save(principal(res), req.body)));
    app.get('/api/documents/:id', (req, res) => res.json(artifacts.get(principal(res), id(req), req.query.revision === undefined ? undefined : integer(Number(req.query.revision), 'revision', 1, 1e6))));
    app.put('/api/documents/:id', (req, res) => res.json(artifacts.save(principal(res), req.body, id(req))));
    app.get('/api/documents/:id/revisions', (req, res) => res.json(artifacts.revisions(principal(res), id(req))));
    app.post('/api/documents/:id/restore-revision', (req, res) => { const v = body(req); res.json(artifacts.restoreRevision(principal(res), id(req), integer(v.revision, 'revision', 1, 1e6), integer(v.baseRevision, 'baseRevision', 1, 1e6))); });
    app.delete('/api/documents/:id', (req, res) => res.json(artifacts.trash(principal(res), id(req), body(req).confirmImpact === true)));
    app.post('/api/documents/:id/restore', (req, res) => res.json(artifacts.restore(principal(res), id(req))));
    app.get('/api/documents/:id/impact', (req, res) => { artifacts.get(principal(res), id(req)); res.json(artifacts.descendants(principal(res), id(req))); });
    app.post('/api/documents/:id/review', (req, res) => res.json(artifacts.review(principal(res), id(req), integer(body(req).revision, 'revision', 1, 1e6))));
    app.post('/api/documents/:id/publish', (req, res) => { const v = body(req), pub = artifacts.publish(principal(res), id(req), integer(v.revision, 'revision', 1, 1e6), v.acknowledgeTruncated === true); res.json(pub); });
    app.get('/api/documents/:id/comments', (req, res) => res.json(artifacts.comments(principal(res), id(req))));
    app.post('/api/documents/:id/comments', (req, res) => res.status(201).json(artifacts.comment(principal(res), id(req), req.body)));
    app.get('/api/workspace/export', (_req, res) => { const bundle = artifacts.export(principal(res)); safeExport(bundle); res.attachment('query-studio-workspace.json').json(bundle); });
    app.post('/api/workspace/import', (req, res) => res.status(201).json(artifacts.import(principal(res), req.body)));
    app.get('/api/published', (_req, res) => res.json(artifacts.publications(principal(res))));
    app.get('/api/published/:id', (req, res) => res.json(artifacts.published(principal(res), id(req))));
    app.post('/api/published/:id/share', (req, res) => { requireThat(body(req).acknowledgeShare === true, 400, 'SHARE_CONSENT', 'A share link exposes SQL, bound parameters, execution metadata, chart configuration and the bounded result to anyone holding it'); const pub = artifacts.published(principal(res), id(req)); safeExport(pub); const share = artifacts.share(principal(res), pub.id); res.json({ ...share, path: `/share/${share.token}` }); });
    app.delete('/api/published/:id/share', (req, res) => { artifacts.revokeShares(principal(res), id(req)); res.json({ ok: true }); });
    app.delete('/api/published/:id', (req, res) => { artifacts.deletePublication(principal(res), id(req)); res.json({ ok: true }); });
    app.get('/api/assistant/status', (_req, res) => res.json(ai.status(principal(res))));
    app.get('/api/assistant/evaluation', (_req, res) => res.json(ai.evaluation(principal(res))));
    app.get('/api/voice/status', (_req, res) => res.json({ available: voice.available, model: voice.model, reason: voice.available ? undefined : 'Set OPENAI_API_KEY on the server to use voice workflows' }));
    app.post('/api/voice/session', async (req, res) => {
        const p = principal(res), v = body(req), connectionId = identifier(v.connectionId, 'connectionId');
        canWrite(p);
        requireThat(authorized(p, connectionId), 403, 'WORKSPACE_UNTRUSTED', 'Trust this connection before starting a voice workflow');
        requireThat(voice.available, 503, 'AI_VOICE_UNAVAILABLE', 'Set OPENAI_API_KEY on the server to use voice workflows');
        const sdp = text(v.sdp, 'SDP offer', 300000), context = v.context === undefined ? undefined : text(v.context, 'voice context', 100000, true);
        if (!secretFree({ context }))
            throw new AppError(400, 'SECRET_IN_VOICE_CONTEXT', 'This voice context contains a configured secret; remove it before starting voice');
        res.status(201).json(await voice.createSession({ sdp, context, safetyIdentifier: safetyIdentifier(p.id) }));
    });
    app.post('/api/assistant/context', async (req, res) => {
        const p = principal(res), v = body(req), connectionId = identifier(v.connectionId, 'connectionId');
        canWrite(p);
        requireThat(authorized(p, connectionId), 403, 'WORKSPACE_UNTRUSTED', 'Trust this connection before sharing context');
        const action = text(v.action, 'action', 30) as AssistantAction, sql = text(v.sql, 'SQL', 200000, true), question = text(v.question, 'question', 4000, true), schema: Schema = await driver.schema(connectionId);
        let run: Run | undefined;
        if (v.runId) {
            run = runs.get(p, identifier(v.runId, 'runId'));
            requireThat(run.connectionId === connectionId, 409, 'CONNECTION_MISMATCH', 'Selected evidence belongs to another connection');
        }
        const result = v.includeResult === true && run ? runs.result(p, run.id) : undefined;
        const context = ai.prepare(p, { connectionId, action, question, sql, schema, result, evidenceSql: run?.sql, error: run?.error?.message,
            serverVersion: driver.connection(p, connectionId).manifest?.serverVersion, rules: v.rules === undefined ? undefined : text(v.rules, 'workspace rules', 4000, true),
            sensitiveColumns: config.sensitiveColumns, image: v.image === undefined ? undefined : text(v.image, 'image', 2900000) });
        if (!secretFree(context.payload)) {
            store.delete('ai-contexts', context.id);
            throw new AppError(400, 'SECRET_IN_CONTEXT', 'This context contains a configured secret; remove it before sharing');
        }
        res.status(201).json({ ...context, evidenceSql: run?.sql ?? null });
    });
    app.post('/api/assistant/proposals', async (req, res) => { const v = body(req); res.json(await ai.propose(principal(res), identifier(v.contextId, 'contextId'), v.consent === true)); });
    app.get('/api/assistant/proposals/:id', (req, res) => res.json(ai.get(principal(res), id(req))));
    app.post('/api/assistant/proposals/:id/decision', (req, res) => { const v = body(req); requireThat(v.decision === 'accepted' || v.decision === 'rejected', 400, 'DECISION', 'Unknown proposal decision'); res.json(ai.decide(principal(res), id(req), v.decision, identifier(v.connectionId, 'connectionId'), text(v.currentSql, 'current SQL', 200000, true))); });
    app.delete('/api/assistant/proposals/:id', (req, res) => { ai.remove(principal(res), id(req)); res.json({ ok: true }); });
    app.get('/api/imports', (req, res) => {
        const p = principal(res), connectionId = typeof req.query.connectionId === 'string' ? text(req.query.connectionId, 'connectionId', 128) : undefined;
        requireThat(req.query.recoverable === undefined || req.query.recoverable === 'true', 400, 'IMPORT_FILTER', 'Use recoverable=true to list imports that need attention');
        if (connectionId)
            driver.connection(p, connectionId);
        res.json(imports.listRecoverable(p, connectionId));
    });
    app.post('/api/imports/preview', (req, res) => { const v = body(req); requireThat(['csv', 'json', 'ndjson'].includes(String(v.format)), 400, 'IMPORT_FORMAT', 'Use CSV, JSON, or NDJSON'); const input = imports.preview(principal(res), text(v.name, 'filename', 128), text(v.source, 'input', 2000000), v.format as 'csv' | 'json' | 'ndjson'); res.status(201).json({ ...input, rows: input.rows.slice(0, 20), rowCount: input.rows.length }); });
    app.post('/api/imports/:id/mapping', async (req, res) => { const v = body(req), mapping = await imports.map(principal(res), id(req), identifier(v.connectionId, 'connectionId'), text(v.table, 'table', 256), mappingFields(v.fields)); res.json({ ...mapping, rows: mapping.rows.slice(0, 20), rowCount: mapping.rows.length }); });
    app.post('/api/imports/:id/commit', async (req, res) => res.json(await imports.commit(principal(res), id(req), text(body(req).confirmation, 'confirmation', 100))));
    app.get('/api/imports/:id', (req, res) => res.json(imports.getJob(principal(res), id(req))));
    app.post('/api/imports/:id/reconcile', async (req, res) => res.json(await imports.reconcile(principal(res), id(req))));
    app.post('/api/imports/:id/review', async (req, res) => { const v = body(req); res.json(await imports.review(principal(res), id(req), boolean(v.inspected, 'inspected'), boolean(v.noActiveInsert, 'noActiveInsert'))); });
    app.delete('/api/imports/:id', (req, res) => { imports.remove(principal(res), id(req)); res.json({ ok: true }); });
    app.get('/api/monitors', (_req, res) => res.json(monitors.list(principal(res))));
    app.post('/api/monitors', (req, res) => { const v = body(req); requireThat(['changed', 'nonempty', 'failure'].includes(String(v.condition)), 400, 'MONITOR_CONDITION', 'Invalid condition'); res.status(201).json(monitors.create(principal(res), identifier(v.publishedId, 'publishedId'), integer(v.intervalSeconds, 'intervalSeconds', 60, 31536000), v.condition as 'changed' | 'nonempty' | 'failure')); });
    app.post('/api/monitors/:id/pause', (req, res) => res.json(monitors.pause(principal(res), id(req), boolean(body(req).paused, 'paused'))));
    app.get('/api/notices', (_req, res) => res.json(monitors.notices(principal(res))));
    app.get('/api/audit', (_req, res) => res.json(store.list<AuditEvent>('audit').filter(e => e.owner === principal(res).id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200)));
    app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found' } }));
    const frontend = resolve('dist/web');
    if (existsSync(frontend)) {
        app.use(express.static(frontend, { index: false }));
        app.get('/{*splat}', (_req, res) => res.sendFile(resolve(frontend, 'index.html')));
    }
    const errors: ErrorRequestHandler = (error, _req, res, _next) => { if (res.headersSent) {
        res.end();
        return;
    } const parsed = asError(error);
    const tooLarge = error !== null && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large';
    res.status(tooLarge ? 413 : error instanceof AppError ? error.status : error instanceof SyntaxError ? 400 : 500).json({ error: { ...parsed, message: redact(parsed.message) }, requestId: res.locals.requestId }); };
    app.use(errors);
    return { app, store, runs, artifacts, ai, voice, imports, monitors, driver, close: async () => { await runs.close(); await driver.close(); } };
}
