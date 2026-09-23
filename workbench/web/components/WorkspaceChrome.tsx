import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Run, Script } from '../../shared/types';
import { Button, cx, formatBytes, formatCount, Icon, Status, terminal } from './ui';
import type { IconName } from './ui';
import type { RunEventState } from '../workspace-types';

export type RunAction = {
    label: string;
    shortcut?: string;
    disabled?: boolean;
    title?: string;
    onSelect: () => void;
};

export function RunActionMenu({ runLabel, running, disabled, onRun, actions }: {
    runLabel: string;
    running: boolean;
    disabled: boolean;
    onRun: () => void;
    actions: RunAction[];
}) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const closeOutside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setOpen(false);
            trigger.current?.focus();
        };
        const frame = window.requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus());
        document.addEventListener('pointerdown', closeOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener('pointerdown', closeOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    const moveMenuFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
        if (!items.length) return;
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'ArrowDown' ? (current + 1) % items.length
            : event.key === 'ArrowUp' ? (current - 1 + items.length) % items.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : undefined;
        if (next === undefined) return;
        event.preventDefault();
        items[next]?.focus();
    };

    return <div className="run-action-menu" ref={root}>
        <Button variant="primary" className="run-query-button" aria-label={runLabel} onClick={onRun} disabled={disabled}><Icon name="play"/>{running ? 'Running…' : 'Run'}<kbd>⌘ ↵</kbd></Button>
        <button ref={trigger} className="run-action-trigger" type="button" aria-label="More run options" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(value => !value)}><Icon name="chevron"/></button>
        {open && <div className="run-action-popover" role="menu" aria-label="Run options" ref={menu} onKeyDown={moveMenuFocus}>
            {actions.map(action => <button key={action.label} type="button" role="menuitem" className="run-action-item" disabled={action.disabled} title={action.title} onClick={() => { setOpen(false); action.onSelect(); }}><span>{action.label}</span>{action.shortcut && <kbd>{action.shortcut}</kbd>}</button>)}
        </div>}
    </div>;
}

export function RailButton({ icon, label, active, accent, onClick }: { icon: IconName; label: string; active?: boolean; accent?: boolean; onClick: () => void }) {
    return <button className={cx('rail-icon-button', active && 'is-active', accent && 'is-accent')} type="button" title={label} aria-label={label} aria-pressed={active} onClick={onClick}><Icon name={icon}/><span className="rail-tooltip">{label}</span></button>;
}

export function EmptyWorkspace({ onRun, beginner }: { onRun: () => void; beginner: boolean }) {
    return <div className="empty-workspace"><div className="empty-graphic"><span className="empty-orbit orbit-one"/><span className="empty-orbit orbit-two"/><span className="empty-core"><Icon name="bolt"/></span><span className="empty-spark spark-one"/><span className="empty-spark spark-two"/></div><span className="eyebrow">YOUR NEXT INSIGHT STARTS HERE</span><h3>Make the data<br/><em>say something.</em></h3><p>{beginner ? 'Run a query to see your data. Results stay in this workspace when you switch modes.' : 'Run the current statement. Your query, run, and evidence stay linked.'}</p><Button variant="primary" onClick={onRun}><Icon name="play"/>Focus SQL editor</Button><span className="empty-shortcut">or press <kbd>⌘ ↵</kbd> to run</span></div>;
}

export function ScriptResults({ script, runs, activeRunId, onSelectRun, onCancel, cancelDisabled }: {
    script: Script;
    runs: Run[];
    activeRunId?: string;
    onSelectRun: (runId: string) => void;
    onCancel: () => void;
    cancelDisabled: boolean;
}) {
    const byId = new Map(runs.map(run => [run.id, run]));
    return <section className="script-results" aria-label="Script statement results">
        <div className="script-results-heading"><span><span className="eyebrow">SCRIPT EXECUTION</span><strong>{script.statements.length} statements <i>·</i> {script.status}</strong></span>{script.status === 'running' && <Button variant="danger" className="toolbar-small" onClick={onCancel} disabled={cancelDisabled}>Cancel script</Button>}</div>
        <div className="script-statement-list">{script.statements.map((statement, index) => {
            const run = statement.runId ? byId.get(statement.runId) : undefined;
            const details = run?.error ? `${run.error.code}: ${run.error.message}` : run ? `${run.rowCount.toLocaleString()} rows · ${Math.round(run.elapsedMs)} ms` : statement.status === 'pending' ? 'Waiting to run' : 'Not executed';
            return <button key={`${script.id}-${index}`} type="button" className={cx('script-statement', statement.runId === activeRunId && 'is-active')} aria-label={`Statement ${index + 1}: ${statement.status}`} aria-pressed={statement.runId === activeRunId} title={details} disabled={!statement.runId} onClick={() => statement.runId && onSelectRun(statement.runId)}>
                <span className="script-statement-index">{String(index + 1).padStart(2, '0')}</span><span className="script-statement-copy"><strong>Statement {index + 1}</strong><code>{statement.sql.replace(/\s+/g, ' ').slice(0, 72)}</code><small>{details}</small></span><span className={cx('script-status', `status-${statement.status}`)}>{statement.status}</span>
            </button>;
        })}</div>
    </section>;
}

export function ExecutionBar({ run, eventState, onCancel, busy, scriptRunning }: { run: Run; eventState: RunEventState; onCancel: () => void; busy: boolean; scriptRunning: boolean }) {
    const progress = run.progress;
    return <footer className={cx('execution-bar', (!terminal(run) || scriptRunning) && 'is-running')}><div className="execution-state"><Status run={run}/>{scriptRunning && <span className="execution-kind">SCRIPT RUNNING</span>}<span className="execution-separator"/><strong>{terminal(run) ? `${Math.round(run.elapsedMs)} ms` : `${Math.max(0, Math.round(progress?.elapsedMs ?? run.elapsedMs))} ms`}</strong><span className="execution-link-state"><span className={cx('status-light', eventState === 'live' ? 'is-trusted' : eventState === 'reconnecting' ? 'is-warning' : '')}/>{eventState === 'live' ? 'Live updates' : eventState === 'reconnecting' ? 'Reconnecting' : 'Complete'}</span></div><div className="execution-telemetry"><span><strong>{progress?.readRows ? formatCount(progress.readRows) : '—'}</strong> rows read</span><span><strong>{progress?.readBytes ? formatBytes(progress.readBytes) : '—'}</strong> read</span><span><strong>{progress?.memory ? formatBytes(progress.memory) : '—'}</strong> memory</span>{run.kind !== 'query' && <span className="execution-kind">{run.kind.toUpperCase()}</span>}</div><div className="execution-right"><code title={run.queryId}>{run.queryId}</code>{(scriptRunning || !terminal(run)) && <Button variant="danger" className="cancel-execution" onClick={onCancel} disabled={busy}>{scriptRunning ? 'Cancel script' : 'Cancel'}</Button>}</div><span className="execution-progress-line"/></footer>;
}
