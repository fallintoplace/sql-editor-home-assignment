import type { QueryDocument } from '../../shared/types';
import { draftSaveStatus, type SaveableDraft } from '../../shared/workbench-view';
import { Action } from '../ui';

export function DraftSaveStatus({ draft, connectionId, saved, saving, pending, readError, onRetry, onCompare }: {
    draft: SaveableDraft;
    connectionId: string;
    saved?: QueryDocument;
    saving: boolean;
    pending: boolean;
    readError: boolean;
    onRetry: () => void;
    onCompare: () => void;
}) {
    const status = draftSaveStatus(draft, connectionId, saved, { saving, pending, readError });
    return <div className="draft-save-status" data-state={status.state}>
        <span role="status" aria-label="Revision save status" title={status.detail}>{status.label}</span>
        {['conflict', 'deleted', 'unavailable'].includes(status.state) && <small>{status.detail}</small>}
        {(status.state === 'conflict' || status.state === 'deleted') && <Action type="empty" onClick={onCompare}>Open revision library</Action>}
        {status.state === 'unavailable' && <Action type="empty" disabled={pending} onClick={onRetry}>Check saved revision</Action>}
    </div>;
}
