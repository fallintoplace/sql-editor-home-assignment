import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@clickhouse/click-ui';
import type { Connection } from '../../shared/types';
import { Action, Callout } from '../ui';
import { message } from '../api';
import { MAX_TABS } from '../workspace-state';
import { MAX_IMPORT_BYTES, parseLocalFile, type ImportedDraft, type LocalImportPreview } from '../local-import';

export function LocalDraftImport({ connection, openTabs, onClose, onImport }: {
    connection: Pick<Connection, 'id' | 'name'>;
    openTabs: number;
    onClose: () => void;
    onImport: (entries: readonly ImportedDraft[], selection: readonly number[]) => void;
}) {
    const [preview, setPreview] = useState<LocalImportPreview>(), [selected, setSelected] = useState<number[]>([]);
    const [loading, setLoading] = useState(false), [error, setError] = useState('');
    const generation = useRef(0), applied = useRef(false);
    useEffect(() => () => { generation.current++; }, []);
    const remaining = Math.max(0, MAX_TABS - openTabs), overCapacity = selected.length > remaining;
    const close = () => { generation.current++; onClose(); };
    const read = async (file: File) => {
        const request = ++generation.current;
        setPreview(undefined); setSelected([]); setError(''); setLoading(true);
        try {
            if (file.size > MAX_IMPORT_BYTES) throw new Error('Local imports must be at most 5 MB.');
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (request !== generation.current) return;
            const parsed = parseLocalFile(file.name, bytes);
            setPreview(parsed); setSelected(parsed.entries.map((_, index) => index));
        } catch (error) {
            if (request === generation.current) setError(message(error));
        } finally {
            if (request === generation.current) setLoading(false);
        }
    };
    return <Dialog open onOpenChange={open => { if (!open) close(); }}>
        <Dialog.Content className="local-import-dialog" title="Import SQL or local backup" description="Preview a local file before creating new drafts. Existing tabs are never replaced." showClose>
            <div className="stack local-import">
                <Callout>The file is read in this browser only. Importing does not execute SQL, save a server revision, or upload the file.</Callout>
                <label className="local-file-input">Choose a UTF-8 .sql file or Cathedral .json backup (up to 5 MB)
                    <input aria-label="Choose local SQL or backup file" type="file" accept=".sql,.json" onChange={event => {
                        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
                        if (file) void read(file);
                    }}/>
                </label>
                {loading && <p role="status">Reading local file…</p>}
                {error && <Callout danger>{error}</Callout>}
                {preview && <>
                    <p><strong>{preview.filename}</strong> · {preview.entries.length} available drafts</p>
                    <p>Destination: <strong>{connection.name}</strong> ({connection.id}). Imported items become new private local drafts.</p>
                    {preview.sourceConnection && preview.sourceConnection.id !== connection.id && <Callout>Different source connection: {preview.sourceConnection.name} ({preview.sourceConnection.id}). Review table names and parameters before running here.</Callout>}
                    {preview.warnings.map((warning, index) => <p className="muted" key={index}>{warning}</p>)}
                    <div className="toolbar wrap"><Action onClick={() => setSelected(preview.entries.map((_, index) => index))}>Select all drafts</Action><Action onClick={() => setSelected([])}>Clear draft selection</Action></div>
                    <div className="local-import-list" role="group" aria-label="Drafts to import">
                        {preview.entries.map((entry, index) => <div key={entry.draft.id} className="panel-card">
                            <Action type={selected.includes(index) ? 'primary' : 'secondary'} aria-pressed={selected.includes(index)} aria-label={`Select draft ${index + 1}: ${entry.draft.name}`} onClick={() => setSelected(values => values.includes(index) ? values.filter(value => value !== index) : [...values, index])}>{entry.draft.name || 'Untitled draft'} · {entry.source === 'closed' ? 'recently closed' : entry.source}</Action>
                            <span className="muted">{entry.draft.sql.length.toLocaleString()} SQL characters · {Object.keys(entry.draft.parameters).length} parameters</span>
                            <details><summary>Preview SQL</summary><pre className="code-block">{entry.draft.sql.slice(0, 2000)}</pre>{entry.draft.sql.length > 2000 && <p className="muted">Preview shows the first 2,000 characters. The entire SQL text will be imported.</p>}</details>
                        </div>)}
                    </div>
                    <p role="status">{selected.length} selected · {remaining} open tab slots available</p>
                    {overCapacity && <Callout>Select fewer drafts or close a tab first. No partial import will be made.</Callout>}
                    <Action type="primary" disabled={loading || !selected.length || overCapacity} onClick={() => {
                        if (applied.current) return;
                        applied.current = true;
                        try { onImport(preview.entries, selected); close(); }
                        catch (error) { setError(message(error)); applied.current = false; }
                    }}>Import selected drafts</Action>
                </>}
                <Action onClick={close}>Cancel import</Action>
            </div>
        </Dialog.Content>
    </Dialog>;
}
