import type { AssistantAction, Proposal } from '../../shared/types';
import { Button, cx, Icon } from './ui';
import type { AssistantContext } from '../workspace-types';

const assistantActionOptions = [
    { value: 'generate', label: 'Write a query' },
    { value: 'explain', label: 'Explain this SQL' },
    { value: 'repair', label: 'Fix a query error' },
    { value: 'review', label: 'Review SQL' },
    { value: 'performance', label: 'Analyze performance' },
    { value: 'result', label: 'Explain the result' },
] as const satisfies readonly { value: AssistantAction; label: string }[];

export type AssistantWorkflowProps = {
    mode: 'beginner' | 'expert';
    sql: string;
    action: AssistantAction;
    onActionChange: (action: AssistantAction) => void;
    question: string;
    onQuestionChange: (question: string) => void;
    context?: AssistantContext;
    proposal?: Proposal;
    busy: boolean;
    error: string;
    trusted: boolean;
    runId?: string;
    includeResult: boolean;
    onIncludeResult: (include: boolean) => void;
    onVoiceInput: () => void;
    voiceListening: boolean;
    voiceError: string;
    onPreview: () => void;
    onRequestProposal: () => void;
    onDecideProposal: (decision: 'accepted' | 'rejected') => void;
    onRunQuery: () => void;
    runDisabled: boolean;
};

function AssistantOutput({ mode, sql, context, proposal, busy, error, onRequestProposal, onDecideProposal, onRunQuery, runDisabled }: Pick<AssistantWorkflowProps, 'mode' | 'sql' | 'context' | 'proposal' | 'busy' | 'error' | 'onRequestProposal' | 'onDecideProposal' | 'onRunQuery' | 'runDisabled'>) {
    const beginner = mode === 'beginner';
    return <>
        {error && <div className="callout callout-error" role="alert">{error}</div>}
        {context && <div className="context-preview animate-enter"><span className="eyebrow">CONTEXT PREVIEW</span>{context.summary.map(item => <p key={item}><span>✓</span>{item}</p>)}<Button variant="primary" className="w-full" disabled={busy} onClick={onRequestProposal}>{busy ? 'Waiting for proposal…' : 'Send to AI & propose'}</Button></div>}
        {proposal && <div className={cx('proposal-card animate-enter', beginner && 'beginner-proposal-card')}><div className="proposal-heading"><span className={cx('proposal-quality', proposal.quality?.status)}>{proposal.quality?.score ?? '—'}<small>QUALITY</small></span><div><span className="eyebrow">PROPOSAL · {proposal.decision.toUpperCase()}</span><strong>{proposal.summary}</strong></div></div>{proposal.clarification && <div className="callout">{proposal.clarification}</div>}{proposal.assumptions.map(item => <p className="proposal-point" key={item}><span>ASSUMPTION</span>{item}</p>)}{proposal.caveats.map(item => <p className="proposal-point" key={item}><span>CAVEAT</span>{item}</p>)}{proposal.findings.map(item => <p className="proposal-finding" key={`${item.severity}-${item.message}`}><strong>{item.severity}</strong>{item.message}<small>{item.evidence}</small></p>)}{proposal.sql !== null && <><span className="eyebrow mt-4">PROPOSED SQL</span><pre className="proposal-sql">{proposal.sql}</pre>{proposal.decision === 'pending' && <>{proposal.baseSql !== sql && <div className="callout callout-error">This proposal is for an earlier SQL draft. Refresh the context before applying it.</div>}<div className="proposal-buttons"><Button variant="secondary" onClick={() => onDecideProposal('rejected')} disabled={busy}>Reject</Button><Button variant="primary" onClick={() => onDecideProposal('accepted')} disabled={busy || proposal.baseSql !== sql}>{beginner ? 'Use this query' : 'Apply to editor'}</Button></div></>}{beginner && proposal.decision === 'accepted' && <div className="beginner-run-ready"><span><span className="status-light is-trusted"/> Added to your SQL draft</span><Button variant="primary" onClick={onRunQuery} disabled={runDisabled || busy}><Icon name="play"/>{busy ? 'Starting…' : 'Run this query'}</Button></div>}</>}</div>}
    </>;
}

export function AssistantWorkflow({ mode, sql, action, onActionChange, question, onQuestionChange, context, proposal, busy, error, trusted, runId, includeResult, onIncludeResult, onVoiceInput, voiceListening, voiceError, onPreview, onRequestProposal, onDecideProposal, onRunQuery, runDisabled }: AssistantWorkflowProps) {
    const beginner = mode === 'beginner';
    const speechAvailable = Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
    const output = <AssistantOutput mode={mode} sql={sql} context={context} proposal={proposal} busy={busy} error={error} onRequestProposal={onRequestProposal} onDecideProposal={onDecideProposal} onRunQuery={onRunQuery} runDisabled={runDisabled}/>;
    if (beginner) return <section className="assistant-panel beginner-ai-panel animate-enter" aria-label="Ask AI to write a query">
        <div className="assistant-safety"><span className="assistant-glyph"><Icon name="assistant"/></span><div><strong>Ask AI to draft SQL</strong><p>Your question and schema are reviewed before anything is sent. Generated SQL never runs automatically.</p></div></div>
        <label className="field-label" htmlFor="beginner-query-prompt">YOUR QUESTION<textarea id="beginner-query-prompt" className="field-textarea" aria-label="Describe your data question" value={question} onChange={event => onQuestionChange(event.target.value)} readOnly={voiceListening} placeholder="For example: show event counts by day" rows={4}/></label>
        <div className="flex flex-wrap items-center justify-between gap-2"><Button variant="ghost" className={cx('voice-button', voiceListening && 'is-listening')} title={speechAvailable ? (voiceListening ? 'Stop dictation' : 'Dictate your question') : 'Voice input is not available in this browser'} aria-label={voiceListening ? 'Stop dictation' : 'Dictate question'} disabled={!speechAvailable} onClick={onVoiceInput}><Icon name="mic"/>{voiceListening ? 'Listening…' : 'Use voice'}</Button><Button variant="secondary" disabled={!trusted || busy || !question.trim()} onClick={onPreview}>{busy ? 'Preparing…' : context ? 'Refresh review' : 'Review context'}</Button></div>
        {!trusted && <div className="callout">Review the connection before asking AI to use its schema.</div>}
        {voiceError && <div className="callout callout-error" role="alert">{voiceError}</div>}
        <div className="assistant-actions">{output}</div>
    </section>;
    return <section className="assistant-panel"><div className="assistant-safety"><span className="assistant-glyph"><Icon name="assistant"/></span><div><strong>AI, with you in control.</strong><p>Review context, request a proposal, then decide whether to apply it. Nothing executes automatically.</p></div></div><label className="field-label">ACTION<select className="field-input" value={action} onChange={event => { const option = assistantActionOptions.find(candidate => candidate.value === event.target.value); if (option) onActionChange(option.value); }}>{assistantActionOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="field-label">WHAT WOULD YOU LIKE TO KNOW?<textarea className="field-textarea" value={question} onChange={event => onQuestionChange(event.target.value)} placeholder="Describe the question, error, or improvement you want…" rows={4}/></label><label className="include-result"><input type="checkbox" checked={includeResult} onChange={event => onIncludeResult(event.target.checked)} disabled={!runId}/><span><strong>Include selected retained result</strong><small>Rows may contain sensitive data. Inspect before sharing.</small></span></label>{voiceError && <div className="callout callout-error" role="alert">{voiceError}</div>}<div className="assistant-actions"><Button variant="secondary" className="w-full" disabled={!trusted || busy} onClick={onPreview}>{busy && !context ? 'Preparing context…' : context ? 'Refresh context preview' : 'Preview what will be shared'}</Button>{output}</div></section>;
}
