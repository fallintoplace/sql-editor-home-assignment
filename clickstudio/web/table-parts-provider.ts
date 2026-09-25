import type { MergeTreePartsSnapshot } from '../shared/parts';
import { api, isFrontendDemoPreview } from './api';
import { loadPlaygroundTableParts, PLAYGROUND_CONNECTION_ID } from './playground';

export function loadTableParts(connectionId: string, database: string, table: string, signal: AbortSignal): Promise<MergeTreePartsSnapshot> {
    if (isFrontendDemoPreview && connectionId === PLAYGROUND_CONNECTION_ID)
        return loadPlaygroundTableParts(database, table, signal);
    return api<MergeTreePartsSnapshot>(`/connections/${encodeURIComponent(connectionId)}/table-parts`, {
        method: 'POST',
        body: { database, table },
        signal,
    });
}
