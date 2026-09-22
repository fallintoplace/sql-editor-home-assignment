import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { AssistantAction, Connection, Principal, ProfilePipeline, Proposal, QueryProfile, QueryDocument, Result, ResultPage, Run, RunEvent, Schema, Script } from '../shared/types';
import { DEFAULT_LIMITS } from '../shared/types';
import { displayValue, exportCsv, recommendChart, chartNumber } from '../shared/results';
import { formatSql, parameterNames, quoteIdentifier, selectedStatement, splitSql } from '../shared/sql';
import { api, download, message, post } from './api';
import { SqlEditor, type EditorHandle } from './components/SqlEditor';
import { checkpoint, closeDraft, MAX_TABS, newDraft, recover, reopenDraft, type Draft, type WorkspaceState } from './workspace-state';
import { useWorkspacePersistence } from './useWorkspacePersistence';
import { getCopy, localeOptions, themeAppearance, themeOptions, type Copy, type ExperienceLevel, type Locale, type Theme } from './i18n';

type Connected = Connection & { trusted: boolean };
type Session = { principal: Principal | null; requiresLogin: boolean; demo: boolean };
type Inspector = 'schema' | 'history' | 'documents' | 'details' | 'profile' | 'pipeline' | 'assistant';
type ResultsView = 'results' | 'chart' | 'insights';
type BusyAction = 'run' | 'script' | 'save' | 'ai' | '';
type AssistantContext = { id: string; summary: string[] };
type SpeechRecognitionLike = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

const terminal = (run?: Run) => Boolean(run && ['succeeded', 'truncated', 'failed', 'cancelled', 'timed_out', 'interrupted'].includes(run.status));
const stateKey = (connectionId: string) => `clickstudio:workspace:${connectionId}:v1`;
const pref = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    try {
        const value = localStorage.getItem(key);
        return values.includes(value as T) ? value as T : fallback;
    } catch { return fallback; }
};

function cx(...values: Array<string | false | undefined>) { return values.filter(Boolean).join(' '); }

function Icon({ name, className = '' }: { name: string; className?: string }) {
    const paths: Record<string, ReactNode> = {
        schema: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
        history: <><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/></>,
        assistant: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>,
        chart: <><path d="M4 19V5m0 14h17"/><path d="m7 15 4-4 3 2 6-7"/></>,
        details: <><path d="M4 19V5m0 14h16"/><path d="m7 15 3-4 3 2 5-7"/><circle cx="18" cy="6" r="1"/></>,
        pipeline: <><rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="15" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><path d="M9 6.5h3a3 3 0 0 1 3 3V15"/></>,
        documents: <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7m-7 4h7"/></>,
        search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
        settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.6 2.77-.08-.02a1.7 1.7 0 0 0-1.8.72l-.04.07h-3.2l-.03-.08a1.7 1.7 0 0 0-1.54-1.1 1.7 1.7 0 0 0-1.45.75l-.04.07-2.77-1.6.02-.08a1.7 1.7 0 0 0-.72-1.8l-.07-.04v-3.2l.08-.03a1.7 1.7 0 0 0 1.1-1.54 1.7 1.7 0 0 0-.75-1.45l-.07-.04 1.6-2.77.08.02a1.7 1.7 0 0 0 1.8-.72l.04-.07h3.2l.03.08a1.7 1.7 0 0 0 1.54 1.1 1.7 1.7 0 0 0 1.45-.75l.04-.07 2.77 1.6-.02.08a1.7 1.7 0 0 0 .72 1.8l.07.04v3.2l-.08.03a1.7 1.7 0 0 0-.66.74Z"/></>,
        close: <path d="m6 6 12 12M18 6 6 18"/>,
        play: <path d="m8 5 11 7-11 7V5Z"/>,
        chevron: <path d="m8 10 4 4 4-4"/>,
        plus: <path d="M12 5v14M5 12h14"/>,
        lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></>,
        bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>,
        copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
        mic: <><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5v3m-4 0h8"/></>,
        send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    };
    return <svg aria-hidden="true" className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.details}</svg>;
}

function Button({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
    const variants = {
        primary: 'button-primary',
        secondary: 'button-secondary',
        ghost: 'button-ghost',
        danger: 'button-danger',
    };
    return <button {...props} type={type} className={cx('button-base', variants[variant], className)} />;
}

function Status({ run, trusted }: { run?: Run; trusted?: boolean }) {
    if (trusted !== undefined) return <span className={cx('inline-flex items-center gap-2 text-xs', trusted ? 'text-emerald-300' : 'text-amber-300')}><span className={cx('status-light', trusted ? 'is-trusted' : 'is-warning')}/>{trusted ? 'Trusted · read only' : 'Needs review'}</span>;
    const kind = terminal(run) ? run?.status === 'succeeded' ? 'is-trusted' : run?.status === 'truncated' ? 'is-warning' : 'is-error' : 'is-running';
    return <span className="inline-flex items-center gap-2 text-[11px] capitalize text-muted"><span className={cx('status-light', kind)}/>{run?.status ?? 'Ready'}</span>;
}

function SelectControl({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
    return <label className="select-control"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><Icon name="chevron" className="select-chevron"/></label>;
}

function App() {
    const [locale, setLocale] = useState<Locale>(() => pref('cathedral:locale', ['en', 'de', 'es', 'nl', 'zh', 'ru'] as const, 'en'));
    const [theme, setTheme] = useState<Theme>(() => pref('cathedral:theme', ['monokai', 'catppuccin-latte', 'click-dark', 'click-light'] as const, 'monokai'));
    const [experience, setExperience] = useState<ExperienceLevel>(() => pref('cathedral:experience', ['beginner', 'expert'] as const, 'beginner'));
    const [session, setSession] = useState<Session>();
    const [connections, setConnections] = useState<Connected[]>([]);
    const [connectionId, setConnectionId] = useState(() => new URLSearchParams(location.search).get('connection') ?? '');
    const [sessionError, setSessionError] = useState('');
    const [token, setToken] = useState('');
    const [busy, setBusy] = useState(false);
    const [connectionPicker, setConnectionPicker] = useState(false);
    const copy = getCopy(locale);
    const connection = connections.find(item => item.id === connectionId) ?? connections[0];
    const dark = themeAppearance[theme].dark;

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.lang = locale;
        document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeAppearance[theme].chromeColor);
        try {
            localStorage.setItem('cathedral:theme', theme);
            localStorage.setItem('cathedral:locale', locale);
            localStorage.setItem('cathedral:experience', experience);
        } catch { }
    }, [dark, experience, locale, theme]);

    const loadSession = useCallback(async () => {
        const next = await api<Session>('/session');
        setSession(next);
        if (next.principal) {
            const profiles = await api<Connected[]>('/connections');
            setConnections(profiles);
            setConnectionId(current => profiles.some(item => item.id === current) ? current : profiles[0]?.id ?? '');
        }
    }, []);

    useEffect(() => { void loadSession().catch(error => setSessionError(message(error))); }, [loadSession]);

    const login = async () => {
        if (!token || busy) return;
        setBusy(true); setSessionError('');
        try {
            await post('/session', { token });
            setToken('');
            await loadSession();
        } catch (error) { setSessionError(message(error)); }
        finally { setBusy(false); }
    };

    const logout = async () => {
        try { await api('/session', { method: 'DELETE' }); setConnections([]); setSession({ principal: null, requiresLogin: true, demo: false }); }
        catch (error) { setSessionError(message(error)); }
    };

    if (!session) return <main className="auth-screen"><section className="auth-card animate-enter"><Brand/><span className="eyebrow mt-8">PRIVATE WORKSPACE</span><h1>{sessionError ? 'Workspace unavailable' : copy.auth.opening}</h1>{sessionError ? <><p>{sessionError}</p><Button variant="primary" onClick={() => { setSessionError(''); void loadSession().catch(error => setSessionError(message(error))); }}>Try again</Button></> : <div className="splash-status"><span className="loading-orbit"/><p>{copy.auth.opening}</p></div>}</section></main>;
    if (!session.principal) return <main className="auth-screen"><form className="auth-card animate-enter" onSubmit={event => { event.preventDefault(); void login(); }}><Brand/><span className="eyebrow mt-8">Private workspace</span><h1>{copy.auth.title}</h1><p>{copy.auth.description}</p><label className="field-label">{copy.auth.token}<input className="field-input mt-2" type="password" autoComplete="current-password" value={token} onChange={event => setToken(event.target.value)} autoFocus/></label>{sessionError && <div className="callout callout-error">{sessionError}</div>}<Button variant="primary" type="submit" disabled={busy || !token} className="mt-4 w-full">{busy ? copy.auth.opening : copy.auth.open}<span className="button-arrow">↗</span></Button><div className="auth-footnote"><Icon name="lock"/> Credentials are handled by the workspace server.</div></form></main>;

    return <div className="application" data-experience={experience}>
        <header className="topbar">
            <Brand/>
            <div className="topbar-divider"/>
            <div className="connection-wrap">
                <button className="connection-trigger" type="button" aria-expanded={connectionPicker} onClick={() => setConnectionPicker(value => !value)}>
                    <span className="connection-env"><span className="status-light is-trusted"/> LIVE CONNECTION</span>
                    <strong>{connection?.name ?? 'Choose connection'}</strong>
                    <span className="connection-database">{connection?.database ?? '—'} <Icon name="chevron"/></span>
                </button>
                {connectionPicker && <div className="connection-menu animate-enter" role="listbox">{connections.map(item => <button key={item.id} type="button" onClick={() => { setConnectionId(item.id); setConnectionPicker(false); }}><span><strong>{item.name}</strong><small>{item.database} · {item.host}</small></span><Status trusted={item.trusted}/></button>)}</div>}
            </div>
            <div className="topbar-spacer"/>
            <div className="experience-switch" role="group" aria-label="Workspace mode">
                <span className="mode-caption">WORKSPACE</span>
                {(['beginner', 'expert'] as const).map(level => <button type="button" key={level} aria-pressed={experience === level} onClick={() => setExperience(level)} className={experience === level ? 'is-active' : ''}><span className={level === 'expert' ? 'expert-diamond' : 'beginner-dot'}/>{level === 'beginner' ? copy.app.beginner : copy.app.expert}</button>)}
            </div>
            <div className="topbar-divider topbar-divider-short"/>
            <div className="topbar-preferences">
                <SelectControl label={copy.app.language} value={locale} options={localeOptions} onChange={value => setLocale(value as Locale)}/>
                <SelectControl label={copy.app.theme} value={theme} options={themeOptions} onChange={value => setTheme(value as Theme)}/>
            </div>
            <Button variant="ghost" className="account-button" title="Sign out" onClick={() => void logout()}>HV</Button>
        </header>
        {session.demo && <div className="demo-ribbon"><span className="status-light is-warning"/> DEMO DATA · queries are not sent to a live database</div>}
        {connection ? <Workspace key={connection.id} connection={connection} connections={connections} onSelectConnection={setConnectionId} onRefreshConnections={async () => { const latest = await api<Connected[]>('/connections'); setConnections(latest); }} experience={experience} dark={dark} copy={copy} locale={locale}/> : <div className="empty-connection"><Icon name="schema"/><h1>{copy.app.name}</h1><p>No connection profiles are configured for this workspace.</p></div>}
    </div>;
}

function Brand() {
    return <div className="brand-lockup"><span className="brand-name">Click<span>Studio</span><small>CLICKHOUSE WORKSPACE</small></span></div>;
}

function Workspace({ connection, connections, onSelectConnection, onRefreshConnections, experience, dark, copy, locale }: {
    connection: Connected;
    connections: Connected[];
    onSelectConnection: (id: string) => void;
    onRefreshConnections: () => Promise<void>;
    experience: ExperienceLevel;
    dark: boolean;
    copy: Copy;
    locale: Locale;
}) {
    const key = stateKey(connection.id);
    const [workspace, setWorkspace] = useState<WorkspaceState>(() => recover(key));
    const workspaceRef = useRef(workspace);
    workspaceRef.current = workspace;
    const active = workspace.tabs.find(tab => tab.id === workspace.activeId) ?? workspace.tabs[0]!;
    const editor = useRef<EditorHandle>(null);
    const [schema, setSchema] = useState<Schema>();
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [schemaError, setSchemaError] = useState('');
    const [documents, setDocuments] = useState<QueryDocument[]>([]);
    const [history, setHistory] = useState<Run[]>([]);
    const [run, setRun] = useState<Run>();
    const [resultPage, setResultPage] = useState<ResultPage>();
    const [snapshot, setSnapshot] = useState<Result>();
    const [profile, setProfile] = useState<QueryProfile>();
    const [pipeline, setPipeline] = useState<ProfilePipeline>();
    const [script, setScript] = useState<Script>();
    const [page, setPage] = useState(0);
    const [view, setView] = useState<ResultsView>('results');
    const [inspector, setInspector] = useState<Inspector>('schema');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [layout, setLayout] = useState<'write' | 'analyze' | 'performance' | 'ai'>('write');
    const [busy, setBusy] = useState<BusyAction>('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [eventState, setEventState] = useState<'idle' | 'live' | 'reconnecting'>('idle');
    const [search, setSearch] = useState('');
    const [trusting, setTrusting] = useState(false);
    const [assistantAction, setAssistantAction] = useState<AssistantAction>('generate');
    const [assistantQuestion, setAssistantQuestion] = useState('');
    const [assistantContext, setAssistantContext] = useState<AssistantContext>();
    const [assistantProposal, setAssistantProposal] = useState<Proposal>();
    const [assistantBusy, setAssistantBusy] = useState(false);
    const [assistantError, setAssistantError] = useState('');
    const [includeResult, setIncludeResult] = useState(false);
    const [voiceListening, setVoiceListening] = useState(false);
    const [voiceError, setVoiceError] = useState('');
    const recognitionRef = useRef<SpeechRecognitionLike | undefined>(undefined);
    const promptBeforeVoiceRef = useRef('');
    const storageError = useWorkspacePersistence(key, workspace);
    const parameters = useMemo(() => {
        try { return parameterNames(active.sql); } catch { return []; }
    }, [active.sql]);
    const activeRunId = active.activeRunId;
    const running = Boolean(run && !terminal(run));
    const currentConnection = connections.find(item => item.id === connection.id) ?? connection;
    const trusted = currentConnection.trusted;

    useEffect(() => () => recognitionRef.current?.abort(), []);
    useEffect(() => { setDrawerOpen(false); }, [experience]);

    const startVoiceInput = () => {
        if (voiceListening) { recognitionRef.current?.stop(); return; }
        const SpeechRecognition = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
        if (!SpeechRecognition) { setVoiceError('Voice input is not available in this browser. You can type your question instead.'); return; }
        setVoiceError('');
        promptBeforeVoiceRef.current = assistantQuestion.trimEnd();
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = ({ en: 'en-US', de: 'de-DE', es: 'es-ES', nl: 'nl-NL', zh: 'zh-CN', ru: 'ru-RU' } as const)[locale];
        recognition.onresult = event => {
            const transcript = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').replace(/\s+/g, ' ').trim();
            const base = promptBeforeVoiceRef.current;
            setAssistantQuestion(`${base}${base && transcript ? ' ' : ''}${transcript}`);
            setAssistantContext(undefined);
            setAssistantProposal(undefined);
        };
        recognition.onerror = event => {
            setVoiceError(event.error === 'not-allowed' ? 'Microphone access was denied. Allow access or type your question instead.' : `Voice input stopped (${event.error}). You can continue by typing.`);
            setVoiceListening(false);
        };
        recognition.onend = () => setVoiceListening(false);
        recognitionRef.current = recognition;
        try { recognition.start(); setVoiceListening(true); }
        catch { setVoiceError('Voice input could not start. Check microphone access or type your question instead.'); setVoiceListening(false); }
    };

    const prepareAssistantContext = async (action = assistantAction, question = assistantQuestion) => {
        if (!trusted) return;
        if (!question.trim() && action === 'generate') { setAssistantError('Describe what you want to learn from your data first.'); return; }
        setAssistantBusy(true); setAssistantError(''); setAssistantAction(action);
        try {
            const result = await post<AssistantContext>('/assistant/context', { connectionId: connection.id, action, question, sql: active.sql, runId: activeRunId, includeResult });
            setAssistantContext(result); setAssistantProposal(undefined);
        } catch (caught) { setAssistantError(message(caught)); }
        finally { setAssistantBusy(false); }
    };

    const requestAssistantProposal = async () => {
        if (!assistantContext || assistantBusy) return;
        if (!window.confirm(`Send the reviewed SQL and selected context to the configured AI provider? ${assistantContext.summary.join(' ')}`)) return;
        setAssistantBusy(true); setAssistantError('');
        try { setAssistantProposal(await post<Proposal>('/assistant/proposals', { contextId: assistantContext.id, consent: true })); }
        catch (caught) { setAssistantError(message(caught)); }
        finally { setAssistantBusy(false); }
    };

    const decideAssistantProposal = async (decision: 'accepted' | 'rejected') => {
        if (!assistantProposal) return;
        setAssistantBusy(true); setAssistantError('');
        try {
            const reviewed = await post<Proposal>(`/assistant/proposals/${encodeURIComponent(assistantProposal.id)}/decision`, { decision, connectionId: connection.id, currentSql: active.sql });
            setAssistantProposal(reviewed);
            if (decision === 'accepted' && reviewed.sql !== null) patch({ ...checkpoint(active, 'Before accepted AI proposal'), sql: reviewed.sql, from: 0, to: 0 });
        } catch (caught) { setAssistantError(message(caught)); }
        finally { setAssistantBusy(false); }
    };

    const changeAssistantQuestion = (question: string) => {
        setAssistantQuestion(question); setAssistantContext(undefined); setAssistantProposal(undefined); setAssistantError('');
    };

    const update = useCallback((id: string, change: (draft: Draft) => Draft) => {
        setWorkspace(current => ({ ...current, tabs: current.tabs.map(draft => draft.id === id ? change(draft) : draft) }));
    }, []);
    const patch = useCallback((values: Partial<Draft>) => update(active.id, draft => ({ ...draft, ...values })), [active.id, update]);

    const loadHistory = useCallback(async () => {
        setHistory(await api<Run[]>(`/runs?connectionId=${encodeURIComponent(connection.id)}`));
    }, [connection.id]);
    const loadDocuments = useCallback(async () => {
        setDocuments(await api<QueryDocument[]>(`/documents?trash=true&connectionId=${encodeURIComponent(connection.id)}`));
    }, [connection.id]);
    const loadSchema = useCallback(async () => {
        if (!trusted) { setSchema(undefined); return; }
        setSchemaLoading(true); setSchemaError('');
        try { setSchema(await api<Schema>(`/connections/${encodeURIComponent(connection.id)}/schema`)); }
        catch (caught) { setSchemaError(message(caught)); }
        finally { setSchemaLoading(false); }
    }, [connection.id, trusted]);

    useEffect(() => {
        void Promise.all([loadHistory(), loadDocuments()]).catch(caught => setError(message(caught)));
        if (trusted) void loadSchema();
        const interval = window.setInterval(() => { void loadHistory().catch(() => undefined); }, 15000);
        return () => window.clearInterval(interval);
    }, [loadDocuments, loadHistory, loadSchema, trusted]);

    useEffect(() => {
        if (!activeRunId) { setRun(undefined); setResultPage(undefined); setSnapshot(undefined); setProfile(undefined); setPipeline(undefined); return; }
        let cancelled = false;
        void api<Run>(`/runs/${encodeURIComponent(activeRunId)}`).then(next => {
            if (cancelled || next.connectionId !== connection.id) return;
            setRun(next);
            setPage(0);
            if (terminal(next)) void loadHistory().catch(() => undefined);
        }).catch(caught => { if (!cancelled) setError(message(caught)); });
        return () => { cancelled = true; };
    }, [activeRunId, connection.id, loadHistory]);

    useEffect(() => {
        if (!activeRunId || !run || !terminal(run) || run.resultState !== 'reopenable') { setResultPage(undefined); return; }
        let cancelled = false;
        void api<ResultPage>(`/runs/${encodeURIComponent(activeRunId)}/result?offset=${page * 200}&count=200`).then(next => { if (!cancelled) setResultPage(next); }).catch(caught => { if (!cancelled) setError(message(caught)); });
        return () => { cancelled = true; };
    }, [activeRunId, page, run]);

    useEffect(() => {
        if (!activeRunId || !run || terminal(run)) { setEventState('idle'); return; }
        setEventState('reconnecting');
        const stream = new EventSource(`/api/runs/${encodeURIComponent(activeRunId)}/events`);
        stream.onopen = () => setEventState('live');
        stream.onmessage = event => {
            try {
                const payload = JSON.parse(event.data) as RunEvent;
                if (payload.run.id !== activeRunId || payload.run.connectionId !== connection.id) return;
                setRun(current => !current || current.sequence <= payload.sequence ? payload.run : current);
                if (terminal(payload.run)) {
                    stream.close(); setEventState('idle');
                    void loadHistory().catch(() => undefined);
                }
            } catch { setEventState('reconnecting'); }
        };
        stream.onerror = () => setEventState('reconnecting');
        return () => stream.close();
    }, [activeRunId, connection.id, loadHistory, run?.status]);

    useEffect(() => {
        if (!running || eventState === 'live' || !activeRunId) return;
        let closed = false;
        const timer = window.setInterval(() => {
            void api<Run>(`/runs/${encodeURIComponent(activeRunId)}`).then(next => {
                if (closed || next.connectionId !== connection.id) return;
                setRun(current => !current || current.sequence <= next.sequence ? next : current);
                if (terminal(next)) void loadHistory().catch(() => undefined);
            }).catch(() => undefined);
        }, 1500);
        return () => { closed = true; window.clearInterval(timer); };
    }, [activeRunId, connection.id, eventState, loadHistory, running]);

    useEffect(() => {
        if (!script?.id || script.status !== 'running') return;
        let closed = false;
        const timer = window.setInterval(() => {
            void api<Script>(`/scripts/${encodeURIComponent(script.id)}`).then(next => {
                if (closed) return;
                setScript(next);
                const latest = [...next.statements].reverse().find(item => item.runId);
                if (latest?.runId) {
                    update(active.id, draft => ({ ...draft, activeRunId: latest.runId, runIds: [...new Set([...draft.runIds, latest.runId!])] }));
                }
                if (next.status !== 'running') void loadHistory().catch(() => undefined);
            }).catch(caught => { if (!closed) setError(message(caught)); });
        }, 900);
        return () => { closed = true; window.clearInterval(timer); };
    }, [active.id, loadHistory, script?.id, script?.status, update]);

    const perform = async (task: () => Promise<void>, kind: BusyAction = 'save') => {
        if (busy) return;
        setBusy(kind); setError(''); setNotice('');
        try { await task(); }
        catch (caught) { setError(message(caught)); }
        finally { setBusy(''); }
    };

    const addDraft = (draft: Draft) => {
        if (workspaceRef.current.tabs.length >= MAX_TABS) { setError(`Close a tab before creating another. This workspace supports ${MAX_TABS} open drafts.`); return; }
        setWorkspace(current => ({ ...current, tabs: [...current.tabs, draft], activeId: draft.id }));
    };

    const execute = (wholeScript = false, kind: 'query' | 'explain' | 'pipeline' = 'query') => perform(async () => {
        if (!trusted) throw new Error('Review and trust this read only connection before running SQL.');
        const selected = editor.current?.selection() ?? { from: active.from, to: active.to };
        const statement = wholeScript ? undefined : selectedStatement(active.sql, selected.from, selected.to);
        if (!wholeScript && !statement) throw new Error('Write or select a SQL statement before running it.');
        const payload = {
            clientRequestId: crypto.randomUUID(), connectionId: connection.id, documentId: active.serverId,
            sql: wholeScript ? active.sql : statement!.sql, parameters: active.parameters,
            parentRunId: active.parentRunId, kind, limits: { rows: connection.limits.rows || DEFAULT_LIMITS.rows, seconds: connection.limits.seconds || DEFAULT_LIMITS.seconds },
            tags: { workspace: 'clickstudio', experience },
            ...(wholeScript ? {} : { sourceFrom: statement!.from, sourceTo: statement!.to }),
        };
        if (wholeScript) {
            const created = await post<Script>('/scripts', { ...payload, stopOnError: true });
            setScript(created);
            const first = created.statements.find(item => item.runId);
            if (first?.runId) patch({ activeRunId: first.runId, scriptId: created.id, runIds: [...active.runIds, first.runId] });
            else patch({ scriptId: created.id });
            setView('results');
        } else {
            const created = await post<Run>('/runs', payload);
            setRun(created);
            setResultPage(undefined); setSnapshot(undefined); setProfile(undefined); setPipeline(undefined); setPage(0); setView('results');
            patch({ activeRunId: created.id, scriptId: undefined, runIds: [...new Set([...active.runIds, created.id])] });
            editor.current?.focus();
        }
        setDrawerOpen(false);
        setNotice(wholeScript ? 'Script started. Each statement has its own run evidence.' : 'Query submitted to the selected ClickHouse connection.');
        void loadHistory().catch(() => undefined);
    }, wholeScript ? 'script' : 'run');

    const cancel = () => perform(async () => {
        if (script?.status === 'running') { setScript(await post<Script>(`/scripts/${encodeURIComponent(script.id)}/cancel`)); return; }
        if (!run || terminal(run)) return;
        setRun(await post<Run>(`/runs/${encodeURIComponent(run.id)}/cancel`));
        setNotice('Cancellation requested. The server will confirm the final state.');
    }, 'run');

    const openRun = (selected: Run) => {
        if (selected.connectionId !== connection.id) { onSelectConnection(selected.connectionId); return; }
        const draft = newDraft(`${selected.kind === 'query' ? 'Query' : selected.kind.toUpperCase()} ${new Date(selected.createdAt).toLocaleTimeString()}.sql`, selected.sql);
        draft.parameters = selected.parameters;
        draft.activeRunId = selected.id;
        draft.runIds = [selected.id];
        setWorkspace(current => ({ ...current, tabs: [...current.tabs, draft].slice(-MAX_TABS), activeId: draft.id }));
        setView('results'); setDrawerOpen(false); setNotice(`Opened retained run ${selected.queryId}. No query was rerun.`);
    };

    const saveDraft = async () => perform(async () => {
        const payload = { name: active.name, sql: active.sql, connectionId: connection.id, baseRevision: active.baseRevision, parameters: active.parameters, chart: active.chart, runId: active.activeRunId, parentDocumentId: active.parentDocumentId, kind: active.kind, metric: active.metric, dependencies: active.dependencies };
        const saved = await api<QueryDocument>(active.serverId ? `/documents/${encodeURIComponent(active.serverId)}` : '/documents', { method: active.serverId ? 'PUT' : 'POST', body: payload });
        patch({ serverId: saved.id, baseRevision: saved.revision });
        setDocuments(current => [saved, ...current.filter(document => document.id !== saved.id)]);
        setNotice(`Saved ${saved.name} · revision ${saved.revision}`);
    }, 'save');

    const loadSnapshot = async () => {
        if (!activeRunId || snapshot || !run || run.resultState !== 'reopenable') return;
        const full = await api<Result>(`/runs/${encodeURIComponent(activeRunId)}/snapshot`);
        setSnapshot(full);
        const suggestion = recommendChart(full.columns, full.rows);
        if (active.chart.kind === 'table' && suggestion.config.kind !== 'table') patch({ chart: suggestion.config });
    };

    const loadProfile = async () => {
        if (!activeRunId) return;
        const response = await api<QueryProfile>(`/runs/${encodeURIComponent(activeRunId)}/profile`);
        setProfile(response);
    };

    const loadPipeline = async () => {
        if (!activeRunId) return;
        if (!profile) await loadProfile();
        const response = await api<ProfilePipeline>(`/runs/${encodeURIComponent(activeRunId)}/profile/pipeline`);
        setPipeline(response);
    };

    const showInspector = (next: Inspector) => {
        setInspector(next);
        if (experience === 'beginner') setDrawerOpen(true);
        if (next === 'profile') void perform(loadProfile, 'save');
        if (next === 'pipeline') void perform(loadPipeline, 'save');
    };

    const trustConnection = () => perform(async () => {
        if (!trusted && !window.confirm(`Review connection ${connection.name} at ${connection.host}, database ${connection.database}, identity ${connection.username}. Trust its read only access?`)) return;
        setTrusting(true);
        try {
            await post(`/connections/${encodeURIComponent(connection.id)}/trust`, { trusted: !trusted, confirmation: connection.id });
            await onRefreshConnections();
            setNotice(trusted ? 'Connection trust revoked.' : 'Connection trusted. Schema access is ready.');
        } finally { setTrusting(false); }
    }, 'save');

    const sortedHistory = useMemo(() => [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [history]);
    const filteredTables = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return schema?.tables ?? [];
        return (schema?.tables ?? []).filter(table => `${table.database}.${table.name} ${table.engine}`.toLowerCase().includes(q) || schema?.columns.some(column => column.database === table.database && column.table === table.name && `${column.name} ${column.type}`.toLowerCase().includes(q)));
    }, [schema, search]);
    const selectedLayout = (next: typeof layout) => {
        setLayout(next);
        if (next === 'write') setInspector('schema');
        else if (next === 'analyze') { setInspector('details'); setView('results'); }
        else if (next === 'performance') { setInspector('profile'); void perform(loadProfile, 'save'); }
        else { setInspector('assistant'); }
    };

    return <div className={cx('workspace-root', experience === 'expert' && 'is-expert')}>
        <section className="connection-strip">
            <div className="connection-summary"><span className="connection-icon"><Icon name="bolt"/></span><div><span className="eyebrow">ACTIVE TARGET</span><strong>{connection.name}<span className="slash">/</span>{connection.database}</strong><small>{connection.host} · ClickHouse {connection.manifest?.serverVersion ?? 'version unknown'}</small></div></div>
            <div className="connection-status"><Status trusted={trusted}/><span className="connection-readonly"><Icon name="lock"/> READ ONLY</span><Button variant={trusted ? 'ghost' : 'primary'} disabled={Boolean(busy) || trusting} onClick={() => void trustConnection()}>{trusting ? 'Updating…' : trusted ? 'Revoke trust' : 'Review & trust'}</Button></div>
        </section>
        {!trusted && <div className="trust-callout animate-enter"><span className="trust-callout-icon"><Icon name="lock"/></span><span><strong>This connection needs your review.</strong><small>Check the host, database, and identity above before allowing schema access or query execution.</small></span><Button variant="primary" onClick={() => void trustConnection()}>Review connection <span>↗</span></Button></div>}
        {error && <div className="toast toast-error animate-enter" role="alert"><span>!</span>{error}<button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close"/></button></div>}
        {notice && <div className="toast toast-success animate-enter" role="status"><span>✓</span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><Icon name="close"/></button></div>}
        {storageError && <div className="toast toast-error" role="alert">Local draft storage could not save changes: {storageError}</div>}

        <div className="workspace-layout">
            <aside className="icon-rail" aria-label="Workspace tools">
                <span className="rail-separator"/>
                <RailButton icon="schema" label={copy.common.schema} active={inspector === 'schema' && drawerOpen} onClick={() => showInspector('schema')}/>
                <RailButton icon="history" label={copy.common.history} active={inspector === 'history' && drawerOpen} onClick={() => showInspector('history')}/>
                <RailButton icon="documents" label="Documents" active={inspector === 'documents' && drawerOpen} onClick={() => showInspector('documents')}/>
                <span className="rail-spacer"/>
                <RailButton icon="assistant" label={copy.common.assistant} accent active={experience === 'expert' && inspector === 'assistant'} onClick={() => experience === 'beginner' ? document.getElementById('beginner-query-prompt')?.focus() : showInspector('assistant')}/>
                {experience === 'expert' && <><RailButton icon="details" label="Run details" active={inspector === 'details'} onClick={() => showInspector('details')}/><RailButton icon="pipeline" label="Pipeline" active={inspector === 'pipeline'} onClick={() => showInspector('pipeline')}/></>}
                <span className="rail-separator"/>
                <button className="rail-icon-button rail-icon-muted" type="button" title="Export local drafts" onClick={() => download('clickstudio-local-drafts.json', workspace)}><Icon name="settings"/></button>
            </aside>

            <main className="workbench-main">
                <div className="document-tabs" role="tablist" aria-label="SQL documents">
                    {workspace.tabs.map(draft => <div key={draft.id} className={cx('document-tab', draft.id === active.id && 'is-active')} role="tab" aria-selected={draft.id === active.id} tabIndex={draft.id === active.id ? 0 : -1} onClick={() => setWorkspace(current => ({ ...current, activeId: draft.id }))} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setWorkspace(current => ({ ...current, activeId: draft.id })); }}>
                        <span className="tab-file-dot"/><span className="document-tab-name">{draft.name}</span>{draft.serverId ? <span className="tab-revision">r{draft.baseRevision}</span> : <span className="tab-unsaved"/>}<button type="button" aria-label={`Close ${draft.name}`} onClick={event => { event.stopPropagation(); setWorkspace(current => closeDraft(current, draft.id)); }}>×</button>
                    </div>)}
                    <button className="new-tab-button" type="button" title="New SQL tab" onClick={() => addDraft(newDraft())}><Icon name="plus"/></button>
                    <div className="tabs-spacer"/>
                    {experience === 'expert' && <div className="layout-presets" role="group" aria-label="Workspace layouts">{(['write', 'analyze', 'performance', 'ai'] as const).map(item => <button key={item} type="button" aria-pressed={layout === item} onClick={() => selectedLayout(item)}>{item === 'write' ? 'Write' : item === 'analyze' ? 'Analyze' : item === 'performance' ? 'Performance' : 'AI'}</button>)}</div>}
                    <span className="draft-status"><span className="status-light is-trusted"/>Local draft</span>
                </div>

                <div className={cx('workspace-content', experience === 'beginner' && 'beginner-workspace-content', experience === 'beginner' && run && 'has-run')}>
                    {experience === 'beginner' ? <AssistantWorkflow mode="beginner" sql={active.sql} action={assistantAction} onActionChange={value => { setAssistantAction(value); setAssistantContext(undefined); setAssistantProposal(undefined); }} question={assistantQuestion} onQuestionChange={changeAssistantQuestion} context={assistantContext} proposal={assistantProposal} busy={assistantBusy} error={assistantError} trusted={trusted} runId={run?.id} includeResult={includeResult} onIncludeResult={setIncludeResult} onVoiceInput={startVoiceInput} voiceListening={voiceListening} voiceError={voiceError} onPreview={() => void prepareAssistantContext('generate', assistantQuestion)} onRequestProposal={() => void requestAssistantProposal()} onDecideProposal={decision => void decideAssistantProposal(decision)} onRunQuery={() => void execute()} runDisabled={!trusted || Boolean(busy)} onSave={() => void saveDraft()} saveDisabled={Boolean(busy)}/> : <section className="editor-surface">
                        <div className="editor-heading">
                            <div className="editor-file-heading"><span className="file-type-icon">SQL</span><label className="document-name"><span className="eyebrow">QUERY</span><input aria-label="SQL document name" value={active.name} onChange={event => patch({ name: event.target.value })}/></label><span className="edit-indicator" title={active.serverId ? `Saved revision ${active.baseRevision}` : 'Only in this browser'}>{active.serverId ? `REV ${active.baseRevision}` : 'LOCAL'}</span></div>
                            <div className="editor-heading-actions"><Button variant="ghost" className="icon-only" title="Format SQL" onClick={() => patch({ sql: formatSql(active.sql) })}>⌘</Button><Button variant="secondary" onClick={() => void saveDraft()} disabled={Boolean(busy)}><Icon name="documents"/> {copy.common.save}</Button></div>
                        </div>
                        <div className="editor-toolbar">
                            <div className="editor-mode-label"><span className="editor-language-dot"/>ClickHouse SQL<span className="toolbar-divider"/><span>{splitSql(active.sql).length || 0} statement{splitSql(active.sql).length === 1 ? '' : 's'}</span></div>
                            <div className="editor-actions">
                                {experience === 'expert' && <><Button variant="ghost" className="toolbar-small" onClick={() => void execute(false, 'explain')} disabled={!trusted || Boolean(busy) || !connection.manifest?.explain.available} title={connection.manifest?.explain.reason}>EXPLAIN</Button><Button variant="ghost" className="toolbar-small" onClick={() => void execute(false, 'pipeline')} disabled={!trusted || Boolean(busy) || !connection.manifest?.pipeline.available} title={connection.manifest?.pipeline.reason}>PIPELINE</Button><Button variant="ghost" className="toolbar-small" onClick={() => void execute(true)} disabled={!trusted || Boolean(busy) || !connection.manifest?.scripts.available} title={connection.manifest?.scripts.reason}>Run script</Button></>}
                                <Button variant="primary" className="run-query-button" onClick={() => void execute()} disabled={!trusted || Boolean(busy)}><Icon name="play"/>{busy === 'run' ? 'Running…' : copy.common.run}<kbd>⌘ ↵</kbd></Button>
                            </div>
                        </div>
                        <div className="editor-frame"><SqlEditor key={active.id} ref={editor} value={active.sql} from={active.from} to={active.to} schema={schema} dark={dark} error={run?.error && (run.sql === active.sql || run.sql === selectedStatement(active.sql, active.from, active.to)?.sql) ? run.error : undefined} onChange={sql => patch({ sql })} onSelection={(from, to) => patch({ from, to })} onRun={wholeScript => void execute(wholeScript)}/></div>
                        {parameters.length > 0 && <div className="parameters-row"><div className="parameters-label"><span>INPUTS</span><strong>Query parameters</strong><small>Values are bound separately from the SQL text.</small></div>{parameters.map(parameter => <label className="parameter-field" key={parameter.name}><span>{parameter.name}<code>:{parameter.type}</code></span><input value={active.parameters[parameter.name] ?? ''} placeholder="Enter value" onChange={event => patch({ parameters: { ...active.parameters, [parameter.name]: event.target.value } })}/></label>)}<span className="parameter-count">{parameters.filter(parameter => Boolean(active.parameters[parameter.name]?.trim())).length} / {parameters.length} ready</span></div>}
                        <div className="editor-footer"><span><span className="key-hint">⌘↵</span> Run current statement <span className="footer-dot">·</span> <span className="key-hint">⌘⇧↵</span> Run script</span><span>{active.sql.length.toLocaleString()} characters <span className="footer-dot">·</span> {active.sql.split('\n').length} lines</span></div>
                    </section>}

                    {(experience === 'expert' || run) && <section className={cx('results-surface', experience === 'expert' && 'results-expert')}>
                        <div className="results-header">
                            <div className="results-title"><span className="results-mark"><Icon name="chart"/></span><div><span className="eyebrow">WORKSPACE OUTPUT</span><h2>{copy.common.results}</h2></div>{run && <Status run={run}/>}</div>
                            <div className="results-actions">
                                <div className="results-tabs" role="tablist" aria-label="Result views">{(['results', 'chart', 'insights'] as const).map(tab => <button key={tab} role="tab" aria-selected={view === tab} type="button" onClick={() => { setView(tab); if (tab === 'chart') void perform(loadSnapshot, 'save'); if (tab === 'insights') void perform(loadProfile, 'save'); }}>{tab === 'results' ? copy.common.results : tab === 'chart' ? copy.common.chart : copy.common.insights}{tab === 'chart' && snapshot && <span className="suggested-dot"/>}</button>)}</div>
                                {run?.resultState === 'reopenable' && <Button variant="ghost" className="toolbar-small" onClick={() => { const link = document.createElement('a'); link.href = `/api/runs/${encodeURIComponent(run.id)}/export?format=csv`; link.download = `${run.queryId}.csv`; link.click(); }}>Export <Icon name="chevron"/></Button>}
                            </div>
                        </div>
                        {!run && experience === 'expert' && <EmptyWorkspace onRun={() => editor.current?.focus()} beginner={false}/>}
                        {!run && experience === 'beginner' && <div className="beginner-results-empty"><span className="beginner-results-orb"><Icon name="chart"/></span><span className="eyebrow">YOUR RESULTS</span><strong>They’ll appear here.</strong><p>Create a query with AI, review it, then run it when you’re ready.</p></div>}
                        {run && view === 'results' && <ResultGrid run={run} page={resultPage} pageIndex={page} loading={!resultPage && run.resultState === 'reopenable'} onPage={setPage}/>}
                        {run && view === 'chart' && <ChartView result={snapshot} loading={!snapshot && run.resultState === 'reopenable'} chart={active.chart} onChart={chart => patch({ chart })}/>}
                        {run && view === 'insights' && <InsightsView run={run} profile={profile} onLoad={() => void perform(loadProfile, 'save')} loading={busy === 'save'}/>}
                    </section>}
                </div>
            </main>

            {experience === 'expert' && <InspectorPane inspector={inspector} setInspector={showInspector} connection={connection} schema={schema} schemaLoading={schemaLoading} schemaError={schemaError} search={search} setSearch={setSearch} tables={filteredTables} history={sortedHistory} documents={documents} run={run} profile={profile} pipeline={pipeline} onRefreshSchema={() => void loadSchema()} onInsert={value => editor.current?.insert(value)} onOpenRun={openRun} onOpenDocument={document => { const draft = newDraft(document.name, document.sql); Object.assign(draft, { serverId: document.id, baseRevision: document.revision, parameters: document.parameters, chart: document.chart, activeRunId: document.runId }); addDraft(draft); }} onLoadProfile={() => void perform(loadProfile, 'save')} onLoadPipeline={() => void perform(loadPipeline, 'save')} connectionId={connection.id} sql={active.sql} trusted={trusted} runId={run?.id} onRefreshDocuments={() => void loadDocuments()} assistantAction={assistantAction} onAssistantAction={value => { setAssistantAction(value); setAssistantContext(undefined); setAssistantProposal(undefined); }} assistantQuestion={assistantQuestion} onAssistantQuestion={changeAssistantQuestion} assistantContext={assistantContext} assistantProposal={assistantProposal} assistantBusy={assistantBusy} assistantError={assistantError} includeResult={includeResult} onIncludeResult={setIncludeResult} onVoiceInput={startVoiceInput} voiceListening={voiceListening} voiceError={voiceError} onPreview={() => void prepareAssistantContext()} onRequestProposal={() => void requestAssistantProposal()} onDecideProposal={decision => void decideAssistantProposal(decision)} onRunQuery={() => void execute()} runDisabled={!trusted || Boolean(busy)}/>}
            {experience === 'beginner' && drawerOpen && <><button className="drawer-backdrop" type="button" aria-label="Close panel" onClick={() => setDrawerOpen(false)}/><InspectorPane drawer inspector={inspector} setInspector={showInspector} onClose={() => setDrawerOpen(false)} connection={connection} schema={schema} schemaLoading={schemaLoading} schemaError={schemaError} search={search} setSearch={setSearch} tables={filteredTables} history={sortedHistory} documents={documents} run={run} profile={profile} pipeline={pipeline} onRefreshSchema={() => void loadSchema()} onInsert={value => { editor.current?.insert(value); setDrawerOpen(false); }} onOpenRun={openRun} onOpenDocument={document => { const draft = newDraft(document.name, document.sql); Object.assign(draft, { serverId: document.id, baseRevision: document.revision, parameters: document.parameters, chart: document.chart, activeRunId: document.runId }); addDraft(draft); setDrawerOpen(false); }} onLoadProfile={() => void perform(loadProfile, 'save')} onLoadPipeline={() => void perform(loadPipeline, 'save')} connectionId={connection.id} sql={active.sql} trusted={trusted} runId={run?.id} onRefreshDocuments={() => void loadDocuments()} assistantAction={assistantAction} onAssistantAction={value => { setAssistantAction(value); setAssistantContext(undefined); setAssistantProposal(undefined); }} assistantQuestion={assistantQuestion} onAssistantQuestion={changeAssistantQuestion} assistantContext={assistantContext} assistantProposal={assistantProposal} assistantBusy={assistantBusy} assistantError={assistantError} includeResult={includeResult} onIncludeResult={setIncludeResult} onVoiceInput={startVoiceInput} voiceListening={voiceListening} voiceError={voiceError} onPreview={() => void prepareAssistantContext()} onRequestProposal={() => void requestAssistantProposal()} onDecideProposal={decision => void decideAssistantProposal(decision)} onRunQuery={() => void execute()} runDisabled={!trusted || Boolean(busy)}/> </>}
        </div>
        {run && <ExecutionBar run={run} eventState={eventState} onCancel={() => void cancel()} busy={Boolean(busy)}/>}
    </div>;
}

function RailButton({ icon, label, active, accent, onClick }: { icon: string; label: string; active?: boolean; accent?: boolean; onClick: () => void }) {
    return <button className={cx('rail-icon-button', active && 'is-active', accent && 'is-accent')} type="button" title={label} aria-label={label} aria-pressed={active} onClick={onClick}><Icon name={icon}/><span className="rail-tooltip">{label}</span></button>;
}

function EmptyWorkspace({ onRun, beginner }: { onRun: () => void; beginner: boolean }) {
    return <div className="empty-workspace"><div className="empty-graphic"><span className="empty-orbit orbit-one"/><span className="empty-orbit orbit-two"/><span className="empty-core"><Icon name="bolt"/></span><span className="empty-spark spark-one"/><span className="empty-spark spark-two"/></div><span className="eyebrow">YOUR NEXT INSIGHT STARTS HERE</span><h3>Make the data<br/><em>say something.</em></h3><p>{beginner ? 'Run a query to see your data. Results stay in this workspace when you switch modes.' : 'Run the current statement. Your query, run, and evidence stay linked.'}</p><Button variant="primary" onClick={onRun}><Icon name="play"/>Focus SQL editor</Button><span className="empty-shortcut">or press <kbd>⌘ ↵</kbd> to run</span></div>;
}

type AssistantWorkflowProps = {
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

function AssistantWorkflow({ mode, sql, action, onActionChange, question, onQuestionChange, context, proposal, busy, error, trusted, runId, includeResult, onIncludeResult, onVoiceInput, voiceListening, voiceError, onPreview, onRequestProposal, onDecideProposal, onRunQuery, runDisabled, onSave, saveDisabled = false }: AssistantWorkflowProps) {
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

function ResultGrid({ run, page, pageIndex, loading, onPage }: { run: Run; page?: ResultPage; pageIndex: number; loading: boolean; onPage: (page: number) => void }) {
    if (run.resultState === 'expired') return <div className="result-empty-state"><span className="empty-result-icon">⌛</span><strong>Result retention expired</strong><p>The SQL and query ID are still available. Run it again to fetch fresh data.</p></div>;
    if (run.resultState !== 'reopenable') return <div className="result-empty-state"><span className="loading-orbit"/><strong>{terminal(run) ? 'No retained result' : 'Query is running'}</strong><p>{terminal(run) ? 'This run did not produce result rows.' : 'The live execution status appears in the bottom bar.'}</p>{run.error && <div className="callout callout-error mt-4">{run.error.code}: {run.error.message}</div>}</div>;
    if (loading || !page) return <div className="result-loading"><span className="loading-orbit"/><span>Loading retained rows…</span></div>;
    const pageCount = Math.max(1, Math.ceil(page.totalRows / 200));
    return <div className="result-grid-wrap animate-enter"><div className="result-summary-row"><span><strong>{page.totalRows.toLocaleString()}</strong> rows <i>·</i> <strong>{page.columns.length}</strong> columns</span><span className="result-completeness"><span className={cx('status-light', page.completeness === 'truncated' ? 'is-warning' : 'is-trusted')}/>{page.completeness === 'truncated' ? 'Retained prefix · truncated' : 'Complete result'}</span><span>Page {pageIndex + 1} of {pageCount}</span></div><div className="data-table-scroll"><table className="data-table"><thead><tr><th className="row-number">#</th>{page.columns.map((column, index) => <th key={`${column.name}-${index}`}><span>{column.name}</span><small>{column.type}</small></th>)}</tr></thead><tbody>{page.rows.map((row, rowIndex) => <tr key={`${page.offset}-${rowIndex}`} style={{ animationDelay: `${Math.min(rowIndex, 12) * 16}ms` }}><td className="row-number">{page.offset + rowIndex + 1}</td>{row.map((value, index) => <td key={index} title={displayValue(value)} className={value === null ? 'cell-null' : ''}>{displayValue(value)}</td>)}</tr>)}</tbody></table>{page.rows.length === 0 && <div className="no-rows">This query returned zero rows.</div>}</div><div className="table-pagination"><span>Showing {page.rows.length.toLocaleString()} of {page.totalRows.toLocaleString()} retained rows</span><div><Button variant="secondary" disabled={pageIndex === 0} onClick={() => onPage(0)}>First</Button><Button variant="secondary" disabled={pageIndex === 0} onClick={() => onPage(pageIndex - 1)}>←</Button><Button variant="secondary" disabled={pageIndex + 1 >= pageCount} onClick={() => onPage(pageIndex + 1)}>→</Button><Button variant="secondary" disabled={pageIndex + 1 >= pageCount} onClick={() => onPage(pageCount - 1)}>Last</Button></div></div></div>;
}

function ChartView({ result, loading, chart, onChart }: { result?: Result; loading: boolean; chart: Draft['chart']; onChart: (chart: Draft['chart']) => void }) {
    if (loading || !result) return <div className="result-loading"><span className="loading-orbit"/><span>Preparing a chart from retained rows…</span></div>;
    const suggestion = recommendChart(result.columns, result.rows);
    const xIndex = Math.min(chart.x, Math.max(0, result.columns.length - 1));
    const yIndex = chart.ys.find(index => index < result.columns.length) ?? suggestion.config.ys[0] ?? 0;
    const values = result.rows.map(row => chartNumber(row[yIndex])).filter((value): value is number => value !== null);
    const max = Math.max(...values, 1), min = Math.min(...values, 0), range = max - min || 1;
    const bars = result.rows.slice(0, 24).map((row, index) => ({ label: displayValue(row[xIndex]), value: chartNumber(row[yIndex]) ?? 0, index }));
    const points = bars.map((item, index) => `${32 + index * (700 / Math.max(1, bars.length - 1))},${190 - ((item.value - min) / range) * 150}`).join(' ');
    return <div className="chart-workspace animate-enter"><div className="chart-title-row"><div><span className="eyebrow">VISUAL EXPLORATION</span><h3>{chart.title || result.columns[yIndex]?.name || 'Query result'}</h3><p>{suggestion.reason} Chart uses retained rows only.</p></div><div className="chart-controls"><label>X axis<select value={xIndex} onChange={event => onChart({ ...chart, x: Number(event.target.value) })}>{result.columns.map((column, index) => <option value={index} key={index}>{column.name}</option>)}</select></label><label>Measure<select value={yIndex} onChange={event => onChart({ ...chart, ys: [Number(event.target.value)] })}>{result.columns.map((column, index) => <option value={index} key={index} disabled={!/^(U?Int\d+|Float\d+|Decimal)/.test(column.type)}>{column.name}</option>)}</select></label><label>Type<select value={chart.kind === 'line' ? 'line' : 'bar'} onChange={event => onChart({ ...chart, kind: event.target.value as Draft['chart']['kind'] })}><option value="line">Line</option><option value="bar">Bar</option></select></label></div></div>{!values.length ? <div className="chart-empty">Choose a numeric result column to plot.</div> : <div className="chart-canvas"><div className="chart-axis-labels"><span>{max.toLocaleString()}</span><span>{(min + range / 2).toLocaleString()}</span><span>{min.toLocaleString()}</span></div><svg viewBox="0 0 760 230" role="img" aria-label={`${chart.kind} chart of ${result.columns[yIndex]?.name}`}><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".35"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>{[40, 115, 190].map(y => <line key={y} x1="32" x2="732" y1={y} y2={y} className="chart-gridline"/>)}{chart.kind === 'line' ? <><polygon points={`32,190 ${points} ${32 + Math.max(0, bars.length - 1) * (700 / Math.max(1, bars.length - 1))},190`} fill="url(#chart-fill)"/><polyline points={points} className="chart-line"/>{bars.map((point, index) => <circle key={point.index} cx={32 + index * (700 / Math.max(1, bars.length - 1))} cy={190 - ((point.value - min) / range) * 150} r="3.5" className="chart-point"/> )}</> : bars.map((bar, index) => <rect key={bar.index} x={40 + index * (680 / Math.max(1, bars.length))} y={190 - (bar.value / max) * 150} width={Math.max(4, 20 - bars.length / 2)} height={Math.max(1, (bar.value / max) * 150)} rx="3" className="chart-bar" style={{ animationDelay: `${index * 20}ms` }}/>)}</svg><div className="chart-x-labels"><span>{bars[0]?.label}</span><span>{bars[Math.floor(bars.length / 2)]?.label}</span><span>{bars.at(-1)?.label}</span></div></div>}<div className="chart-footer"><span><span className="chart-legend-dot"/>{result.columns[yIndex]?.name}</span><span>{Math.min(result.rows.length, 24)} plotted points <i>·</i> {result.completeness === 'truncated' ? 'truncated result' : 'complete result'}</span></div></div>;
}

function InsightsView({ run, profile, onLoad, loading }: { run: Run; profile?: QueryProfile; onLoad: () => void; loading: boolean }) {
    const summary = profile?.summary;
    const metrics = [
        { label: 'Execution time', value: `${Math.round(summary?.durationMs ?? run.elapsedMs)} ms`, icon: 'bolt' },
        { label: 'Rows scanned', value: summary?.readRows ? Number(summary.readRows).toLocaleString() : 'Unavailable', icon: 'schema' },
        { label: 'Data read', value: summary?.readBytes ? formatBytes(summary.readBytes) : 'Unavailable', icon: 'details' },
        { label: 'Peak memory', value: summary?.memory ? formatBytes(summary.memory) : 'Unavailable', icon: 'pipeline' },
        { label: 'Rows returned', value: run.rowCount.toLocaleString(), icon: 'chart' },
        { label: 'Result size', value: formatBytes(run.bytes), icon: 'documents' },
    ];
    return <div className="insights-view animate-enter"><div className="insights-heading"><div><span className="eyebrow">EXECUTION INSIGHTS</span><h3>What happened when this ran?</h3><p>Measurements come from this run's execution and ClickHouse query log.</p></div>{!profile && <Button variant="secondary" onClick={onLoad} disabled={loading}>{loading ? 'Loading…' : 'Load execution details'}</Button>}</div><div className="insight-metrics">{metrics.map(metric => <article className="insight-metric" key={metric.label}><span className="insight-icon"><Icon name={metric.icon}/></span><span className="eyebrow">{metric.label}</span><strong>{metric.value}</strong></article>)}</div>{profile?.insights.length ? <div className="insight-list">{profile.insights.map(insight => <article key={insight.id} className={`insight-card severity-${insight.severity}`}><span className="insight-severity">{insight.severity}</span><div><strong>{insight.title}</strong><p>{insight.description}</p></div></article>)}</div> : profile ? <div className="profile-empty">No deterministic issue was identified in the available evidence.</div> : <p className="profile-note">Query log details can take a short time to appear after execution. Values marked unavailable are not inferred.</p>}{profile?.notice && <p className="profile-note">{profile.notice}</p>}</div>;
}

function InspectorPane({ inspector, setInspector, connection, schema, schemaLoading, schemaError, search, setSearch, tables, history, documents, run, profile, pipeline, onRefreshSchema, onInsert, onOpenRun, onOpenDocument, onLoadProfile, onLoadPipeline, connectionId, sql, trusted, runId, onRefreshDocuments, assistantAction, onAssistantAction, assistantQuestion, onAssistantQuestion, assistantContext, assistantProposal, assistantBusy, assistantError, includeResult, onIncludeResult, onVoiceInput, voiceListening, voiceError, onPreview, onRequestProposal, onDecideProposal, onRunQuery, runDisabled, drawer = false, onClose }: {
    inspector: Inspector;
    setInspector: (inspector: Inspector) => void;
    connection: Connected;
    schema?: Schema;
    schemaLoading: boolean;
    schemaError: string;
    search: string;
    setSearch: (search: string) => void;
    tables: Schema['tables'];
    history: Run[];
    documents: QueryDocument[];
    run?: Run;
    profile?: QueryProfile;
    pipeline?: ProfilePipeline;
    onRefreshSchema: () => void;
    onInsert: (value: string) => void;
    onOpenRun: (run: Run) => void;
    onOpenDocument: (document: QueryDocument) => void;
    onLoadProfile: () => void;
    onLoadPipeline: () => void;
    connectionId: string;
    sql: string;
    trusted: boolean;
    runId?: string;
    onRefreshDocuments: () => void;
    assistantAction: AssistantAction;
    onAssistantAction: (action: AssistantAction) => void;
    assistantQuestion: string;
    onAssistantQuestion: (question: string) => void;
    assistantContext?: AssistantContext;
    assistantProposal?: Proposal;
    assistantBusy: boolean;
    assistantError: string;
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
    drawer?: boolean;
    onClose?: () => void;
}) {
    const visibleDocuments = documents.filter(document => document.connectionId === connectionId && !document.deletedAt);
    const closeButton = drawer && <Button variant="ghost" className="icon-only" aria-label="Close inspector" onClick={onClose}><Icon name="close"/></Button>;

    return <aside className={cx('inspector-pane', drawer && 'is-drawer animate-drawer')}>
        <header className="inspector-header"><div><span className="eyebrow">WORKSPACE INSPECTOR</span><h2>{inspectorLabel(inspector)}</h2></div>{closeButton}</header>
        <nav className="inspector-tabs" aria-label="Inspector panels">{(['schema', 'history', 'documents', 'details', 'pipeline', 'assistant'] as Inspector[]).filter(item => item !== 'details' || Boolean(run)).map(item => <button key={item} type="button" aria-label={inspectorLabel(item)} title={inspectorLabel(item)} aria-pressed={inspector === item} onClick={() => setInspector(item)}><Icon name={item === 'details' ? 'details' : item === 'pipeline' ? 'pipeline' : item === 'assistant' ? 'assistant' : item}/></button>)}</nav>
        <div className="inspector-content">
            {inspector === 'schema' && <section className="inspector-section"><div className="inspector-search"><Icon name="search"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tables and columns…" aria-label="Search schema"/><kbd>⌘ F</kbd></div><div className="schema-heading"><span>{schema?.tables.length ?? 0} TABLES</span><Button variant="ghost" className="toolbar-small" onClick={onRefreshSchema} disabled={schemaLoading || !trusted}>{schemaLoading ? 'Loading…' : 'Refresh'}</Button></div>{schemaError && <div className="callout callout-error">{schemaError}</div>}{!trusted && <div className="inspector-empty"><Icon name="lock"/><strong>Schema is private</strong><p>Trust the connection to inspect tables and columns.</p></div>}{schemaLoading && <div className="inspector-empty"><span className="loading-orbit"/><p>Reading ClickHouse schema…</p></div>}{trusted && schema && tables.map(table => <details className="schema-table" key={`${table.database}.${table.name}`} open={Boolean(search)}><summary><span className="table-glyph">▦</span><span className="schema-table-name"><strong>{table.name}</strong><small>{table.database}</small></span><span className="engine-tag">{table.engine}</span><Icon name="chevron" className="schema-chevron"/></summary><div className="schema-columns"><button type="button" className="insert-table-button" onClick={() => onInsert(`${quoteIdentifier(table.database)}.${quoteIdentifier(table.name)}`)}>Insert table name <span>↵</span></button>{schema.columns.filter(column => column.database === table.database && column.table === table.name && (!search || `${column.name} ${column.type}`.toLowerCase().includes(search.toLowerCase()))).map(column => <button type="button" className="schema-column" key={column.name} title={column.comment || column.type} onClick={() => onInsert(quoteIdentifier(column.name))}><span className="column-type-dot"/><span>{column.name}</span><code>{column.type}</code></button>)}</div></details>)}{trusted && schema && !tables.length && <div className="inspector-empty">No tables match this search.</div>}</section>}
            {inspector === 'history' && <section className="inspector-section"><div className="schema-heading"><span>RECENT RUNS</span><Button variant="ghost" className="toolbar-small" onClick={() => void api<Run[]>(`/runs?connectionId=${encodeURIComponent(connection.id)}`).then(() => undefined)}>↻ Refresh</Button></div>{history.length ? history.slice(0, 30).map(item => <button type="button" className="history-card" key={item.id} onClick={() => onOpenRun(item)}><span className={cx('run-state-mark', `state-${item.status}`)}/><span className="history-card-copy"><strong>{item.sql.replace(/\s+/g, ' ').slice(0, 58)}</strong><small>{new Date(item.createdAt).toLocaleString()} <i>·</i> {Math.round(item.elapsedMs)} ms <i>·</i> {item.rowCount.toLocaleString()} rows</small></span><span className="history-open">↗</span></button>) : <div className="inspector-empty"><Icon name="history"/><strong>No runs yet</strong><p>Your recent ClickHouse executions appear here.</p></div>}</section>}
            {inspector === 'documents' && <section className="inspector-section"><div className="schema-heading"><span>SAVED DOCUMENTS</span><Button variant="ghost" className="toolbar-small" onClick={onRefreshDocuments}>↻ Refresh</Button></div>{visibleDocuments.length ? visibleDocuments.map(document => <button type="button" className="document-card" key={document.id} onClick={() => onOpenDocument(document)}><span className="file-type-icon small">SQL</span><span><strong>{document.name}</strong><small>revision {document.revision} · {new Date(document.updatedAt).toLocaleDateString()}</small></span><span className="history-open">↗</span></button>) : <div className="inspector-empty"><Icon name="documents"/><strong>Nothing saved yet</strong><p>Save the current query to keep a named revision on this connection.</p></div>}</section>}
            {inspector === 'details' && <RunDetails run={run} profile={profile} onLoad={onLoadProfile}/>}
            {inspector === 'pipeline' && <PipelineView run={run} profile={profile} pipeline={pipeline} onLoad={onLoadPipeline}/>}
            {inspector === 'assistant' && <AssistantWorkflow mode={drawer ? 'beginner' : 'expert'} sql={sql} action={assistantAction} onActionChange={onAssistantAction} question={assistantQuestion} onQuestionChange={onAssistantQuestion} context={assistantContext} proposal={assistantProposal} busy={assistantBusy} error={assistantError} trusted={trusted} runId={runId} includeResult={includeResult} onIncludeResult={onIncludeResult} onVoiceInput={onVoiceInput} voiceListening={voiceListening} voiceError={voiceError} onPreview={onPreview} onRequestProposal={onRequestProposal} onDecideProposal={onDecideProposal} onRunQuery={onRunQuery} runDisabled={runDisabled}/>}
        </div>
        <footer className="inspector-footer"><span className="connection-readonly"><Icon name="lock"/> Read only</span><span>{connection.name} <i>·</i> {connection.database}</span></footer>
    </aside>;
}

function RunDetails({ run, profile, onLoad }: { run?: Run; profile?: QueryProfile; onLoad: () => void }) {
    if (!run) return <div className="inspector-empty">Run a query to see execution details.</div>;
    const summary = profile?.summary;
    const items: Array<[string, string]> = [['Query ID', run.queryId], ['Duration', `${Math.round(summary?.durationMs ?? run.elapsedMs)} ms`], ['Rows read', summary?.readRows ? Number(summary.readRows).toLocaleString() : '—'], ['Bytes read', summary?.readBytes ? formatBytes(summary.readBytes) : '—'], ['Memory', summary?.memory ? formatBytes(summary.memory) : '—'], ['Rows returned', run.rowCount.toLocaleString()], ['Executed as', run.executedAs], ['Server', run.serverVersion ?? '—']];
    return <section className="inspector-section"><div className="run-detail-hero"><span className="eyebrow">LATEST EXECUTION</span><Status run={run}/><strong>{run.queryId}</strong><small>{new Date(run.createdAt).toLocaleString()}</small></div><div className="run-fact-list">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong>{label === 'Query ID' && <button title="Copy query ID" onClick={() => void navigator.clipboard.writeText(value)}><Icon name="copy"/></button>}</div>)}</div>{run.error && <div className="callout callout-error">{run.error.code}: {run.error.message}</div>}<Button variant="secondary" className="w-full mt-4" onClick={onLoad}>Load query log evidence</Button>{profile?.notice && <p className="profile-note">{profile.notice}</p>}</section>;
}

function PipelineView({ run, profile, pipeline, onLoad }: { run?: Run; profile?: QueryProfile; pipeline?: ProfilePipeline; onLoad: () => void }) {
    if (!run) return <div className="inspector-empty">Run a query to inspect its execution pipeline.</div>;
    const stages = pipeline?.nodes ?? profile?.pipeline.nodes ?? [];
    return <section className="inspector-section"><div className="schema-heading"><span>EXECUTION PIPELINE</span><Button variant="ghost" className="toolbar-small" onClick={onLoad}>Load evidence</Button></div>{pipeline?.notice && <p className="profile-note">{pipeline.notice}</p>}{stages.length ? <div className="pipeline-list">{stages.map((stage, index) => <article className={`pipeline-stage stage-${stage.status}`} key={stage.id}><span className="pipeline-stage-index">{String(index + 1).padStart(2, '0')}</span><span className="pipeline-connector"/><span className="pipeline-stage-body"><strong>{stage.label}</strong><small>{stage.detail ?? stage.kind} · {stage.status}</small><span>{[stage.durationMs === undefined ? '' : `${Math.round(stage.durationMs)} ms`, stage.rows ? `${stage.rows} rows` : '', stage.bytes ? `${stage.bytes} bytes` : ''].filter(Boolean).join(' · ') || 'No stage-level measurements'}</span></span><span className="stage-evidence">{stage.status}</span></article>)}</div> : <div className="inspector-empty"><Icon name="pipeline"/><strong>Pipeline evidence is not loaded</strong><p>Available ClickHouse versions can return an EXPLAIN PIPELINE graph.</p></div>}</section>;
}

function ExecutionBar({ run, eventState, onCancel, busy }: { run: Run; eventState: string; onCancel: () => void; busy: boolean }) {
    const progress = run.progress;
    return <footer className={cx('execution-bar', !terminal(run) && 'is-running')}><div className="execution-state"><Status run={run}/><span className="execution-separator"/><strong>{terminal(run) ? `${Math.round(run.elapsedMs)} ms` : `${Math.max(0, Math.round(progress?.elapsedMs ?? run.elapsedMs))} ms`}</strong><span className="execution-link-state"><span className={cx('status-light', eventState === 'live' ? 'is-trusted' : eventState === 'reconnecting' ? 'is-warning' : '')}/>{eventState === 'live' ? 'Live updates' : eventState === 'reconnecting' ? 'Reconnecting' : 'Complete'}</span></div><div className="execution-telemetry"><span><strong>{progress?.readRows ? formatCount(progress.readRows) : '—'}</strong> rows read</span><span><strong>{progress?.readBytes ? formatBytes(progress.readBytes) : '—'}</strong> read</span><span><strong>{progress?.memory ? formatBytes(progress.memory) : '—'}</strong> memory</span>{run.kind !== 'query' && <span className="execution-kind">{run.kind.toUpperCase()}</span>}</div><div className="execution-right"><code title={run.queryId}>{run.queryId}</code>{!terminal(run) && <Button variant="danger" className="cancel-execution" onClick={onCancel} disabled={busy}>Cancel</Button>}</div><span className="execution-progress-line"/></footer>;
}

function formatBytes(value?: string | number): string {
    if (value === undefined) return '—';
    const bytes = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(bytes)) return String(value);
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${bytes.toLocaleString()} B`;
}
function formatCount(value: string | number): string {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(number) : String(value);
}
function inspectorLabel(value: Inspector): string { return ({ schema: 'Schema explorer', history: 'Run history', documents: 'Documents', details: 'Run details', profile: 'Query profile', pipeline: 'Pipeline', assistant: 'AI copilot' })[value]; }

export default App;
