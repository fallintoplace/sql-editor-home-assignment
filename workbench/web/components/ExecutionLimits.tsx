import { forwardRef, useId } from 'react';
import { HARD_LIMITS, type Limits } from '../../shared/types';
import { executionLimitIssue } from '../../shared/workbench-view';
import { Action, TextField } from '../ui';

interface Props {
    rows: string;
    seconds: string;
    defaults: Pick<Limits, 'rows' | 'seconds'>;
    onRows: (value: string) => void;
    onSeconds: (value: string) => void;
}

export const ExecutionLimits = forwardRef<HTMLDivElement, Props>(function ExecutionLimits({ rows, seconds, defaults, onRows, onSeconds }, ref) {
    const id = useId();
    const rowIssue = executionLimitIssue(rows, 'rows'), timeIssue = executionLimitIssue(seconds, 'seconds');
    return <div ref={ref} className="execution-limits" role="group" aria-label="Execution limits">
        <div className="limit-field">
            <TextField label="Maximum returned rows" value={rows} onChange={onRows} inputMode="numeric"
                aria-invalid={Boolean(rowIssue)} aria-describedby={`${id}-rows-help`}/>
            <p id={`${id}-rows-help`} className={rowIssue ? 'field-error' : 'muted'}>{rowIssue ?? `1-${HARD_LIMITS.rows.toLocaleString()} rows. Connection default: ${defaults.rows.toLocaleString()}.`}</p>
        </div>
        <div className="limit-field">
            <TextField label="Deadline (seconds)" value={seconds} onChange={onSeconds} inputMode="numeric"
                aria-invalid={Boolean(timeIssue)} aria-describedby={`${id}-seconds-help`}/>
            <p id={`${id}-seconds-help`} className={timeIssue ? 'field-error' : 'muted'}>{timeIssue ?? `1-${HARD_LIMITS.seconds} seconds. Connection default: ${defaults.seconds}.`}</p>
        </div>
        <Action disabled={rows === String(defaults.rows) && seconds === String(defaults.seconds)} onClick={() => {
            onRows(String(defaults.rows)); onSeconds(String(defaults.seconds));
        }}>Reset limits</Action>
    </div>;
});
