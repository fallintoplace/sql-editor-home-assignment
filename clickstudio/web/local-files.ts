import type { Connection } from '../shared/types.js';
import { MAX_CLOSED_TABS, MAX_TABS, newDraft, recoverDraft, type Draft, type WorkspaceState } from './workspace-state.js';

export const MAX_LOCAL_FILE_BYTES = 5_000_000;
export const MAX_LOCAL_BATCH_BYTES = 10_000_000;
export const MAX_IMPORT_DRAFTS = MAX_TABS + MAX_CLOSED_TABS;
const MAX_SQL_LENGTH = 200_000;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export interface LocalFile {
    name: string;
    size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}
export interface LocalDraftCandidate {
    draft: Draft;
    source: string;
    origin: 'sql' | 'open' | 'closed';
}
export interface LocalFilePreview {
    candidates: LocalDraftCandidate[];
    sourceConnections: string[];
}

/** A portable backup is local draft data, not an execution or authorization credential. */
export function localDraftBackup(state: WorkspaceState, connection: Pick<Connection, 'id' | 'name' | 'database'>) {
    return { format: 'clickstudio-local-drafts', version: 1, exportedAt: new Date().toISOString(),
        sourceConnection: { id: connection.id, name: connection.name, database: connection.database },
        tabs: state.tabs, activeId: state.activeId, closedTabs: state.closedTabs ?? [] };
}

/** Copy only editable content. Never attach imported text to saved documents or old runs. */
export function isolatedDraft(draft: Draft): Draft {
    return { ...newDraft(draft.name, draft.sql), parameters: structuredClone(draft.parameters),
        chart: structuredClone(draft.chart), kind: draft.kind, metric: structuredClone(draft.metric),
        from: draft.from, to: draft.to,
        checkpoints: draft.checkpoints.map(point => ({ id: crypto.randomUUID(), at: point.at, reason: point.reason,
            sql: point.sql, from: point.from, to: point.to })) };
}

function importedDraft(value: unknown, context: string): Draft {
    if (!isRecord(value) || typeof value.sql !== 'string' || value.sql.length > MAX_SQL_LENGTH)
        throw new Error(`${context}: every draft must contain SQL text of at most 200,000 characters.`);
    if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 180)
        throw new Error(`${context}: each draft needs a name of 1-180 characters.`);
    if (value.parameters !== undefined) {
        if (!isRecord(value.parameters) || Object.keys(value.parameters).length > 50)
            throw new Error(`${context}: parameters must be an object with at most 50 text values.`);
        for (const [key, parameter] of Object.entries(value.parameters)) {
            if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key) ||
                typeof parameter !== 'string' || parameter.length > 4000)
                throw new Error(`${context}: parameter names must be valid and values must be exact strings of at most 4,000 characters.`);
        }
    }
    if (value.checkpoints !== undefined && (!Array.isArray(value.checkpoints) || value.checkpoints.length > 30 ||
        value.checkpoints.some(point => !isRecord(point) || typeof point.sql !== 'string' || point.sql.length > MAX_SQL_LENGTH)))
        throw new Error(`${context}: checkpoints must contain valid SQL text, with at most 30 checkpoints per draft.`);
    const recovered = recoverDraft(value);
    if (!recovered) throw new Error(`${context}: the draft could not be read.`);
    return isolatedDraft(recovered);
}

/** Validate the whole selection before returning a preview. No partial workspace writes. */
export async function previewLocalFiles(files: readonly LocalFile[], signal?: AbortSignal): Promise<LocalFilePreview> {
    signal?.throwIfAborted();
    if (!files.length || files.length > MAX_TABS) throw new Error('Choose between 1 and 30 SQL files or local draft backups.');
    let totalBytes = 0;
    for (const file of files) {
        if (!/\.(sql|json)$/i.test(file.name)) throw new Error(`${file.name}: choose a .sql file or a local-draft .json backup. Use Data import for CSV rows.`);
        if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_LOCAL_FILE_BYTES)
            throw new Error(`${file.name}: each file must be at most 5 MB.`);
        totalBytes += file.size;
    }
    if (totalBytes > MAX_LOCAL_BATCH_BYTES) throw new Error('The selected files must total at most 10 MB.');
    const candidates: LocalDraftCandidate[] = [], sourceConnections = new Set<string>();
    for (const file of files) {
        signal?.throwIfAborted();
        const bytes = await file.arrayBuffer();
        signal?.throwIfAborted();
        if (bytes.byteLength !== file.size) throw new Error(`${file.name}: the file changed while reading. Choose it again.`);
        let text: string;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
        catch { throw new Error(`${file.name}: save the file as UTF-8 text before opening it.`); }
        if (/\.sql$/i.test(file.name)) {
            const name = file.name.split(/[\\/]/).pop()!;
            const draft = importedDraft({ name, sql: text }, file.name);
            candidates.push({ draft, source: file.name, origin: 'sql' });
        } else {
            let value: unknown;
            try { value = JSON.parse(text); }
            catch { throw new Error(`${file.name}: invalid JSON. Choose an exported local-draft backup.`); }
            if (isRecord(value) && value.format === 'clickstudio-workspace')
                throw new Error(`${file.name}: this is a saved-workspace export. Use Import workspace in the revision library instead.`);
            if (!isRecord(value) || value.version !== 1 ||
                (value.format !== undefined && value.format !== 'clickstudio-local-drafts') ||
                (!Array.isArray(value.tabs) && !Array.isArray(value.closedTabs)))
                throw new Error(`${file.name}: unsupported local-draft backup format.`);
            if ((value.tabs !== undefined && !Array.isArray(value.tabs)) || (value.closedTabs !== undefined && !Array.isArray(value.closedTabs)))
                throw new Error(`${file.name}: draft lists must be arrays.`);
            const open: unknown[] = Array.isArray(value.tabs) ? value.tabs : [];
            const closed: unknown[] = Array.isArray(value.closedTabs) ? value.closedTabs : [];
            if (open.length > MAX_TABS || closed.length > MAX_CLOSED_TABS)
                throw new Error(`${file.name}: a backup supports at most 30 open and 10 closed drafts.`);
            if (!open.length && !closed.length) throw new Error(`${file.name}: this backup contains no drafts.`);
            if (isRecord(value.sourceConnection) && typeof value.sourceConnection.name === 'string')
                sourceConnections.add(value.sourceConnection.name.slice(0, 180));
            for (const [origin, drafts] of [['open', open], ['closed', closed]] as const) {
                for (const [index, raw] of drafts.entries()) {
                    const draft = importedDraft(raw, `${file.name}, ${origin} draft ${index + 1}`);
                    candidates.push({ draft, source: file.name, origin });
                }
            }
        }
        if (candidates.length > MAX_IMPORT_DRAFTS) throw new Error('Preview at most 40 drafts at a time. Choose fewer files.');
    }
    return { candidates, sourceConnections: [...sourceConnections] };
}

/** Recheck capacity against current state, then append all selected drafts in one update. */
export function appendLocalDrafts(state: WorkspaceState, drafts: readonly Draft[]): WorkspaceState {
    if (!drafts.length) throw new Error('Select at least one draft to open.');
    const remaining = Math.max(0, MAX_TABS - state.tabs.length);
    if (drafts.length > remaining) throw new Error(`Only ${remaining} tab slots remain. Select fewer drafts or close a tab first.`);
    const incoming = drafts.map(isolatedDraft);
    return { ...state, tabs: [...state.tabs, ...incoming], activeId: incoming[0]!.id };
}
