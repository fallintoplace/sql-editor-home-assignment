import type { NativeFormatResult, NativeParseResult, NativeParserFeatures, NativeParserStatus } from '../shared/native-parser';

type RequestKind = 'parseMany' | 'formatMany';
type WorkerRequest = { id: number; kind: RequestKind; sql: string[] };
type WorkerReply =
    | { id: number; ok: true; results: Array<NativeParseResult | NativeFormatResult> }
    | { id: number; ok: false; message: string };
type WorkerStatus =
    | { kind: 'status'; status: 'ready'; features: NativeParserFeatures }
    | { kind: 'status'; status: 'unavailable'; reason?: string };
type Pending = { resolve: (value: Array<NativeParseResult | NativeFormatResult>) => void; reject: (error: Error) => void };

class ClickHouseNativeParser {
    private worker?: Worker;
    private nextId = 1;
    private pending = new Map<number, Pending>();
    private listeners = new Set<(status: NativeParserStatus, features?: NativeParserFeatures) => void>();
    private state: NativeParserStatus = 'loading';
    private reason = '';
    private parserFeatures?: NativeParserFeatures;

    get status(): NativeParserStatus {
        return this.state;
    }

    get features(): NativeParserFeatures | undefined {
        return this.parserFeatures;
    }

    subscribe(listener: (status: NativeParserStatus, features?: NativeParserFeatures) => void): () => void {
        this.listeners.add(listener);
        listener(this.state, this.parserFeatures);
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

    retry() {
        if (this.state !== 'unavailable') return;
        this.worker?.terminate();
        this.worker = undefined;
        this.setStatus('loading');
        try {
            this.ensureWorker();
        } catch (error) {
            this.setStatus('unavailable', error instanceof Error ? error.message : String(error));
        }
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
                this.setStatus(data.status, data.status === 'unavailable' ? data.reason : '', data.status === 'ready' ? data.features : undefined);
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

    private setStatus(status: NativeParserStatus, reason = '', features?: NativeParserFeatures) {
        const sameFeatures = this.parserFeatures?.format === features?.format
            && this.parserFeatures?.dcl === features?.dcl
            && this.parserFeatures?.astJson === features?.astJson;
        if (status === this.state && reason === this.reason && sameFeatures)
            return;
        this.state = status;
        this.reason = reason;
        this.parserFeatures = status === 'ready' ? features : undefined;
        for (const listener of this.listeners)
            listener(status, this.parserFeatures);
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
