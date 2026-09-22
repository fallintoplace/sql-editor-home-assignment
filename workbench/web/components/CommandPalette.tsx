import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '@clickhouse/click-ui';
import { Action, TextField } from '../ui';

export interface Command {
    id: string;
    name: string;
    run: () => void;
    disabledReason?: string;
}

export function CommandPalette({ open, commands, onOpenChange, restoreFocus }: {
    open: boolean;
    commands: Command[];
    onOpenChange: (open: boolean) => void;
    restoreFocus: () => void;
}) {
    const [search, setSearch] = useState(''), [selectedId, setSelectedId] = useState<string>();
    const listId = useId(), hintId = useId(), list = useRef<HTMLDivElement>(null);
    const pendingAction = useRef<(() => void) | undefined>(undefined);
    const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matches = commands.filter(command => terms.every(term => command.name.toLocaleLowerCase().includes(term)));
    const selected = matches.find(command => command.id === selectedId) ?? matches[0];
    const selectedIndex = selected ? matches.indexOf(selected) : -1;

    useEffect(() => {
        if (open) {
            setSearch('');
            setSelectedId(undefined);
            pendingAction.current = undefined;
        }
    }, [open]);
    useEffect(() => {
        list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [selected?.id, search, open]);

    const choose = (command?: Command) => {
        if (!command || command.disabledReason) return;
        // Let the palette release its focus trap before another action opens a dialog.
        pendingAction.current = command.run;
        onOpenChange(false);
    };
    return <Dialog open={open} onOpenChange={onOpenChange}>
        <Dialog.Content title="Commands and Quick Open" description="Search commands and saved files. Nothing runs until you choose an available action." showClose
            onCloseAutoFocus={event => {
                event.preventDefault();
                restoreFocus();
                const action = pendingAction.current;
                pendingAction.current = undefined;
                action?.();
            }}>
            <TextField autoFocus role="combobox" aria-label="Search commands" aria-autocomplete="list"
                aria-expanded={open} aria-controls={listId} aria-describedby={hintId}
                aria-activedescendant={selected ? `${listId}-${selectedIndex}` : undefined}
                placeholder="Find a command or saved file…" value={search}
                onChange={value => { setSearch(value); setSelectedId(undefined); }}
                onKeyDown={event => {
                    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        if (matches.length) {
                            const next = (selectedIndex + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
                            setSelectedId(matches[next]!.id);
                        }
                    } else if (event.key === 'Enter') {
                        event.preventDefault();
                        if (!event.repeat) choose(selected);
                    }
                }}/>
            <p id={hintId} className="muted command-hint">↑ ↓ navigate · Enter choose · Escape close</p>
            <div ref={list} id={listId} className="palette-list" role="listbox" aria-label="Command results">
                {matches.map((command, index) => <Action key={command.id} id={`${listId}-${index}`}
                    className="palette-option" role="option" aria-selected={selected?.id === command.id}
                    aria-disabled={Boolean(command.disabledReason)} tabIndex={-1} type="empty" align="left"
                    onMouseDown={event => event.preventDefault()} onClick={() => choose(command)}>
                    <span>{command.name}{command.disabledReason && <small>{command.disabledReason}</small>}</span>
                </Action>)}
            </div>
            <p role="status" className="muted command-hint">{matches.length ? `${matches.length} matching commands` : 'No matching commands. Try a different search.'}</p>
            {!matches.length && <Action onClick={() => { setSearch(''); setSelectedId(undefined); }}>Clear command search</Action>}
        </Dialog.Content>
    </Dialog>;
}
