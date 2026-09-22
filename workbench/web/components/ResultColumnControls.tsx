import { useMemo, useState } from 'react';
import type { Column } from '../../shared/types';
import { matchingColumns, toggleColumn, visibleColumns } from '../../shared/result-columns';
import { Action, TextField } from '../ui';

export function ResultColumnControls({ columns, hidden, onChange }: {
    columns: Column[];
    hidden: number[];
    onChange: (hidden: number[]) => void;
}) {
    const [search, setSearch] = useState('');
    const shown = useMemo(() => visibleColumns(columns.length, hidden), [columns.length, hidden]);
    const matches = useMemo(() => matchingColumns(columns, search), [columns, search]);
    return <details className="result-column-controls">
        <summary>Columns · {shown.length} of {columns.length} visible</summary>
        <div className="stack">
            <TextField label="Find result columns" placeholder="Search name, type, or position" value={search} onChange={setSearch} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setSearch(''); } }}/>
            <Action disabled={!hidden.length} onClick={() => onChange([])}>Show all columns</Action>
            <div className="result-column-options" role="group" aria-label="Visible result columns">
                {matches.map(index => <Action key={index} aria-pressed={shown.includes(index)}
                    aria-label={`Column ${index + 1}: ${columns[index]!.name}`} disabled={shown.length === 1 && shown[0] === index}
                    title={shown.length === 1 && shown[0] === index ? 'Keep at least one column visible.' : undefined}
                    type={shown.includes(index) ? 'primary' : 'secondary'} onClick={() => onChange(toggleColumn(columns.length, hidden, index))}>
                    {index + 1}. {columns[index]!.name}<small>{columns[index]!.type}</small>
                </Action>)}
            </div>
            {!matches.length && <p role="status">No columns match this search.</p>}
            <p className="muted">Column visibility is local to this result view. Hidden columns remain in retained evidence, charts, row search, and full exports.</p>
        </div>
    </details>;
}
