import type { Run } from './types.js';

/** Compare bound values exactly, independently of object property insertion order. */
export function sameParameters(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>): boolean {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && left[key] === right[key]);
}

export function matchesDraft(run: { sql: string; parameters: Readonly<Record<string, string>> }, sql: string, parameters: Readonly<Record<string, string>>): boolean {
    return run.sql.trim() === sql.trim() && sameParameters(run.parameters, parameters);
}

/** Client-side preflight only; the server revalidates the saved revision and result. */
export function publicationIssue(
    run: Pick<Run, 'id' | 'connectionId' | 'sql' | 'parameters' | 'kind' | 'status' | 'resultState'> | undefined,
    draft: { activeRunId?: string; connectionId: string; sql: string; parameters: Readonly<Record<string, string>> },
): string | undefined {
    if (!draft.activeRunId || !run || run.id !== draft.activeRunId)
        return 'Select a completed query result before publishing.';
    if (run.connectionId !== draft.connectionId || !matchesDraft(run, draft.sql, draft.parameters))
        return 'Run this exact SQL and bound parameters before publishing. The selected evidence belongs to a different draft or connection.';
    if (run.kind !== 'query')
        return 'Run the query itself before publishing. EXPLAIN and pipeline output are not query results.';
    if (run.status !== 'succeeded' && run.status !== 'truncated')
        return 'Wait for a successful query result before publishing. Failed or unfinished runs cannot be published.';
    if (run.resultState !== 'reopenable')
        return 'The retained result is unavailable or expired. Rerun the query explicitly before publishing.';
    return undefined;
}
