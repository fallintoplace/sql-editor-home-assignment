import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AssistantAction, AssistantEvaluationReport, Proposal, Run } from '../../shared/types';
import { api, message, post } from '../api';
import type { Copy } from '../i18n';
import { Action, Callout, Select, TextAreaField } from '../ui';
import { VoiceSession } from './VoiceSession';
interface ContextView {
    id: string;
    connectionId: string;
    baseSql: string;
    summary: string[];
    expiresAt: string;
    payload: {
        instructions: string;
        question: string;
        context: string;
        image?: string;
    };
}
export function AssistantPanel({ connectionId, sql, run, trusted, copy, onApply }: {
    connectionId: string;
    sql: string;
    run?: Run;
    trusted: boolean;
    copy: Copy;
    onApply: (sql: string) => void;
}) {
    const [action, setAction] = useState<AssistantAction>('generate'), [question, setQuestion] = useState(''), [image, setImage] = useState<string>(), [includeResult, setIncludeResult] = useState(false), [rules, setRules] = useState('Read-only ClickHouse SQL. State assumptions and preserve evidence.'), [context, setContext] = useState<ContextView>(), [proposal, setProposal] = useState<Proposal>(), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const file = useRef<HTMLInputElement>(null);
    const status = useQuery({ queryKey: ['assistant-status'], queryFn: () => api<{
            available: boolean;
            model: string;
            reason?: string;
            callsRemaining: number;
        }>('/assistant/status'), retry: false });
    const evaluation = useQuery({ queryKey: ['assistant-evaluation'], queryFn: () => api<AssistantEvaluationReport>('/assistant/evaluation'), retry: false });
    const perform = async (task: () => Promise<void>) => { if (busy)
        return; setBusy(true); setError(''); try {
        await task();
    }
    catch (e) {
        setError(message(e));
    }
    finally {
        setBusy(false);
    } };
    const prepare = () => perform(async () => { setContext(await post<ContextView>('/assistant/context', { connectionId, sql, action, question, runId: run?.id, includeResult, rules, image })); setProposal(undefined); });
    const send = () => perform(async () => { if (!context)
        return; setProposal(await post<Proposal>('/assistant/proposals', { contextId: context.id, consent: true })); setImage(undefined); await Promise.all([status.refetch(), evaluation.refetch()]); });
    const decide = (decision: 'accepted' | 'rejected') => perform(async () => { if (!proposal)
        return; const reviewed = await post<Proposal>(`/assistant/proposals/${proposal.id}/decision`, { decision, connectionId, currentSql: sql }); setProposal(reviewed); await evaluation.refetch(); if (decision === 'accepted' && reviewed.sql !== null)
        onApply(reviewed.sql); });
    const percent = (value: number | null) => value === null ? '—' : `${value}%`;
    return <div className="stack"><h2>Ask Data / SQL copilot</h2><Callout>Inspect → propose → apply to draft. Execution is always a separate Run action.</Callout>
 {status.data && !status.data.available && <Callout>{status.data.reason}</Callout>}{status.error && <Callout danger>{message(status.error)}</Callout>}
 {evaluation.data && <details className="quality-card"><summary><span>{copy.evaluation.title}</span><span className={`quality-pill ${evaluation.data.qualityPassRate === 100 ? 'pass' : 'warn'}`}>{percent(evaluation.data.averageScore)} score</span></summary><p className="muted">{copy.evaluation.description}</p><div className="quality-metrics"><div><small>{copy.evaluation.proposals}</small><strong>{evaluation.data.total}</strong><span>{evaluation.data.accepted} {copy.evaluation.acceptance.toLowerCase()} · {evaluation.data.pending} {copy.evaluation.pending}</span></div><div><small>{copy.evaluation.quality}</small><strong>{percent(evaluation.data.qualityPassRate)}</strong><span>{evaluation.data.evaluated} evaluated</span></div><div><small>{copy.evaluation.safety}</small><strong>{percent(evaluation.data.safetyPassRate)}</strong><span>{copy.evaluation.semantics}: {percent(evaluation.data.semanticPassRate)}</span></div><div><small>{copy.evaluation.benchmark}</small><strong>{evaluation.data.benchmark.passed}/{evaluation.data.benchmark.total}</strong><span>{evaluation.data.benchmark.score}/100 · static</span></div></div><p className="muted">{copy.evaluation.staticNotice}</p><Action onClick={() => void evaluation.refetch()}>{copy.evaluation.refresh}</Action></details>}
 <Select label="Action / playbook" value={action} options={['generate', 'explain', 'repair', 'result', 'performance', 'review'].map(value => ({ value, label: value === 'generate' ? 'Ask Data: propose SQL' : value === 'review' ? 'Review only (no SQL edits)' : value }))} onSelect={value => { setAction(value as AssistantAction); setContext(undefined); }}/>
 <TextAreaField label="Question or instruction" rows={4} value={question} onChange={setQuestion} placeholder="Show daily events and explain the time window…"/>
 <details className="assistant-context-controls"><summary>Context, image, and voice</summary><Select label="Result context" value={includeResult ? 'include' : 'schema'} options={[{ value: 'schema', label: 'Schema, current SQL and selected error only' }, { value: 'include', label: 'Also share the selected retained result', disabled: run?.resultState !== 'reopenable' }]} onSelect={value => setIncludeResult(value === 'include')}/>
 <details><summary>Workspace rules</summary><TextAreaField label="Scoped rules included in context" value={rules} onChange={setRules}/><p className="muted">These rules are visible context, not authorization controls.</p></details>
 <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={event => { const f = event.target.files?.[0]; event.target.value = ''; if (!f)
        return; if (f.size > 2000000) {
        setError('Images must be at most 2 MB');
        return;
    } const reader = new FileReader(); reader.onerror = () => setError('The image could not be read'); reader.onload = () => { setImage(String(reader.result)); setContext(undefined); }; reader.readAsDataURL(f); }}/>
 <div className="toolbar"><Action onClick={() => file.current?.click()}>Attach screenshot</Action></div><VoiceSession connectionId={connectionId} sql={sql} run={run} trusted={trusted} copy={copy}/>
 {image && <><img className="image-preview" alt="Image that will be sent only after context approval" src={image}/><Action onClick={() => { setImage(undefined); setContext(undefined); }}>Remove image</Action><p className="muted">Check that this image contains no credentials or unintended personal information.</p></>}
 </details>
 <Action disabled={!trusted || busy} onClick={() => void prepare()}>Preview exact context</Action>
 {context && <><h3>Review before sending</h3>{context.summary.map((line, i) => <p className="muted" key={i}>{line}</p>)}<details><summary>Exact question and analytical context</summary><pre className="code-block">{JSON.stringify({ question: context.payload.question, context: JSON.parse(context.payload.context) }, null, 2)}</pre></details><details><summary>System / playbook instructions</summary><pre className="code-block">{context.payload.instructions}</pre></details><Action type="primary" disabled={busy || !status.data?.available || Boolean(proposal)} onClick={() => void send()}>Approve this context and request proposal</Action><p className="muted">Preview expires {new Date(context.expiresAt).toLocaleTimeString()}. Model: {status.data?.model}. Calls remaining today: {status.data?.callsRemaining}.</p></>}
 {busy && <p role="status">Processing the requested action…</p>}{error && <Callout danger>{error}</Callout>}
 {proposal && <div className="stack"><h3>{proposal.action === 'review' ? 'Review findings' : 'Reviewable proposal'}</h3><p>{proposal.summary}</p>{proposal.clarification && <Callout>{proposal.clarification}</Callout>}
 {proposal.assumptions.length > 0 && <p><strong>Assumptions:</strong> {proposal.assumptions.join(' · ')}</p>}{proposal.caveats.length > 0 && <Callout>{proposal.caveats.join(' · ')}</Callout>}
 {proposal.tables.length > 0 && <p>Referenced tables: {proposal.tables.join(', ')}</p>}
 {proposal.findings.map((finding, i) => <Callout key={i}><strong>{finding.severity}: </strong>{finding.message}<p>{finding.evidence}</p></Callout>)}
 {proposal.quality && <section className={`proposal-quality ${proposal.quality.status}`}><div className="toolbar spread"><h4>Quality gate · {proposal.quality.score}/100</h4><span className={`quality-pill ${proposal.quality.status}`}>{proposal.quality.status}</span></div><ul>{proposal.quality.checks.map(check => <li key={check.id} className={check.status}><strong>{check.id}</strong><span>{check.message}</span></li>)}</ul></section>}
 {proposal.sql !== null && <><div className="diff"><section><h4>Before</h4><pre>{proposal.baseSql}</pre></section><section><h4>Proposed replacement</h4><pre>{proposal.sql}</pre></section></div><Action type="primary" disabled={busy || proposal.decision !== 'pending' || proposal.baseSql !== sql} onClick={() => void decide('accepted')}>Accept into draft — do not run</Action></>}
 <Action disabled={busy || proposal.decision !== 'pending'} onClick={() => void decide('rejected')}>Reject / keep draft</Action><p className="muted">{proposal.decision} · {proposal.promptVersion} · response {proposal.responseId}</p></div>}
 </div>;
}
