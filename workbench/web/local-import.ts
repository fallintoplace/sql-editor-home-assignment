import type { Connection } from '../shared/types.js';
import { MAX_CLOSED_TABS, MAX_TABS, newDraft, recover, type Draft, type WorkspaceState } from './workspace-state.js';

export const MAX_IMPORT_BYTES = 5_000_000;
const MAX_SQL_LENGTH = 200_000;
type ConnectionLabel = Pick<Connection, 'id' | 'name'>;
export interface ImportedDraft { draft: Draft; source: 'sql' | 'open' | 'closed' }
export interface LocalImportPreview {
    filename: string;
    entries: ImportedDraft[];
    sourceConnection?: ConnectionLabel;
    warnings: string[];
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireThat(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

/** This is a local backup, not an authorization or execution credential. */
export function localDraftBackup(state: WorkspaceState, connection: ConnectionLabel) {
    return { format: 'cathedral-local-drafts', version: 1, exportedAt: new Date().toISOString(),
        connection: { id: connection.id, name: connection.name }, workspace: structuredClone(state) };
}

function validateParameters(value: unknown) {
    if (value === undefined) return;
    requireThat(record(value), 'Backup parameters must be named string values.');
    const entries = Object.entries(value);
    requireThat(entries.length <= 50, 'A draft can have at most 50 parameters.');
    for (const [name, parameter] of entries) {
        requireThat(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name) && !['__proto__', 'constructor', 'prototype'].includes(name), 'A backup parameter name is invalid.');
        requireThat(typeof parameter === 'string' && parameter.length <= 4000, 'Backup parameters must remain exact strings of at most 4,000 characters.');
    }
}

function importDraft(value: unknown): Draft {
    requireThat(record(value) && typeof value.sql === 'string', 'Every backup draft must contain SQL text. Nothing was imported.');
    requireThat(value.sql.length <= MAX_SQL_LENGTH, 'SQL must contain at most 200,000 characters.');
    requireThat(!value.sql.includes('\0'), 'SQL cannot contain null bytes.');
    requireThat(value.name === undefined || (typeof value.name === 'string' && value.name.length <= 180), 'Draft names must be text of at most 180 characters.');
    validateParameters(value.parameters);
    const recovered = recover('import-preview', { getItem: () => JSON.stringify({ version: 1, tabs: [value] }) }).tabs[0]!;
    // Deliberately allowlist editable content. A backup cannot reconnect to old server objects.
    return { ...newDraft(recovered.name, recovered.sql), parameters: recovered.parameters, chart: recovered.chart,
        from: recovered.from, to: recovered.to, kind: recovered.kind, metric: recovered.metric,
        checkpoints: recovered.checkpoints.map(point => ({ id: crypto.randomUUID(), at: point.at,
            reason: point.reason, sql: point.sql, from: point.from, to: point.to })) };
}

/** Parse and preview only. No storage, network, execution or mutation of existing tabs. */
export function parseLocalFile(filename: string, bytes: Uint8Array): LocalImportPreview {
    requireThat(bytes.byteLength <= MAX_IMPORT_BYTES, 'Local imports must be at most 5 MB. Choose a smaller SQL file or backup.');
    requireThat(/\.(sql|json)$/i.test(filename), 'Choose a .sql or .json file.');
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('The file must be UTF-8 text. Export it as UTF-8 and try again.'); }
    const warnings: string[] = [];
    if (/\.sql$/i.test(filename)) {
        requireThat(text.trim(), 'The SQL file is empty.');
        const name = filename.split(/[\\/]/).pop()!.slice(0, 180);
        if (filename.length > 180) warnings.push('The local tab name was shortened; the SQL is unchanged.');
        return { filename, warnings, entries: [{ source: 'sql', draft: importDraft({ name, sql: text }) }] };
    }
    let input: unknown;
    try { input = JSON.parse(text); }
    catch { throw new Error('The backup is not valid JSON. Existing drafts are unchanged.'); }
    requireThat(record(input), 'Choose a Cathedral local-draft backup, not result evidence or a data-import file.');
    let sourceConnection: ConnectionLabel | undefined;
    if (input.format !== undefined) {
        requireThat(input.format === 'cathedral-local-drafts' && input.version === 1, 'Unsupported local-draft backup format or version.');
        requireThat(record(input.connection) && typeof input.connection.id === 'string' && input.connection.id.length <= 128 &&
            typeof input.connection.name === 'string' && input.connection.name.length <= 180, 'The backup connection label is invalid.');
        sourceConnection = { id: input.connection.id, name: input.connection.name };
        input = input.workspace;
    } else warnings.push('Legacy backup: the source connection is unknown. Review the SQL before running it here.');
    requireThat(record(input) && input.version === 1, 'Unsupported local-draft backup version.');
    requireThat((Array.isArray(input.tabs) || Array.isArray(input.closedTabs)) &&
        (input.tabs === undefined || Array.isArray(input.tabs)) && (input.closedTabs === undefined || Array.isArray(input.closedTabs)), 'The backup must contain an open or closed draft list.');
    const tabs = Array.isArray(input.tabs) ? input.tabs : [], closed = Array.isArray(input.closedTabs) ? input.closedTabs : [];
    requireThat(tabs.length <= MAX_TABS && closed.length <= MAX_CLOSED_TABS, 'A backup can contain at most 30 open drafts and 10 closed drafts.');
    requireThat(tabs.length + closed.length > 0, 'The backup contains no drafts.');
    const entries: ImportedDraft[] = [
        ...tabs.map(value => ({ source: 'open' as const, draft: importDraft(value) })),
        ...closed.map(value => ({ source: 'closed' as const, draft: importDraft(value) })),
    ];
    warnings.push('Optional layout metadata is normalized. Old run IDs, saved revisions, dependencies and review status are not restored.');
    return { filename, entries, sourceConnection, warnings };
}

/** Append atomically to the latest state; importing the same file never overwrites a tab. */
export function appendImportedDrafts(state: WorkspaceState, entries: readonly ImportedDraft[], selection: readonly number[]): WorkspaceState {
    requireThat(selection.length > 0, 'Choose at least one draft to import.');
    requireThat(new Set(selection).size === selection.length && selection.every(index => Number.isSafeInteger(index) && index >= 0 && index < entries.length), 'The selected draft list is invalid.');
    const remaining = Math.max(0, MAX_TABS - state.tabs.length);
    requireThat(selection.length <= remaining, `Only ${remaining} open tab slot${remaining === 1 ? '' : 's'} remain. Select fewer drafts or close a tab first.`);
    const drafts = [...selection].sort((a, b) => a - b).map(index => ({ ...structuredClone(entries[index]!.draft), id: crypto.randomUUID() }));
    return { ...state, tabs: [...state.tabs, ...drafts], activeId: drafts[0]!.id };
}
