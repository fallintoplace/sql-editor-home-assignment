import { mkdirSync, writeFileSync, readFileSync, renameSync, unlinkSync, readdirSync, openSync, closeSync, fsyncSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import type { AuditEvent, Principal } from '../shared/types.js';
import { requireThat } from './errors.js';
export interface Store {
    get<T>(bucket: string, id: string): T | undefined;
    put<T>(bucket: string, id: string, value: T): void;
    delete(bucket: string, id: string): void;
    list<T>(bucket: string): T[];
}
export class MemoryStore implements Store {
    private data = new Map<string, Map<string, unknown>>();
    get<T>(bucket: string, id: string): T | undefined { return structuredClone(this.data.get(bucket)?.get(id)) as T | undefined; }
    put<T>(bucket: string, id: string, value: T) {
        if (!this.data.has(bucket))
            this.data.set(bucket, new Map());
        this.data.get(bucket)!.set(id, structuredClone(value));
    }
    delete(bucket: string, id: string) { this.data.get(bucket)?.delete(id); }
    list<T>(bucket: string): T[] { return structuredClone([...(this.data.get(bucket)?.values() ?? [])]) as T[]; }
}
/** Atomic single-process persistence. Do not share this directory between replicas. */
export class FileStore implements Store {
    constructor(private readonly directory: string) { mkdirSync(directory, { recursive: true, mode: 0o700 }); }
    private syncDirectory(directory: string) {
        const dirfd = openSync(directory, 'r');
        try {
            fsyncSync(dirfd);
        }
        finally {
            closeSync(dirfd);
        }
    }
    private path(bucket: string, id?: string) {
        for (const part of [bucket, ...(id === undefined ? [] : [id])]) {
            requireThat(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(part), 400, 'INVALID_STORAGE_KEY', 'Invalid storage key');
        }
        return id === undefined ? join(this.directory, bucket) : join(this.directory, bucket, `${id}.json`);
    }
    get<T>(bucket: string, id: string): T | undefined {
        try {
            return JSON.parse(readFileSync(this.path(bucket, id), 'utf8')) as T;
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                return undefined;
            throw error;
        }
    }
    put<T>(bucket: string, id: string, value: T) {
        const directory = this.path(bucket), target = this.path(bucket, id);
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        const temp = join(directory, `.${randomUUID()}.tmp`);
        const fd = openSync(temp, 'wx', 0o600);
        try {
            try {
                writeFileSync(fd, JSON.stringify(value));
                fsyncSync(fd);
            }
            finally {
                closeSync(fd);
            }
            renameSync(temp, target);
        }
        catch (error) {
            if (existsSync(temp))
                unlinkSync(temp);
            throw error;
        }
        // Persist the directory entry, not only the temporary file contents.
        this.syncDirectory(directory);
    }
    delete(bucket: string, id: string) {
        const directory = this.path(bucket);
        let removed = false;
        try {
            unlinkSync(this.path(bucket, id));
            removed = true;
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                throw error;
        }
        if (removed)
            this.syncDirectory(directory);
    }
    list<T>(bucket: string): T[] {
        let names: string[];
        try {
            names = readdirSync(this.path(bucket));
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                return [];
            throw error;
        }
        return names.filter(n => /^[A-Za-z0-9][A-Za-z0-9_-]*\.json$/.test(n))
            .map(n => this.get<T>(bucket, n.slice(0, -5))!).filter(Boolean);
    }
}
export function stableStringify(value: unknown): string {
    if (Array.isArray(value))
        return '[' + value.map(stableStringify).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.entries(value).filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + stableStringify(v)).join(',') + '}';
    return JSON.stringify(value) ?? 'null';
}
export function hash(value: unknown): string { return createHash('sha256').update(stableStringify(value)).digest('hex'); }
export function audit(store: Store, principal: Principal, action: string, resourceId: string, outcome: AuditEvent['outcome'] = 'allowed', ruleId?: string) {
    const event: AuditEvent = { id: randomUUID(), at: new Date().toISOString(), owner: principal.id, action, resourceId, outcome, ruleId };
    store.put('audit', event.id, event);
    // Bound telemetry independently of SQL/result retention. Audit stores no raw SQL or credentials.
    const all = store.list<AuditEvent>('audit');
    if (all.length > 5000)
        for (const old of all.sort((a, b) => a.at.localeCompare(b.at)).slice(0, all.length - 5000))
            store.delete('audit', old.id);
}
