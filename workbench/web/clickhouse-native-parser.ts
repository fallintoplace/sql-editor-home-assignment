import type { NativeFormatResult, NativeParseResult, NativeParserStatus } from '../shared/native-parser';

type RequestKind = 'parseMany' | 'formatMany';
type WorkerRequest = { id: number; kind: RequestKind; sql: string[] };
type WorkerReply =
    | { id: number; ok: true; results: Array<NativeParseResult | NativeFormatResult> }
    | { id: number; ok: false; message: string };
type WorkerStatus = { kind: 'status'; status: Exclude<NativeParserStatus, 'loading'>; reason?: string };
type Pending = { resolve: (value: Array<NativeParseResult | NativeFormatResult>) => void; reject: (error: Error) => void };

class ClickHouseNativeParser {
    private worker?: Worker;
    private nextId = 1;
    private pending = new Map<number, Pending>();
    private listeners = new Set<(status: NativeParserStatus) => void>();
    private state: NativeParserStatus = 'loading';
    private reason = '';

    get status(): NativeParserStatus {
        return this.state;
    }

    subscribe(listener: (status: NativeParserStatus) => void): () => void {
        this.listeners.add(listener);
        listener(this.state);
        this.ensureWorker();
        return () => {
            this.listeners.delete(listener);
        };
    }

    parseMany(sql: string[]): Promise<NativeParseResult[]> {
        return this.request<NativeParseResult>('parseMany', sql);
    }

    formatMany(sql: string[]): Promise<NativeFormatResult[]> {
        return this.request<NativeFormatResult>('formatMany', sql);
    }

    private ensureWorker(): Worker {
        if (this.worker)
            return this.worker;
        const worker = new Worker(new URL('./clickhouse-native-parser.worker.ts', import.meta.url), {
            type: 'module',
            name: 'clickhouse-native-parser',
        });
        worker.addEventListener('message', event => {
            const data = event.data as WorkerReply | WorkerStatus;
            if (!('id' in data)) {
                this.setStatus(data.status, data.reason);
                return;
            }
            const pending = this.pending.get(data.id);
            if (!pending)
                return;
            this.pending.delete(data.id);
            if (data.ok)
                pending.resolve(data.results);
            else
                pending.reject(new Error(data.message));
        });
        worker.addEventListener('error', event => {
            this.setStatus('unavailable', event.message || 'Native parser worker failed');
            this.rejectPending(this.reason);
        });
        this.worker = worker;
        return worker;
    }

    private request<T extends NativeParseResult | NativeFormatResult>(kind: RequestKind, sql: string[]): Promise<T[]> {
        if (this.state === 'unavailable')
            return Promise.reject(new Error(this.reason || 'ClickHouse native parser is unavailable'));
        const worker = this.ensureWorker(), id = this.nextId++;
        return new Promise<T[]>((resolve, reject) => {
            this.pending.set(id, {
                resolve: results => resolve(results as T[]),
                reject,
            });
            const message: WorkerRequest = { id, kind, sql };
            worker.postMessage(message);
        });
    }

    private setStatus(status: NativeParserStatus, reason = '') {
        if (status === this.state && reason === this.reason)
            return;
        this.state = status;
        this.reason = reason;
        for (const listener of this.listeners)
            listener(status);
        if (status === 'unavailable')
            this.rejectPending(reason || 'ClickHouse native parser is unavailable');
    }

    private rejectPending(message: string) {
        for (const request of this.pending.values())
            request.reject(new Error(message));
        this.pending.clear();
    }
}

export const clickHouseNativeParser = new ClickHouseNativeParser();
