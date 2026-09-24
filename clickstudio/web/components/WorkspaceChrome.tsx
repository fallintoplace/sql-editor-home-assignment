import type { ReactNode } from 'react';
import type { Run, Script } from '../../shared/types';
import { Button, cx, formatBytes, formatCount, Icon, Status, terminal } from './ui';
import type { IconName } from './ui';
import type { RunEventState } from '../workspace-types';
import type { Copy } from '../i18n';

export type RunAction = {
    id: string;
    label: string;
    disabled?: boolean;
    title?: string;
    onSelect: () => void;
};

export function RunActionGroup({ runLabel, running, disabled, onRun, actions, copy }: {
    runLabel: string;
    running: boolean;
    disabled: boolean;
    onRun: () => void;
    actions: RunAction[];
    copy: Copy['common'];
}) {
    return <div className="run-action-group" role="group" aria-label={copy.runActions}>
        <Button variant="primary" className="run-query-button" data-testid="run-statement" aria-label={runLabel} onClick={onRun} disabled={disabled}><Icon name="play"/>{running ? copy.running : copy.run}</Button>
        {actions.map(action => <Button key={action.id} data-testid={`run-action-${action.id}`} variant="secondary" className="run-option-button" disabled={action.disabled} title={action.title} onClick={action.onSelect}>{action.label}</Button>)}
    </div>;
}

export function RailButton({ icon, label, active, accent, onClick }: { icon: IconName; label: string; active?: boolean; accent?: boolean; onClick: () => void }) {
    return <button className={cx('rail-icon-button', active && 'is-active', accent && 'is-accent')} type="button" title={label} aria-label={label} aria-pressed={active} onClick={onClick}><Icon name={icon}/><span className="rail-tooltip">{label}</span></button>;
}

export function EmptyWorkspace({ onRun, beginner }: { onRun: () => void; beginner: boolean }) {
    return <div className="empty-workspace"><div className="empty-graphic"><span className="empty-orbit orbit-one"/><span className="empty-orbit orbit-two"/><span className="empty-core"><Icon name="bolt"/></span><span className="empty-spark spark-one"/><span className="empty-spark spark-two"/></div><span className="eyebrow">YOUR NEXT INSIGHT STARTS HERE</span><h3>Make the data<br/><em>say something.</em></h3><p>{beginner ? 'Run a query to see your data. Results stay in this workspace when you switch modes.' : 'Run the current statement. Your query, run, and evidence stay linked.'}</p><Button variant="primary" onClick={onRun}><Icon name="play"/>Focus SQL editor</Button></div>;
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

export function ExecutionBar({ run, eventState, onCancel, cancelling, scriptRunning, helpButton, copy }: { run?: Run; eventState: RunEventState; onCancel: () => void; cancelling: boolean; scriptRunning: boolean; helpButton: ReactNode; copy: Copy['common'] }) {
    const progress = run?.progress;
    const executionInProgress = Boolean(run && (!terminal(run) || scriptRunning));
    const elapsedMs = run ? terminal(run) ? Math.round(run.elapsedMs) : Math.max(0, Math.round(progress?.elapsedMs ?? run.elapsedMs)) : undefined;

    return <footer className={cx('execution-bar', executionInProgress && 'is-running')} data-run-status={run?.status ?? 'ready'}>
        <div className="execution-state">
            {run
                ? <Status run={run} copy={copy}/>
                : <span className="execution-ready-state"><span className="status-light is-trusted"/>{copy.statusReady}</span>}
            {run && scriptRunning && <span className="execution-kind">{copy.runScript.toUpperCase()}</span>}
            {run && <>
                <span className="execution-separator"/>
                <strong>{elapsedMs?.toLocaleString()} ms</strong>
                <span className="execution-link-state">
                    <span className={cx('status-light', eventState === 'live' ? 'is-trusted' : eventState === 'reconnecting' ? 'is-warning' : '')}/>
                    {eventState === 'live' ? copy.statusLiveUpdates : eventState === 'reconnecting' ? copy.statusReconnecting : copy.statusComplete}
                </span>
            </>}
        </div>
        {run && <div className="execution-telemetry">
            <span><strong>{progress?.readRows ? formatCount(progress.readRows) : '—'}</strong> {copy.rowsRead}</span>
            <span><strong>{progress?.readBytes ? formatBytes(progress.readBytes) : '—'}</strong> {copy.bytesRead}</span>
            <span><strong>{progress?.memory ? formatBytes(progress.memory) : '—'}</strong> {copy.memory}</span>
            {run.kind !== 'query' && <span className="execution-kind">{run.kind.toUpperCase()}</span>}
        </div>}
        <div className="execution-right">
            {run && <code title={run.queryId}>{run.queryId}</code>}
            {run && (scriptRunning || !terminal(run)) && <Button variant="danger" className="cancel-execution" onClick={onCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : scriptRunning ? `${copy.cancel} ${copy.runScript.toLowerCase()}` : copy.cancel}</Button>}
            {helpButton}
        </div>
        {executionInProgress && <span className="execution-progress-line"/>}
    </footer>;
}
