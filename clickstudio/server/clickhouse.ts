import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { randomUUID } from 'node:crypto';
import type { ClickHouseSystemTableDocumentation, Connection, Json, Manifest, Principal, Progress, Run, Schema } from '../shared/types.js';
import { enrichSchemaTables, type SchemaTableMetadata, type SchemaTableSkipIndex } from '../shared/schema.js';
import { AppError, requireThat } from '../core/errors.js';
import { collectCompactStream } from '../core/compact-stream.js';
import type { QueryDriver } from '../core/runs.js';
import type { ImportDriver } from '../core/imports.js';
import { splitSql } from '../shared/sql.js';
import { sourcePositionFromUtf8ByteOffset } from '../shared/native-parser.js';
import { quotedTable } from '../core/imports.js';
import { publicProfile, redactor, type Config, type Profile } from './config.js';
/** All database addresses and credentials are operator-owned; the API accepts only profile IDs. */
export class ClickHouseDriver implements QueryDriver, ImportDriver {
    private readers = new Map<string, ClickHouseClient>();
    private writers = new Map<string, ClickHouseClient>();
    private manifests = new Map<string, Manifest>();
    private readonly redact: (s: string) => string;
    constructor(private readonly config: Config) { this.redact = redactor(config); }
    private profile(id: string): Profile { const p = this.config.profiles.find(p => p.id === id); requireThat(p, 404, 'CONNECTION_NOT_FOUND', 'Connection not found'); return p; }
    connection(_p: Principal, id: string): Connection { return { ...publicProfile(this.profile(id)), manifest: this.manifests.get(id) }; }
    connections(p: Principal) { return this.config.profiles.map(c => this.connection(p, c.id)); }
    private client(id: string, write = false): ClickHouseClient {
        const pool = write ? this.writers : this.readers;
        let client = pool.get(id);
        if (client)
            return client;
        const p = this.profile(id);
        if (write)
            requireThat(p.writer, 403, 'IMPORT_NOT_ALLOWED', 'No import identity is configured');
        client = createClient({ url: p.url, database: p.database, username: write ? p.writer!.username : p.username, password: write ? p.writer!.password : p.password,
            request_timeout: 135000, max_open_connections: 6, application: 'clickstudio' });
        pool.set(id, client);
        return client;
    }
    private safeError(error: unknown): AppError {
        const message = this.redact(error instanceof Error ? error.message : 'ClickHouse request failed');
        const position = /at position (\d+)/i.exec(message)?.[1];
        const denied = /not enough privileges|access denied|authentication failed/i.test(message);
        const cap = /TOO_MANY_ROWS_OR_BYTES|LIMIT_EXCEEDED|MEMORY_LIMIT_EXCEEDED/i.test(message);
        return new AppError(denied ? 403 : cap ? 413 : 502, denied ? 'CLICKHOUSE_PERMISSION' : cap ? 'SERVER_RESOURCE_LIMIT' : 'CLICKHOUSE_ERROR', message, undefined, position ? Math.max(0, Number(position) - 1) : undefined);
    }
    private async rows<T>(id: string, sql: string, parameters: Record<string, string> = {}): Promise<T[]> {
        try {
            const set = await this.client(id).query({ query: sql, format: 'JSONEachRow', query_params: parameters, query_id: `clickstudio-inspect-${randomUUID()}`,
                abort_signal: AbortSignal.timeout(10000), clickhouse_settings: { readonly: '1', max_execution_time: 8, max_result_rows: '6000', max_result_bytes: '3000000', result_overflow_mode: 'throw', max_threads: 2 } });
            return await set.json<T>();
        }
        catch (error) {
            throw this.safeError(error);
        }
    }
    async test(id: string): Promise<Connection> {
        const version = (await this.rows<{
            version: string;
        }>(id, 'SELECT version() AS version'))[0]?.version ?? 'unknown';
        const probe = async (sql: string) => { try {
            await this.rows(id, sql);
            return { available: true };
        }
        catch (error) {
            return { available: false, reason: error instanceof Error ? error.message : 'Not permitted' };
        } };
        const [schema, progress, queryLog, documentation, explain, pipeline] = await Promise.all([
            probe('SELECT name FROM system.columns LIMIT 1'), probe('SELECT query_id FROM system.processes LIMIT 0'), probe('SELECT query_id FROM system.query_log LIMIT 0'),
            probe("SELECT name, description FROM system.documentation WHERE type = 'System Table' LIMIT 0"), probe('EXPLAIN SELECT 1'), probe('EXPLAIN PIPELINE graph = 1, compact = 0 SELECT 1'),
        ]);
        // KILL of a random, nonexistent own query checks cancellation permission without touching a real query.
        let cancellation: Manifest['cancellation'];
        try {
            await this.client(id).command({ query: 'KILL QUERY WHERE query_id = {queryId:String} AND user = {user:String} SYNC',
                query_params: { queryId: `clickstudio-probe-${randomUUID()}`, user: this.profile(id).username }, abort_signal: AbortSignal.timeout(5000) });
            cancellation = { available: true };
        }
        catch {
            cancellation = { available: false, reason: 'Own-query cancellation is not permitted; transport abort and server deadline still apply.' };
        }
        const manifest: Manifest = { version: 1, serverVersion: version, testedAt: new Date().toISOString(), schema, progress, queryLog, documentation, explain, pipeline, cancellation,
            import: { available: Boolean(this.profile(id).writer), reason: this.profile(id).writer ? 'Explicit allowlisted import identity configured' : 'Configure a separate writer and target allowlist to enable imports' }, scripts: { available: true }, parameters: { available: true } };
        this.manifests.set(id, manifest);
        return this.connection({ id: 'local-owner', role: 'owner' }, id);
    }
    async schema(id: string): Promise<Schema> {
        const database = this.profile(id).database;
        const optionalRows = async <T>(label: string, sql: string, parameters: Record<string, string> = { database }): Promise<{ rows?: T[]; warning?: string }> => {
            try {
                return { rows: await this.rows<T>(id, sql, parameters) };
            }
            catch {
                return { warning: `${label} metadata is unavailable to this reader or ClickHouse version.` };
            }
        };
        const [columns, tables, systemColumns, systemTables, documentationNames, tableDetails, projections, skipIndexes, dictionaries] = await Promise.all([
            this.rows<{
                database: string;
                table: string;
                name: string;
                type: string;
                default_kind: string;
                comment: string;
            }>(id, 'SELECT database, table, name, type, default_kind, comment FROM system.columns WHERE database = {database:String} ORDER BY table, position LIMIT 5001', { database }),
            this.rows<{
                database: string;
                name: string;
                engine: string;
            }>(id, 'SELECT database, name, engine FROM system.tables WHERE database = {database:String} ORDER BY name LIMIT 1001', { database }),
            database === 'system' ? Promise.resolve({ rows: [] as Array<{ database: string; table: string; name: string; type: string; default_kind: string; comment: string }>, warning: undefined as string | undefined }) : optionalRows<{
                database: string;
                table: string;
                name: string;
                type: string;
                default_kind: string;
                comment: string;
            }>('System table columns', 'SELECT database, table, name, type, default_kind, comment FROM system.columns WHERE database = {database:String} ORDER BY table, position LIMIT 5001', { database: 'system' }),
            database === 'system' ? Promise.resolve({ rows: [] as Array<{ database: string; name: string; engine: string }>, warning: undefined as string | undefined }) : optionalRows<{
                database: string;
                name: string;
                engine: string;
            }>('System tables', 'SELECT database, name, engine FROM system.tables WHERE database = {database:String} ORDER BY name LIMIT 1001', { database: 'system' }),
            this.manifests.get(id)?.documentation.available === false ? Promise.resolve({ rows: [] as Array<{ name: string }>, warning: undefined as string | undefined }) : optionalRows<{ name: string }>(
                'System table documentation', "SELECT name FROM system.documentation WHERE type = 'System Table' AND notEmpty(description) ORDER BY name LIMIT 1001", {}),
            optionalRows<{
                database: string;
                name: string;
                order_by: string;
                primary_key: string;
                partition_key: string;
                sampling_key: string;
                row_estimate: string;
                size_bytes: string;
                uncompressed_bytes: string;
                parts: string;
                active_parts: string;
                ttl_configured: number;
                materialized_view_target: string;
                skip_index_types: string[];
            }>('Table keys, storage, and view', `SELECT database, name, sorting_key AS order_by, primary_key, partition_key, sampling_key,
                ifNull(toString(total_rows), '') AS row_estimate, ifNull(toString(total_bytes), '') AS size_bytes,
                ifNull(toString(total_bytes_uncompressed), '') AS uncompressed_bytes, ifNull(toString(parts), '') AS parts, ifNull(toString(active_parts), '') AS active_parts,
                match(create_table_query, '(?i)(^|[^A-Za-z0-9_])TTL([^A-Za-z0-9_]|$)') > 0 AS ttl_configured,
                if(target_database = '', '', concat(target_database, '.', target_table)) AS materialized_view_target,
                skipping_indices_types AS skip_index_types
                FROM system.tables WHERE database = {database:String} ORDER BY name LIMIT 1001`),
            optionalRows<{
                database: string;
                table: string;
                name: string;
                type: string;
                sortingKey: string;
            }>('Projection', `SELECT database, table, name, type, arrayStringConcat(sorting_key, ', ') AS sortingKey
                FROM system.projections WHERE database = {database:String} ORDER BY table, name LIMIT 5001`),
            optionalRows<SchemaTableSkipIndex>('Skip-index', `SELECT database, table, name, type, expr AS expression, toString(granularity) AS granularity
                FROM system.data_skipping_indices WHERE database = {database:String} ORDER BY table, name LIMIT 5001`),
            optionalRows<{
                database: string;
                name: string;
                status: string;
                type: string;
                key_columns: string;
                attribute_columns: string;
                element_count: string;
                memory_bytes: string;
                last_successful_update: string;
            }>('Dictionary', `SELECT database, name, status, type, arrayStringConcat(key.names, ', ') AS key_columns,
                arrayStringConcat(attribute.names, ', ') AS attribute_columns, toString(element_count) AS element_count,
                toString(bytes_allocated) AS memory_bytes, toString(last_successful_update_time) AS last_successful_update
                FROM system.dictionaries WHERE database = {database:String} OR database = '' ORDER BY database, name LIMIT 1001`),
        ]);
        const allColumns = [...columns, ...(systemColumns.rows ?? [])], allTables = [...tables, ...(systemTables.rows ?? [])];
        const tableTruncated = allColumns.length > 10000 || allTables.length > 2000 || columns.length > 5000 || tables.length > 1000 || (systemColumns.rows?.length ?? 0) > 5000 || (systemTables.rows?.length ?? 0) > 1000;
        const metadataWarnings = [systemColumns.warning, systemTables.warning, documentationNames.warning, tableDetails.warning, projections.warning, skipIndexes.warning, dictionaries.warning].filter((warning): warning is string => Boolean(warning));
        if ((tableDetails.rows?.length ?? 0) > 1000)
            metadataWarnings.push('Table metadata preview truncated.');
        if ((projections.rows?.length ?? 0) > 5000)
            metadataWarnings.push('Projection metadata preview truncated.');
        if ((skipIndexes.rows?.length ?? 0) > 5000)
            metadataWarnings.push('Skip-index metadata preview truncated.');
        if ((dictionaries.rows?.length ?? 0) > 1000)
            metadataWarnings.push('Dictionary metadata preview truncated.');
        if ((documentationNames.rows?.length ?? 0) > 1000)
            metadataWarnings.push('System table documentation names truncated.');
        const tableMetadata: SchemaTableMetadata[] | undefined = tableDetails.rows?.slice(0, 1000).map(row => ({
            database: row.database,
            name: row.name,
            orderBy: row.order_by,
            primaryKey: row.primary_key,
            partitionKey: row.partition_key,
            samplingKey: row.sampling_key,
            rowEstimate: row.row_estimate || null,
            sizeBytes: row.size_bytes || null,
            uncompressedBytes: row.uncompressed_bytes || null,
            parts: row.parts || null,
            activeParts: row.active_parts || null,
            ttlConfigured: row.ttl_configured > 0,
            materializedViewTarget: row.materialized_view_target || undefined,
            skipIndexTypes: row.skip_index_types,
        }));
        const projectionMetadata = projections.rows?.slice(0, 5000).map(row => ({
            database: row.database,
            table: row.table,
            name: row.name,
            type: row.type,
            sortingKey: row.sortingKey,
        }));
        const indexMetadata = skipIndexes.rows?.slice(0, 5000);
        const tableRows = allTables.slice(0, 2000);
        const enrichedTables = enrichSchemaTables(tableRows, {
            tables: tableMetadata,
            projections: projectionMetadata,
            skipIndexes: indexMetadata,
        });
        const dictionaryRows = dictionaries.rows?.slice(0, 1000).map(row => ({
            database: row.database,
            name: row.name,
            status: row.status,
            type: row.type,
            keyColumns: row.key_columns,
            attributeColumns: row.attribute_columns,
            elementCount: row.element_count,
            memoryBytes: row.memory_bytes,
            lastSuccessfulUpdate: row.last_successful_update,
        }));
        const truncated = tableTruncated;
        return { connectionId: id, fetchedAt: new Date().toISOString(), tables: enrichedTables, columns: allColumns.slice(0, 10000).map(c => ({ database: c.database, table: c.table, name: c.name, type: c.type, defaultKind: c.default_kind, comment: c.comment })),
            dictionaries: dictionaryRows, systemTableDocumentationNames: documentationNames.rows?.slice(0, 1000).map(row => row.name), metadataWarnings: metadataWarnings.length ? metadataWarnings : undefined, truncated,
            warnings: [database === 'system' ? 'Schema is scoped to the ClickHouse system database.' : `Schema includes ${database} and ClickHouse system tables. Configure another profile for another database.`, ...(truncated ? ['Schema preview truncated.'] : [])] };
    }
    async systemTableDocumentation(id: string, name: string): Promise<ClickHouseSystemTableDocumentation | undefined> {
        const row = (await this.rows<{ name: string; description: string }>(id,
            "SELECT name, description FROM system.documentation WHERE type = 'System Table' AND name = {name:String} LIMIT 1", { name }))[0];
        if (!row)
            return undefined;
        const serverVersion = this.manifests.get(id)?.serverVersion ?? (await this.rows<{ version: string }>(id, 'SELECT version() AS version').catch(() => []))[0]?.version ?? 'unknown';
        return { ...row, serverVersion };
    }
    async execute(run: Run, signal: AbortSignal, progress: (p: Progress) => void) {
        let timer: ReturnType<typeof setInterval> | undefined, polling = false;
        const statement = splitSql(run.sql)[0]!.sql;
        const sql = run.kind === 'explain' ? `EXPLAIN indexes = 1\n${statement}` : run.kind === 'pipeline' ? `EXPLAIN PIPELINE\n${statement}` : statement;
        if (this.manifests.get(run.connectionId)?.progress.available)
            timer = setInterval(() => {
                if (polling || signal.aborted)
                    return;
                polling = true;
                void this.rows<{
                    read_rows: string;
                    read_bytes: string;
                    elapsed: number;
                    memory_usage: string;
                }>(run.connectionId, 'SELECT toString(read_rows) AS read_rows, toString(read_bytes) AS read_bytes, elapsed, toString(memory_usage) AS memory_usage FROM system.processes WHERE query_id = {id:String}', { id: run.queryId })
                    .then(r => { const p = r[0]; if (p && !signal.aborted)
                    progress({ readRows: p.read_rows, readBytes: p.read_bytes, elapsedMs: p.elapsed * 1000, memory: p.memory_usage }); }).catch(() => undefined).finally(() => { polling = false; });
            }, 750);
        try {
            const response = await this.client(run.connectionId).exec({ query: `${sql}\nFORMAT JSONCompactEachRowWithNamesAndTypes`, query_id: run.queryId, query_params: run.parameters, abort_signal: signal,
                clickhouse_settings: { readonly: '1', max_execution_time: run.limits.seconds, max_memory_usage: String(run.limits.memory), max_threads: run.limits.threads,
                    max_result_rows: '100000', max_result_bytes: '50000000', result_overflow_mode: 'throw', max_rows_to_read: '100000000', max_bytes_to_read: '5000000000',
                    output_format_json_quote_64bit_integers: 1, output_format_json_quote_decimals: 1, log_comment: JSON.stringify(run.tags) } });
            const result = await collectCompactStream(response.stream, run.limits);
            if (result.truncated)
                void this.cancel(run).catch(() => undefined);
            return { ...result, serverVersion: this.manifests.get(run.connectionId)?.serverVersion, warnings: result.truncated ? ['Output stopped at the application row/byte cap. This is a retained prefix, not the full answer.'] : [] };
        }
        catch (error) {
            if (signal.aborted)
                throw signal.reason;
            const failure = this.safeError(error);
            if (failure.position !== undefined && run.sourceFrom !== undefined && run.sourceTo !== undefined) {
                const prefix = run.kind === 'explain' ? 'EXPLAIN indexes = 1\n'.length : run.kind === 'pipeline' ? 'EXPLAIN PIPELINE\n'.length : 0;
                const position = sourcePositionFromUtf8ByteOffset(statement, failure.position, run.sourceFrom, run.sourceTo, prefix);
                throw new AppError(failure.status, failure.code, failure.message, failure.remediation, position);
            }
            throw failure;
        }
        finally {
            if (timer)
                clearInterval(timer);
        }
    }
    async cancel(run: Run) {
        try {
            await this.client(run.connectionId).command({ query: 'KILL QUERY WHERE query_id = {id:String} AND user = {user:String} SYNC',
                query_params: { id: run.queryId, user: this.profile(run.connectionId).username }, abort_signal: AbortSignal.timeout(5000) });
        }
        catch (error) {
            throw this.safeError(error);
        }
    }
    async profileEvidence(run: Run) {
        requireThat(this.manifests.get(run.connectionId)?.queryLog.available, 409, 'CAPABILITY_UNAVAILABLE', 'Test the connection; query-log visibility is required');
        return this.rows(run.connectionId, "SELECT query_id, type, query_duration_ms, read_rows, read_bytes, result_rows, result_bytes, memory_usage, exception_code FROM system.query_log WHERE query_id = {id:String} AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart') ORDER BY event_time DESC LIMIT 10", { id: run.queryId });
    }
    async profilePipeline(run: Run): Promise<string[]> {
        requireThat(this.manifests.get(run.connectionId)?.pipeline.available, 409, 'CAPABILITY_UNAVAILABLE', 'Test the connection; pipeline inspection is required');
        const statement = splitSql(run.sql)[0]?.sql;
        requireThat(statement, 400, 'EMPTY_SQL', 'The run has no SQL statement to inspect');
        const rows = await this.rows<Record<string, unknown>>(run.connectionId, `EXPLAIN PIPELINE graph = 1, compact = 0\n${statement}`, run.parameters);
        return rows.map(row => String(Object.values(row)[0] ?? '')).filter(Boolean);
    }
    targets(id: string) { return this.profile(id).writer?.tables ?? []; }
    allowed(id: string, table: string) { return this.targets(id).includes(table); }
    async insert(id: string, table: string, rows: Record<string, Json>[], queryId: string) {
        requireThat(this.allowed(id, table), 403, 'IMPORT_NOT_ALLOWED', 'Import target is not allowlisted');
        try {
            await this.client(id, true).insert({ table: quotedTable(table), values: rows, format: 'JSONEachRow', query_id: queryId, abort_signal: AbortSignal.timeout(60000), clickhouse_settings: { max_execution_time: 55, max_memory_usage: '536870912' } });
        }
        catch (error) {
            throw this.safeError(error);
        }
    }
    async inspectInsert(id: string, queryId: string): Promise<'running' | 'succeeded' | 'unknown'> {
        const [active, events] = await Promise.all([
            this.rows<{ query_id: string }>(id, 'SELECT query_id FROM system.processes WHERE query_id = {id:String} LIMIT 1', { id: queryId }).catch(() => []),
            this.rows<{ type: string; exception_code: string }>(id,
                "SELECT type, toString(exception_code) AS exception_code FROM system.query_log WHERE query_id = {id:String} AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart') ORDER BY event_time DESC LIMIT 1",
                { id: queryId }).catch(() => []),
        ]);
        if (active.length)
            return 'running';
        const latest = events[0];
        if (latest?.type === 'QueryFinish' && latest.exception_code === '0')
            return 'succeeded';
        return 'unknown';
    }
    async close() { await Promise.all([...this.readers.values(), ...this.writers.values()].map(c => c.close())); }
}
