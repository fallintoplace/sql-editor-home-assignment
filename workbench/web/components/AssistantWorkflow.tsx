import type { AssistantAction, Proposal } from '../../shared/types';
import { Button, cx, Icon } from './ui';
import type { AssistantContext, SpeechWindow } from '../workspace-types';

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
    onSave?: () => void;
    saveDisabled?: boolean;
};

function AssistantOutput({ mode, sql, context, proposal, busy, error, onRequestProposal, onDecideProposal, onRunQuery, runDisabled }: Pick<AssistantWorkflowProps, 'mode' | 'sql' | 'context' | 'proposal' | 'busy' | 'error' | 'onRequestProposal' | 'onDecideProposal' | 'onRunQuery' | 'runDisabled'>) {
    const beginner = mode === 'beginner';
    return <>
        {error && <div className="callout callout-error" role="alert">{error}</div>}
        {context && <div className="context-preview animate-enter"><span className="eyebrow">CONTEXT PREVIEW</span>{context.summary.map(item => <p key={item}><span>✓</span>{item}</p>)}<Button variant="primary" className="w-full" disabled={busy} onClick={onRequestProposal}>{busy ? 'Waiting for proposal…' : 'Send to AI & propose'}</Button></div>}
        {proposal && <div className={cx('proposal-card animate-enter', beginner && 'beginner-proposal-card')}><div className="proposal-heading"><span className={cx('proposal-quality', proposal.quality?.status)}>{proposal.quality?.score ?? '—'}<small>QUALITY</small></span><div><span className="eyebrow">PROPOSAL · {proposal.decision.toUpperCase()}</span><strong>{proposal.summary}</strong></div></div>{proposal.clarification && <div className="callout">{proposal.clarification}</div>}{proposal.assumptions.map(item => <p className="proposal-point" key={item}><span>ASSUMPTION</span>{item}</p>)}{proposal.caveats.map(item => <p className="proposal-point" key={item}><span>CAVEAT</span>{item}</p>)}{proposal.findings.map(item => <p className="proposal-finding" key={`${item.severity}-${item.message}`}><strong>{item.severity}</strong>{item.message}<small>{item.evidence}</small></p>)}{proposal.sql !== null && <><span className="eyebrow mt-4">PROPOSED SQL</span><pre className="proposal-sql">{proposal.sql}</pre>{proposal.decision === 'pending' && <>{proposal.baseSql !== sql && <div className="callout callout-error">This proposal is for an earlier SQL draft. Refresh the context before applying it.</div>}<div className="proposal-buttons"><Button variant="secondary" onClick={() => onDecideProposal('rejected')} disabled={busy}>Reject</Button><Button variant="primary" onClick={() => onDecideProposal('accepted')} disabled={busy || proposal.baseSql !== sql}>{beginner ? 'Use this query' : 'Apply to editor'}</Button></div></>}{beginner && proposal.decision === 'accepted' && <div className="beginner-run-ready"><span><span className="status-light is-trusted"/> Added to your SQL draft</span><Button variant="primary" onClick={onRunQuery} disabled={runDisabled || busy}><Icon name="play"/>{busy ? 'Starting…' : 'Run this query'}</Button></div>}</>}</div>}
    </>;
}

export function AssistantWorkflow({ mode, sql, action, onActionChange, question, onQuestionChange, context, proposal, busy, error, trusted, runId, includeResult, onIncludeResult, onVoiceInput, voiceListening, voiceError, onPreview, onRequestProposal, onDecideProposal, onRunQuery, runDisabled, onSave, saveDisabled = false }: AssistantWorkflowProps) {
    const beginner = mode === 'beginner';
    const speechAvailable = Boolean((window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition);
    const output = <AssistantOutput mode={mode} sql={sql} context={context} proposal={proposal} busy={busy} error={error} onRequestProposal={onRequestProposal} onDecideProposal={onDecideProposal} onRunQuery={onRunQuery} runDisabled={runDisabled}/>;
    if (beginner) return <section className="beginner-ai-surface animate-enter" aria-label="Ask AI to write a query">
        <header className="beginner-ai-toolbar"><div className="beginner-ai-product"><span className="beginner-ai-mark"><Icon name="assistant"/></span><div><span className="eyebrow">NATURAL LANGUAGE SQL</span><strong>Ask in plain language</strong></div></div><div className="beginner-ai-toolbar-actions">{onSave && <Button variant="secondary" onClick={onSave} disabled={saveDisabled}>Save draft</Button>}</div></header>
        <div className="beginner-ai-main">
            <div className="beginner-ai-title"><span className="eyebrow beginner-ai-kicker">YOUR DATA, IN YOUR WORDS</span><h1>Ask your<br/><em>data a question.</em></h1><p className="beginner-ai-intro">Type or speak naturally. ClickStudio turns your question into SQL you can review before it runs.</p><div className="beginner-ai-steps"><div><span>01</span><p><strong>Describe</strong><small>Use everyday language</small></p></div><div><span>02</span><p><strong>Review</strong><small>Check the proposed SQL</small></p></div><div><span>03</span><p><strong>Run</strong><small>Only when you choose</small></p></div></div></div>
            <div className="beginner-ai-input-column"><div className="beginner-prompt-composer"><div className="beginner-composer-label"><span>Your question</span><kbd>⌘ ↵ to continue</kbd></div><label className="sr-only" htmlFor="beginner-query-prompt">Describe your data question</label><textarea id="beginner-query-prompt" aria-label="Describe your data question" value={question} onChange={event => onQuestionChange(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); onPreview(); } }} readOnly={voiceListening} placeholder="For example: Show weekly revenue by product for the last 90 days…" rows={4}/><div className="beginner-composer-footer"><div className="beginner-input-tools"><Button variant="ghost" className={cx('voice-button', voiceListening && 'is-listening')} title={speechAvailable ? (voiceListening ? 'Stop dictation' : 'Dictate your question') : 'Voice input is not available in this browser'} aria-label={voiceListening ? 'Stop dictation' : 'Dictate question'} disabled={!speechAvailable} onClick={onVoiceInput}><Icon name="mic"/>{voiceListening ? 'Listening…' : 'Use voice'}</Button><span className="beginner-voice-note">{voiceListening ? 'Speak naturally. Select stop when you’re done.' : 'Voice input may be processed by your browser’s speech service.'}</span></div><Button variant="primary" className="beginner-prepare-button" disabled={!trusted || busy || !question.trim()} onClick={onPreview}>{busy ? 'Preparing…' : context ? 'Refresh context' : 'Create query'}<Icon name="send"/></Button></div></div>
                {voiceError && <div className="callout callout-error beginner-feedback" role="alert">{voiceError}</div>}{!context && !proposal && <div className="beginner-prompt-examples"><span>TRY ASKING</span>{['Compare revenue by month', 'Find the busiest days', 'Show me the top 10 items'].map(example => <button type="button" key={example} onClick={() => onQuestionChange(example)}>{example}<span>↗</span></button>)}</div>}<p className="beginner-safety-note"><Icon name="lock"/> AI suggests. You decide what to run.</p>
            </div>
            {(context || proposal || error) && <div className="beginner-ai-output">{output}</div>}
        </div>
    </section>;
    return <section className="assistant-panel"><div className="assistant-safety"><span className="assistant-glyph"><Icon name="assistant"/></span><div><strong>AI, with you in control.</strong><p>Review context, request a proposal, then decide whether to apply it. Nothing executes automatically.</p></div></div><label className="field-label">ACTION<select className="field-input" value={action} onChange={event => onActionChange(event.target.value as AssistantAction)}><option value="generate">Write a query</option><option value="explain">Explain this SQL</option><option value="repair">Fix a query error</option><option value="review">Review SQL</option><option value="performance">Analyze performance</option><option value="result">Explain the result</option></select></label><label className="field-label">WHAT WOULD YOU LIKE TO KNOW?<textarea className="field-textarea" value={question} onChange={event => onQuestionChange(event.target.value)} placeholder="Describe the question, error, or improvement you want…" rows={4}/></label><label className="include-result"><input type="checkbox" checked={includeResult} onChange={event => onIncludeResult(event.target.checked)} disabled={!runId}/><span><strong>Include selected retained result</strong><small>Rows may contain sensitive data. Inspect before sharing.</small></span></label>{voiceError && <div className="callout callout-error" role="alert">{voiceError}</div>}<div className="assistant-actions"><Button variant="secondary" className="w-full" disabled={!trusted || busy} onClick={onPreview}>{busy && !context ? 'Preparing context…' : context ? 'Refresh context preview' : 'Preview what will be shared'}</Button>{output}</div></section>;
}
