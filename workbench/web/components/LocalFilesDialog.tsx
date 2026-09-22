import { useEffect, useRef, useState } from 'react';
import { Checkbox, Dialog } from '@clickhouse/click-ui';
import { MAX_TABS, type Draft } from '../workspace-state';
import { previewLocalFiles, type LocalFilePreview } from '../local-files';
import { message } from '../api';
import { Action, Callout } from '../ui';

export function LocalFilesDialog({ open, connectionName, openTabs, busy, onOpenChange, onImport, restoreFocus }: {
    open: boolean;
    connectionName: string;
    openTabs: number;
    busy: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (drafts: Draft[]) => void;
    restoreFocus: () => void;
}) {
    const input = useRef<HTMLInputElement>(null), reading = useRef<AbortController | undefined>(undefined), applying = useRef(false);
    const [preview, setPreview] = useState<LocalFilePreview>(), [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false), [error, setError] = useState('');
    const remaining = Math.max(0, MAX_TABS - openTabs);
    useEffect(() => {
        reading.current?.abort();
        setPreview(undefined); setSelected(new Set()); setError(''); setLoading(false); applying.current = false;
        return () => reading.current?.abort();
    }, [open]);
    const chooseFiles = async (files: File[]) => {
        reading.current?.abort();
        const controller = new AbortController(); reading.current = controller;
        setLoading(true); setError(''); setPreview(undefined); setSelected(new Set());
        try {
            const value = await previewLocalFiles(files, controller.signal);
            if (!controller.signal.aborted) { setPreview(value); setSelected(new Set(value.candidates.map(c => c.draft.id))); }
        } catch (error) {
            if (!controller.signal.aborted) setError(message(error));
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };
    const close = (value: boolean) => { if (!value) reading.current?.abort(); onOpenChange(value); };
    return <Dialog open={open} onOpenChange={close}>
        <Dialog.Content title="Open local files" description="Preview SQL files or restore exported local drafts into new tabs. Current tabs are never replaced." showClose
            onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
            <div className="local-files-dialog">
                <Callout>Destination: <strong>{connectionName}</strong>. Files are read in this browser. Opening them does not save documents, execute SQL, or send content to AI.</Callout>
                <p className="muted">UTF-8 .sql files or local-draft .json backups. Up to 5 MB per file, 10 MB per selection, and 200,000 characters per SQL draft.</p>
                <input ref={input} type="file" hidden multiple accept=".sql,.json" aria-label="Local SQL files or draft backups" onChange={event => {
                    const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = '';
                    if (files.length) void chooseFiles(files);
                }}/>
                <Action onClick={() => input.current?.click()}>{preview || loading ? 'Choose different files' : 'Choose files'}</Action>
                {loading && <p role="status">Reading local files for preview…</p>}
                {error && <Callout danger>{error} Nothing was imported.</Callout>}
                {preview && <>
                    {preview.sourceConnections.length > 0 && <p className="muted">Backup connections: {preview.sourceConnections.join(', ')}. Check table names for the destination connection before running.</p>}
                    <p className="muted">SQL, exact text parameters, chart settings and checkpoints are copied. Optional editor metadata is normalized. Saved-document links, run history, dependencies and review status are not imported.</p>
                    <div className="toolbar wrap"><Action onClick={() => setSelected(new Set(preview.candidates.map(c => c.draft.id)))}>Select all drafts</Action><Action onClick={() => setSelected(new Set())}>Clear selection</Action></div>
                    <p role="status">{selected.size} of {preview.candidates.length} drafts selected · {remaining} tab slots available.</p>
                    <div className="local-file-list">
                        {preview.candidates.map(candidate => <div className="local-file-entry" key={candidate.draft.id}>
                            <Checkbox label={candidate.draft.name} checked={selected.has(candidate.draft.id)} onCheckedChange={checked => setSelected(current => {
                                const next = new Set(current); if (checked === true) next.add(candidate.draft.id); else next.delete(candidate.draft.id); return next;
                            })}/>
                            <small>{candidate.source} · {candidate.origin === 'sql' ? 'SQL file' : `${candidate.origin} backup tab`} · {candidate.draft.sql.length.toLocaleString()} characters · {Object.keys(candidate.draft.parameters).length} parameters · {candidate.draft.checkpoints.length} checkpoints</small>
                            <details><summary>Preview {candidate.draft.name}</summary><pre className="code-block">{candidate.draft.sql.slice(0, 2000) || '(Empty SQL draft)'}</pre>{candidate.draft.sql.length > 2000 && <small>Showing the first 2,000 characters. The full SQL text will be opened.</small>}</details>
                        </div>)}
                    </div>
                    {selected.size > remaining && <Callout>Choose at most {remaining} drafts, or cancel and close a tab first. Existing tabs will not be closed.</Callout>}
                </>}
                <div className="toolbar wrap"><Action onClick={() => close(false)}>Cancel</Action><Action type="primary" disabled={busy || loading || !preview || selected.size === 0 || selected.size > remaining} onClick={() => {
                    if (applying.current || busy || !preview) return;
                    applying.current = true;
                    try { onImport(preview.candidates.filter(candidate => selected.has(candidate.draft.id)).map(candidate => candidate.draft)); close(false); }
                    catch (error) { applying.current = false; setError(message(error)); }
                }}>Open selected drafts</Action></div>
            </div>
        </Dialog.Content>
    </Dialog>;
}
