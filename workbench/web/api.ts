import type { ApiError } from '../shared/types';
export class RequestError extends Error {
    constructor(public readonly status: number, public readonly detail: ApiError) { super(detail.message); }
}
export async function api<T>(path: string, options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
} = {}): Promise<T> {
    const response = await fetch(`/api${path}`, { method: options.method ?? 'GET', credentials: 'same-origin', signal: options.signal,
        headers: { 'X-Workbench-Intent': '1', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const content = await response.json().catch(() => null) as {
        error?: ApiError;
    } | null;
    if (!response.ok)
        throw new RequestError(response.status, content?.error ?? { code: 'NETWORK_RESPONSE', message: `The server returned HTTP ${response.status}` });
    return content as T;
}
export const post = <T,>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export function download(name: string, value: unknown, type = 'application/json') { const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2); const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function message(error: unknown) { return error instanceof RequestError ? `${error.detail.code}: ${error.message}` : error instanceof Error ? error.message : String(error); }
