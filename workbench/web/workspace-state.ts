import type { ChartConfig, MetricContract } from '../shared/types';
export const SAMPLE_SQL = "SELECT\n    toDate('2026-01-01') + number AS day,\n    (number + 1) * 10 AS events\nFROM numbers(7)\nORDER BY day";
export interface Checkpoint {
    id: string;
    at: string;
    reason: string;
    sql: string;
    from: number;
    to: number;
    parentRevision?: number;
}
export interface Draft {
    id: string;
    name: string;
    sql: string;
    serverId?: string;
    baseRevision?: number;
    parameters: Record<string, string>;
    chart: ChartConfig;
    runIds: string[];
    activeRunId?: string;
    scriptId?: string;
    parentRunId?: string;
    parentDocumentId?: string;
    checkpoints: Checkpoint[];
    from: number;
    to: number;
    kind: 'query' | 'snippet' | 'metric';
    metric?: MetricContract;
    dependencies: string[];
}
export interface WorkspaceState {
    version: 1;
    tabs: Draft[];
    activeId: string;
}
export const newDraft = (name = 'Untitled.sql', sql = SAMPLE_SQL): Draft => ({ id: crypto.randomUUID(), name, sql, parameters: {}, chart: { kind: 'table', x: 0, ys: [], title: 'Query result' }, runIds: [], checkpoints: [], from: 0, to: 0, kind: 'query', dependencies: [] });
export function recover(key: string): WorkspaceState {
    try {
        const v = JSON.parse(localStorage.getItem(key) ?? 'null') as WorkspaceState | null;
        if (v?.version === 1 && Array.isArray(v.tabs) && v.tabs.length > 0 && v.tabs.length <= 30 && v.tabs.every(t => typeof t.id === 'string' && typeof t.name === 'string' && typeof t.sql === 'string' && t.sql.length <= 200000 && Array.isArray(t.checkpoints) && Array.isArray(t.runIds) && t.parameters && t.chart))
            return { ...v, activeId: v.tabs.some(t => t.id === v.activeId) ? v.activeId : v.tabs[0]!.id };
    }
    catch { /* Corrupt or unavailable browser storage never prevents opening the editor. */ }
    const draft = newDraft('Getting started.sql');
    return { version: 1, tabs: [draft], activeId: draft.id };
}
export function checkpoint(draft: Draft, reason: string): Draft { return { ...draft, checkpoints: [{ id: crypto.randomUUID(), at: new Date().toISOString(), reason, sql: draft.sql, from: draft.from, to: draft.to, parentRevision: draft.baseRevision }, ...draft.checkpoints].slice(0, 30) }; }
