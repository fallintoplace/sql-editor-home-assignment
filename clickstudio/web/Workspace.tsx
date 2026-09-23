import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssistantAction, ProfilePipeline, Proposal, QueryDocument, QueryProfile, Result, Run, Schema, Script } from '../shared/types';
import { DEFAULT_LIMITS } from '../shared/types';
import { filterSchemaTables, indexSchemaColumns } from '../shared/schema-browser';
import { recommendChart } from '../shared/results';
import { matchesDraft } from '../shared/evidence';
import { formatSql, parameterNames, selectedStatement, splitSql } from '../shared/sql';
import { api, download, isFrontendDemoPreview, message, post } from './api';
import { DEMO_PREVIEW_RUN_ID, DEMO_PREVIEW_SQL, DEMO_PREVIEW_STARTER_DOCUMENT_ID } from './demo-preview';
import { SqlEditor, type EditorHandle } from './components/SqlEditor';
import { ImportWizard } from './components/ImportWizard';
import { AssistantWorkflow } from './components/AssistantWorkflow';
import { ChartView, InsightsView, ResultGrid } from './components/ResultViews';
import { InspectorPane, type InspectorPaneProps } from './components/InspectorPane';
import { Button, cx, Icon, Status, terminal } from './components/ui';
import { ExecutionBar, RailButton, RunActionMenu, ScriptResults } from './components/WorkspaceChrome';
import { checkpoint, closeDraft, draftFromDocument, MAX_TABS, newDraft, recover, reopenDraft, SAMPLE_SQL, type Draft, type WorkspaceState } from './workspace-state';
import { draftSaveStatus, rememberRunIds } from '../shared/workspace-view';
import type { NativeParseSnapshot, NativeParserStatus } from '../shared/native-parser';
import { useWorkspacePersistence } from './useWorkspacePersistence';
import { useRunEvidence } from './useRunEvidence';
import { useScriptExecution } from './useScriptExecution';
import { useScopedValue } from './useScopedValue';
import type { Copy, ExperienceLevel, Locale } from './i18n';
import type { AssistantContext, BusyAction, Connected, Inspector, ResultsView, SpeechRecognitionLike } from './workspace-types';

const stateKey = (connectionId: string) => `clickstudio:workspace:${connectionId}:v1`;
function safeSelectedStatement(sql: string, from: number, to: number) {
    try { return selectedStatement(sql, from, to); } catch { return undefined; }
}
function safeStatementCount(sql: string) {
    try { return splitSql(sql).length; } catch { return undefined; }
}
function assistantContextKey(connectionId: string, draftId: string, sql: string, parameters: Record<string, string>, runId: string | undefined, includeResult: boolean, action: AssistantAction, question: string) {
    return JSON.stringify({ connectionId, draftId, sql, parameters: Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right)), runId, includeResult, action, question });
}

type WorkspaceProps = {
    connection: Connected;
    connectionLabel: string;
    connections: Connected[];
    onSelectConnection: (id: string) => void;
    onRefreshConnections: () => Promise<void>;
    trustActionRef: { current: () => Promise<void> };
    demoMode: boolean;
    experience: ExperienceLevel;
    dark: boolean;
    copy: Copy;
    locale: Locale;
};

export function Workspace({ connection, connectionLabel, connections, onSelectConnection, onRefreshConnections, trustActionRef, demoMode, experience, dark, copy, locale }: WorkspaceProps) {
    const key = stateKey(connection.id);
    const [workspace, setWorkspace] = useState<WorkspaceState>(() => {
        const recovered = recover(key);
        if (!isFrontendDemoPreview) return recovered;
        const activeId = recovered.tabs.find(tab => tab.id === recovered.activeId)?.id ?? recovered.tabs[0]!.id;
        const active = recovered.tabs.find(tab => tab.id === activeId)!;
        const isStarterDraft = active.name === 'Getting started.sql' &&
            (active.sql.trim() === SAMPLE_SQL.trim() || active.sql.trim() === DEMO_PREVIEW_SQL.trim());
        const canUseStarterRun = !active.activeRunId || active.activeRunId === DEMO_PREVIEW_RUN_ID;
        if (!isStarterDraft || !canUseStarterRun) return recovered;
        return {
            ...recovered,
            tabs: recovered.tabs.map(tab => tab.id === activeId
                ? {
                    ...tab, sql: DEMO_PREVIEW_SQL,
                    serverId: tab.serverId ?? DEMO_PREVIEW_STARTER_DOCUMENT_ID,
                    baseRevision: tab.baseRevision ?? 1,
                    chart: { kind: 'line', x: 0, ys: [1, 2], title: 'Daily activity' },
                    activeRunId: DEMO_PREVIEW_RUN_ID,
                    runIds: [...new Set([...tab.runIds, DEMO_PREVIEW_RUN_ID])],
                }
                : tab),
        };
    });
    const workspaceRef = useRef(workspace);
    workspaceRef.current = workspace;
    const active = workspace.tabs.find(tab => tab.id === workspace.activeId) ?? workspace.tabs[0]!;
    const activeRunId = active.activeRunId;
    const activeRunIdRef = useRef(activeRunId);
    activeRunIdRef.current = activeRunId;
    const editor = useRef<EditorHandle>(null);
    const [nativeParserStatus, setNativeParserStatus] = useState<NativeParserStatus>('loading');
    const [nativeParseSnapshot, setNativeParseSnapshot] = useState<NativeParseSnapshot>();
    const [schema, setSchema] = useState<Schema>();
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [schemaError, setSchemaError] = useState('');
    const [documents, setDocuments] = useState<QueryDocument[]>([]);
    const [documentsLoaded, setDocumentsLoaded] = useState(false);
    const [documentsReadError, setDocumentsReadError] = useState(false);
    const [savingDraftIds, setSavingDraftIds] = useState<Record<string, boolean>>({});
    const [history, setHistory] = useState<Run[]>([]);
    const [scripts, setScripts] = useState<Record<string, Script>>({});
    const script = active.scriptId ? scripts[active.scriptId] : undefined;
    const [view, setView] = useState<ResultsView>('results');
    const [inspector, setInspector] = useState<Inspector>('schema');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [compactViewport, setCompactViewport] = useState(() => window.matchMedia('(max-width: 850px)').matches);
    const [importOpen, setImportOpen] = useState(false);
    const [busy, setBusy] = useState<BusyAction>('');
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState('');
    const [assistantAction, setAssistantAction] = useState<AssistantAction>('generate');
    const [assistantQuestion, setAssistantQuestion] = useState('');
    const [assistantContextState, setAssistantContextForDraft] = useScopedValue<AssistantContext | undefined>(active.id);
    const [assistantProposalState, setAssistantProposalForDraft] = useScopedValue<{ key: string; value: Proposal } | undefined>(active.id);
    const [assistantBusyKey, setAssistantBusyKey] = useState<string>();
    const [assistantErrors, setAssistantErrors] = useState<Record<string, string>>({});
    const [includeResult, setIncludeResultState] = useState(false);
    const [voiceListening, setVoiceListening] = useState(false);
    const [voiceError, setVoiceError] = useState('');
    const recognitionRef = useRef<SpeechRecognitionLike | undefined>(undefined);
    const promptBeforeVoiceRef = useRef('');
    const storageError = useWorkspacePersistence(key, workspace);
    const parameters = useMemo(() => {
        try { return parameterNames(active.sql); } catch { return []; }
    }, [active.sql]);
    const assistantKey = assistantContextKey(connection.id, active.id, active.sql, active.parameters, activeRunId, includeResult, assistantAction, assistantQuestion);
    const assistantKeyRef = useRef(assistantKey);
    assistantKeyRef.current = assistantKey;
    const assistantBusy = assistantBusyKey === assistantKey;
    const assistantError = assistantErrors[active.id] ?? '';
    const setAssistantError = (error: string) => setAssistantErrors(current => ({ ...current, [active.id]: error }));
    const assistantContext = assistantContextState?.key === assistantKey ? assistantContextState : undefined;
    const assistantProposal = assistantProposalState && (assistantProposalState.key === assistantKey || (assistantProposalState.value.decision === 'accepted' && assistantProposalState.value.sql === active.sql))
        ? assistantProposalState.value : undefined;
    const assistantRequestRef = useRef(0);
    const currentConnection = connections.find(item => item.id === connection.id) ?? connection;
    const trusted = currentConnection.trusted;

    useEffect(() => {
        const media = window.matchMedia('(max-width: 850px)');
        const update = () => {
            setCompactViewport(media.matches);
            if (!media.matches) setDrawerOpen(false);
        };
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    const trustedRef = useRef(trusted);
    trustedRef.current = trusted;
    const schemaRequestRef = useRef(0), historyRequestRef = useRef(0), documentsRequestRef = useRef(0);
    const cancellingRef = useRef(false);

    useEffect(() => () => recognitionRef.current?.abort(), []);
    useEffect(() => { setDrawerOpen(false); }, [experience]);

    const startVoiceInput = () => {
        if (voiceListening) { recognitionRef.current?.stop(); return; }
        const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
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
            assistantRequestRef.current++;
            setAssistantBusyKey(undefined);
            setAssistantContextForDraft(active.id, undefined);
            setAssistantProposalForDraft(active.id, undefined);
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
        const draftId = active.id;
        const requestKey = assistantContextKey(connection.id, draftId, active.sql, active.parameters, activeRunId, includeResult, action, question);
        const requestId = ++assistantRequestRef.current;
        setAssistantBusyKey(requestKey); setAssistantError(''); setAssistantAction(action);
        try {
            const result = await post<AssistantContext>('/assistant/context', { connectionId: connection.id, action, question, sql: active.sql, runId: activeRunId, includeResult });
            if (assistantRequestRef.current !== requestId || assistantKeyRef.current !== requestKey) return;
            setAssistantContextForDraft(draftId, { ...result, key: requestKey });
            setAssistantProposalForDraft(draftId, undefined);
        } catch (caught) {
            if (assistantRequestRef.current === requestId && assistantKeyRef.current === requestKey) setAssistantError(message(caught));
        } finally { if (assistantRequestRef.current === requestId) setAssistantBusyKey(undefined); }
    };

    const requestAssistantProposal = async () => {
        if (!assistantContext || assistantBusy) return;
        const context = assistantContext;
        if (context.key !== assistantKeyRef.current) { setAssistantError('The draft changed. Preview the current context before asking for a proposal.'); return; }
        if (!window.confirm(`Send the reviewed SQL and selected context to the configured AI provider? ${assistantContext.summary.join(' ')}`)) return;
        const draftId = active.id;
        const requestId = ++assistantRequestRef.current;
        setAssistantBusyKey(context.key); setAssistantError('');
        try {
            const proposal = await post<Proposal>('/assistant/proposals', { contextId: context.id, consent: true });
            if (assistantRequestRef.current !== requestId || assistantKeyRef.current !== context.key) return;
            setAssistantProposalForDraft(draftId, { key: context.key, value: proposal });
        } catch (caught) {
            if (assistantRequestRef.current === requestId && assistantKeyRef.current === context.key) setAssistantError(message(caught));
        } finally { if (assistantRequestRef.current === requestId) setAssistantBusyKey(undefined); }
    };

    const decideAssistantProposal = async (decision: 'accepted' | 'rejected') => {
        if (!assistantProposal || assistantProposal.decision !== 'pending' || assistantProposal.baseSql !== active.sql) return;
        const proposal = assistantProposal;
        const draftId = active.id;
        const requestKey = assistantContextKey(connection.id, draftId, active.sql, active.parameters, activeRunId, includeResult, assistantAction, assistantQuestion);
        const requestId = ++assistantRequestRef.current;
        setAssistantBusyKey(requestKey); setAssistantError('');
        try {
            const reviewed = await post<Proposal>(`/assistant/proposals/${encodeURIComponent(proposal.id)}/decision`, { decision, connectionId: connection.id, currentSql: active.sql });
            setAssistantProposalForDraft(draftId, { key: requestKey, value: reviewed }, true);
            const currentDraft = workspaceRef.current.tabs.find(draft => draft.id === draftId);
            if (decision === 'accepted' && reviewed.sql !== null && currentDraft?.sql === proposal.baseSql) {
                update(draftId, draft => ({ ...checkpoint(draft, 'Before accepted AI proposal'), sql: reviewed.sql!, from: 0, to: 0 }));
            }
        } catch (caught) {
            if (assistantRequestRef.current === requestId && assistantKeyRef.current === requestKey) setAssistantError(message(caught));
        } finally { if (assistantRequestRef.current === requestId) setAssistantBusyKey(undefined); }
    };

    const changeAssistantQuestion = (question: string) => {
        assistantRequestRef.current++;
        setAssistantBusyKey(undefined);
        setAssistantQuestion(question); setAssistantContextForDraft(active.id, undefined); setAssistantProposalForDraft(active.id, undefined); setAssistantError('');
    };
    const clearAssistantReview = () => {
        assistantRequestRef.current++;
        setAssistantBusyKey(undefined);
        setAssistantContextForDraft(active.id, undefined);
        setAssistantProposalForDraft(active.id, undefined);
        setAssistantError('');
    };
    const changeAssistantAction = (action: AssistantAction) => {
        setAssistantAction(action);
        clearAssistantReview();
    };
    const changeIncludeResult = (include: boolean) => {
        if (include === includeResult) return;
        setIncludeResultState(include);
        clearAssistantReview();
    };
    const setAssistantContext = (context?: AssistantContext) => {
        assistantRequestRef.current++;
        setAssistantBusyKey(undefined);
        setAssistantContextForDraft(active.id, context);
    };
    const setAssistantProposal = (proposal?: Proposal) => {
        assistantRequestRef.current++;
        setAssistantBusyKey(undefined);
        setAssistantProposalForDraft(active.id, proposal ? { key: assistantKey, value: proposal } : undefined);
    };
    const setIncludeResult = changeIncludeResult;

    const update = useCallback((id: string, change: (draft: Draft) => Draft) => {
        setWorkspace(current => ({ ...current, tabs: current.tabs.map(draft => draft.id === id ? change(draft) : draft) }));
    }, []);
    const patch = useCallback((values: Partial<Draft>) => update(active.id, draft => ({ ...draft, ...values })), [active.id, update]);
    const formatActiveSql = useCallback(async () => {
        const draftId = active.id, sourceSql = active.sql;
        const applyFallback = () => setWorkspace(current => current.activeId !== draftId ? current : ({ ...current,
            tabs: current.tabs.map(draft => draft.id === draftId && draft.sql === sourceSql ? { ...draft, sql: formatSql(sourceSql) } : draft),
        }));
        if (nativeParserStatus !== 'ready') {
            applyFallback();
            return;
        }
        const result = await editor.current?.formatNative();
        if (result === 'unavailable' || result === 'fallback')
            applyFallback();
    }, [active.id, active.sql, nativeParserStatus]);

    const loadHistory = useCallback(async () => {
        const requestId = ++historyRequestRef.current;
        try {
            const next = await api<Run[]>(`/runs?connectionId=${encodeURIComponent(connection.id)}`);
            if (historyRequestRef.current === requestId) setHistory(next);
        } catch (caught) {
            if (historyRequestRef.current === requestId) throw caught;
        }
    }, [connection.id]);
    const loadDocuments = useCallback(async () => {
        const requestId = ++documentsRequestRef.current;
        try {
            const next = await api<QueryDocument[]>(`/documents?trash=true&connectionId=${encodeURIComponent(connection.id)}`);
            if (documentsRequestRef.current === requestId) {
                setDocuments(next);
                setDocumentsReadError(false);
            }
        } catch (caught) {
            if (documentsRequestRef.current === requestId) {
                setDocumentsReadError(true);
                throw caught;
            }
        } finally {
            if (documentsRequestRef.current === requestId) setDocumentsLoaded(true);
        }
    }, [connection.id]);
    const loadSchema = useCallback(async () => {
        const requestId = ++schemaRequestRef.current;
        if (!trustedRef.current) {
            setSchema(undefined);
            setSchemaError('');
            setSchemaLoading(false);
            return;
        }
        setSchemaLoading(true); setSchemaError('');
        try {
            const next = await api<Schema>(`/connections/${encodeURIComponent(connection.id)}/schema`);
            if (schemaRequestRef.current === requestId && trustedRef.current)
                setSchema(next);
        } catch (caught) {
            if (schemaRequestRef.current === requestId && trustedRef.current)
                setSchemaError(message(caught));
        } finally {
            if (schemaRequestRef.current === requestId)
                setSchemaLoading(false);
        }
    }, [connection.id]);

    useEffect(() => {
        void Promise.all([loadHistory(), loadDocuments()]).catch(caught => setError(message(caught)));
        if (trusted) void loadSchema();
        else {
            schemaRequestRef.current++;
            setSchema(undefined);
            setSchemaError('');
            setSchemaLoading(false);
        }
        const interval = window.setInterval(() => { void loadHistory().catch(() => undefined); }, 15000);
        return () => { window.clearInterval(interval); schemaRequestRef.current++; historyRequestRef.current++; documentsRequestRef.current++; };
    }, [loadDocuments, loadHistory, loadSchema, trusted]);

    const { run, setRunForRun, page, setPage, resultPage, snapshot, setSnapshotForRun, profile, setProfileForRun, pipeline, setPipelineForRun, eventState } = useRunEvidence({
        activeRunId,
        connectionId: connection.id,
        loadHistory,
        setError,
    });
    const scriptFollowRef = useScriptExecution({
        scriptId: active.scriptId,
        draftId: active.id,
        updateDraft: update,
        setScripts,
        loadHistory,
        setError,
    });

    const perform = async (task: () => Promise<void>, kind: BusyAction = 'save') => {
        if (busy) return;
        setBusy(kind); setError(''); setNotice('');
        try { await task(); }
        catch (caught) { setError(message(caught)); }
        finally { setBusy(''); }
    };

    const addDraft = (draft: Draft) => {
        if (workspaceRef.current.tabs.length >= MAX_TABS) { setError(`Close a tab before creating another. This workspace supports ${MAX_TABS} open drafts.`); return false; }
        setWorkspace(current => ({ ...current, tabs: [...current.tabs, draft], activeId: draft.id }));
        return true;
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
            scriptFollowRef.current = { scriptId: created.id, enabled: true };
            setScripts(current => ({ ...current, [created.id]: created }));
            const first = created.statements.find(item => item.runId);
            if (first?.runId) patch({ activeRunId: first.runId, scriptId: created.id, runIds: rememberRunIds(active.runIds, [first.runId]) });
            else patch({ scriptId: created.id });
            setView('results');
        } else {
            const created = await post<Run>('/runs', payload);
            setRunForRun(created.id, created, true);
            setPage(0); setView('results');
            patch({ activeRunId: created.id, scriptId: undefined, runIds: [...new Set([...active.runIds, created.id])] });
            editor.current?.focus();
        }
        setDrawerOpen(false);
        setNotice(wholeScript
            ? 'Sample results were generated for each statement. SQL is not executed in this preview.'
            : isFrontendDemoPreview ? 'Sample rows were generated. SQL is not executed in this preview.' : 'Query submitted to the selected ClickHouse connection.');
        void loadHistory().catch(() => undefined);
    }, wholeScript ? 'script' : 'run');

    const cancel = async () => {
        if (cancellingRef.current) return;
        const scriptId = script?.status === 'running' ? script.id : undefined;
        const runId = !scriptId && run && !terminal(run) ? run.id : undefined;
        if (!scriptId && !runId) return;
        cancellingRef.current = true;
        setCancelling(true);
        setError('');
        try {
            if (scriptId) {
                const cancelled = await post<Script>(`/scripts/${encodeURIComponent(scriptId)}/cancel`);
                setScripts(current => ({ ...current, [cancelled.id]: cancelled }));
            } else if (runId) {
                setRunForRun(runId, await post<Run>(`/runs/${encodeURIComponent(runId)}/cancel`));
                setNotice('Cancellation requested. The server will confirm the final state.');
            }
        } catch (caught) {
            setError(message(caught));
        } finally {
            cancellingRef.current = false;
            setCancelling(false);
        }
    };

    const openRun = (selected: Run) => {
        if (selected.connectionId !== connection.id) { onSelectConnection(selected.connectionId); return; }
        const draft = newDraft(`${selected.kind === 'query' ? 'Query' : selected.kind.toUpperCase()} ${new Date(selected.createdAt).toLocaleTimeString()}.sql`, selected.sql);
        draft.parameters = selected.parameters;
        draft.activeRunId = selected.id;
        draft.runIds = [selected.id];
        if (!addDraft(draft)) return;
        setView('results'); setDrawerOpen(false); setNotice(`Opened retained run ${selected.queryId}. No query was rerun.`);
    };

    const saveDraft = async () => perform(async () => {
        setSavingDraftIds(current => ({ ...current, [active.id]: true }));
        try {
            const payload = { name: active.name, sql: active.sql, connectionId: connection.id, baseRevision: active.baseRevision, parameters: active.parameters, chart: active.chart, runId: active.activeRunId, parentDocumentId: active.parentDocumentId, kind: active.kind, metric: active.metric, dependencies: active.dependencies };
            const saved = await api<QueryDocument>(active.serverId ? `/documents/${encodeURIComponent(active.serverId)}` : '/documents', { method: active.serverId ? 'PUT' : 'POST', body: payload });
            patch({ serverId: saved.id, baseRevision: saved.revision });
            setDocuments(current => [saved, ...current.filter(document => document.id !== saved.id)]);
            setNotice(`Saved ${saved.name} · revision ${saved.revision}`);
        } finally { setSavingDraftIds(current => ({ ...current, [active.id]: false })); }
    }, 'save');

    const loadSnapshot = async () => {
        if (!activeRunId || snapshot || !run || run.resultState !== 'reopenable') return;
        const runId = activeRunId;
        const full = await api<Result>(`/runs/${encodeURIComponent(runId)}/snapshot`);
        setSnapshotForRun(runId, full);
        if (activeRunIdRef.current !== runId || workspaceRef.current.activeId !== active.id) return;
        const suggestion = recommendChart(full.columns, full.rows);
        if (active.chart.kind === 'table' && suggestion.config.kind !== 'table') patch({ chart: suggestion.config });
    };

    const loadProfile = async () => {
        if (!activeRunId) return;
        const runId = activeRunId;
        const response = await api<QueryProfile>(`/runs/${encodeURIComponent(runId)}/profile`);
        setProfileForRun(runId, response);
    };

    const loadPipeline = async () => {
        if (!activeRunId) return;
        const runId = activeRunId;
        const response = await api<ProfilePipeline>(`/runs/${encodeURIComponent(runId)}/profile/pipeline`);
        if (activeRunIdRef.current !== runId) return;
        setPipelineForRun(runId, response);
    };

    const showInspector = (next: Inspector) => {
        setInspector(next);
        if (experience === 'beginner' || compactViewport) setDrawerOpen(true);
        if (next === 'profile') void perform(loadProfile, 'save');
        if (next === 'pipeline') void perform(loadPipeline, 'save');
    };

    const trustConnection = () => perform(async () => {
        if (!trusted && !demoMode && !window.confirm(`Check these connection details before continuing:\n\nConnection: ${connectionLabel}\nServer: ${connection.host}\nDatabase: ${connection.database}\nUser: ${connection.username}\nAccess: read-only\n\nAllow read-only access so you can run queries?`)) return;
        await post(`/connections/${encodeURIComponent(connection.id)}/trust`, { trusted: !trusted, confirmation: connection.id });
        await onRefreshConnections();
        setNotice(demoMode ? 'Sample data is ready. You can explore the workspace.' : trusted ? 'Read-only access was turned off.' : 'Connection is ready for read-only queries.');
    }, 'save');
    trustActionRef.current = trustConnection;

    const sortedHistory = useMemo(() => [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [history]);
    const savedDocument = documents.find(document => document.id === active.serverId);
    const saveStatus = draftSaveStatus(active, connection.id, savedDocument, { saving: Boolean(savingDraftIds[active.id]), pending: !documentsLoaded, readError: documentsReadError });
    const statementCount = safeStatementCount(active.sql);
    const runSourceSql = run && run.sourceFrom !== undefined && run.sourceTo !== undefined && run.sourceTo <= active.sql.length
        ? active.sql.slice(run.sourceFrom, run.sourceTo)
        : safeSelectedStatement(active.sql, active.from, active.to)?.sql;
    const staleResult = Boolean(run && (!runSourceSql || run.connectionId !== connection.id || !matchesDraft(run, runSourceSql, active.parameters)));
    const columnsByTable = useMemo(() => indexSchemaColumns(schema?.columns ?? []), [schema]);
    const filteredTables = useMemo(() => filterSchemaTables(schema?.tables ?? [], columnsByTable, search), [schema, columnsByTable, search]);
    const saveStatusLabel = ({
        local: 'Local draft', checking: 'Checking save…', saving: 'Saving…', saved: `Saved r${active.baseRevision}`,
        changed: 'Unsaved changes', conflict: 'Newer revision available', deleted: 'Saved file in trash', unavailable: 'Save status unavailable',
    } as const)[saveStatus.state];
    const visibleResultsView = experience === 'beginner' && view === 'insights' ? 'results' : view;
    const openDocument = (document: QueryDocument) => {
        addDraft(draftFromDocument(document));
    };
    const inspectorProps = {
        inspector,
        setInspector: showInspector,
        connection,
        schema,
        schemaLoading,
        schemaError,
        search,
        setSearch,
        tables: filteredTables,
        columnsByTable,
        history: sortedHistory,
        documents,
        run,
        profile,
        pipeline,
        onRefreshSchema: () => void loadSchema(),
        onRefreshHistory: () => void loadHistory(),
        onInsert: (value: string) => editor.current?.insert(value),
        onOpenImport: () => setImportOpen(true),
        onOpenRun: openRun,
        onOpenDocument: openDocument,
        onLoadProfile: () => void perform(loadProfile, 'save'),
        onLoadPipeline: () => void perform(loadPipeline, 'save'),
        onOpenGraph: () => { setView('insights'); setDrawerOpen(false); },
        connectionId: connection.id,
        sql: active.sql,
        trusted,
        runId: run?.id,
        onRefreshDocuments: () => void loadDocuments(),
        assistantAction,
        onAssistantAction: (value: AssistantAction) => { setAssistantAction(value); setAssistantContext(undefined); setAssistantProposal(undefined); },
        assistantQuestion,
        onAssistantQuestion: changeAssistantQuestion,
        assistantContext,
        assistantProposal,
        assistantBusy,
        assistantError,
        nativeParserStatus,
        nativeParseSnapshot,
        onRetryParser: () => editor.current?.retryNativeParser(),
        includeResult,
        onIncludeResult: setIncludeResult,
        onVoiceInput: startVoiceInput,
        voiceListening,
        voiceError,
        onPreview: () => void prepareAssistantContext(experience === 'beginner' ? 'generate' : undefined),
        onRequestProposal: () => void requestAssistantProposal(),
        onDecideProposal: (decision: 'accepted' | 'rejected') => void decideAssistantProposal(decision),
        onRunQuery: () => void execute(),
        runDisabled: !trusted || Boolean(busy),
        expert: experience === 'expert',
    } satisfies InspectorPaneProps;

    return <div className={cx('workspace-root', experience === 'expert' && 'is-expert', experience === 'beginner' && 'is-beginner')}>
        {error && <div className="toast toast-error animate-enter" role="alert"><span>!</span>{error}<button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close"/></button></div>}
        {notice && <div className="toast toast-success animate-enter" role="status"><span>✓</span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><Icon name="close"/></button></div>}
        {storageError && <div className="toast toast-error" role="alert">Local draft storage could not save changes: {storageError}</div>}

        <div className="workspace-layout">
            <aside className="icon-rail" aria-label="Workspace tools">
                <span className="rail-separator"/>
                <RailButton icon="schema" label={experience === 'beginner' ? 'Tables' : copy.common.schema} active={inspector === 'schema' && drawerOpen} onClick={() => showInspector('schema')}/>
                {experience === 'expert' && <>
                    <RailButton icon="history" label={copy.common.history} active={inspector === 'history' && drawerOpen} onClick={() => showInspector('history')}/>
                    <RailButton icon="documents" label="Documents" active={inspector === 'documents' && drawerOpen} onClick={() => showInspector('documents')}/>
                </>}
                <span className="rail-spacer"/>
                {experience === 'expert' && <RailButton icon="assistant" label={copy.common.assistant} accent active={inspector === 'assistant'} onClick={() => showInspector('assistant')}/>}
                {experience === 'expert' && <><RailButton icon="details" label="Run details" active={inspector === 'details'} onClick={() => showInspector('details')}/><RailButton icon="pipeline" label="Pipeline" active={inspector === 'pipeline'} onClick={() => showInspector('pipeline')}/></>}
                {experience === 'expert' && <RailButton icon="parser" label="Parser" active={inspector === 'parser'} onClick={() => showInspector('parser')}/>}
                {experience === 'expert' && <><span className="rail-separator"/><button className="rail-icon-button rail-icon-muted" type="button" title="Export local drafts" onClick={() => download('clickstudio-local-drafts.json', workspace)}><Icon name="settings"/></button></>}
            </aside>

            {experience === 'expert' && <InspectorPane {...inspectorProps}/>}

            <main className="workspace-main">
                <div className="document-tabs" role="tablist" aria-label="SQL documents">
                    {workspace.tabs.map((draft, index) => <div key={draft.id} id={`document-tab-${draft.id}`} className={cx('document-tab', draft.id === active.id && 'is-active')} role="tab" aria-selected={draft.id === active.id} aria-controls="sql-document-panel" tabIndex={draft.id === active.id ? 0 : -1} onClick={() => setWorkspace(current => ({ ...current, activeId: draft.id }))} onKeyDown={event => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setWorkspace(current => ({ ...current, activeId: draft.id }));
                            return;
                        }
                        let nextIndex: number | undefined;
                        if (event.key === 'ArrowRight') nextIndex = (index + 1) % workspace.tabs.length;
                        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + workspace.tabs.length) % workspace.tabs.length;
                        else if (event.key === 'Home') nextIndex = 0;
                        else if (event.key === 'End') nextIndex = workspace.tabs.length - 1;
                        if (nextIndex === undefined) return;
                        event.preventDefault();
                        const nextDraft = workspace.tabs[nextIndex]!;
                        setWorkspace(current => ({ ...current, activeId: nextDraft.id }));
                        window.requestAnimationFrame(() => document.getElementById(`document-tab-${nextDraft.id}`)?.focus());
                    }}>
                        <span className="document-tab-name">{draft.name}</span>{(() => {
                            const status = draftSaveStatus(draft, connection.id, documents.find(document => document.id === draft.serverId), {
                                saving: Boolean(savingDraftIds[draft.id]), pending: !documentsLoaded, readError: documentsReadError,
                            });
                            const unsaved = ['local', 'changed', 'conflict', 'deleted', 'unavailable'].includes(status.state);
                            return unsaved ? <span className="tab-unsaved" title={status.label} aria-hidden="true"/> : null;
                        })()}<button type="button" aria-label={`Close ${draft.name}`} onClick={event => { event.stopPropagation(); setWorkspace(current => closeDraft(current, draft.id)); }}>×</button>
                    </div>)}
                    <button className="new-tab-button" type="button" title="New SQL tab" onClick={() => addDraft(newDraft())}><Icon name="plus"/></button>
                    {!!workspace.closedTabs?.length && <button className="new-tab-button reopen-tab-button" type="button" aria-label="Reopen closed tab" title="Reopen closed tab" onClick={() => {
                        if (workspaceRef.current.tabs.length >= MAX_TABS) { setError(`Close a tab before reopening another. This workspace supports ${MAX_TABS} open drafts.`); return; }
                        setWorkspace(current => reopenDraft(current));
                    }}>↶</button>}
                    <div className="tabs-spacer"/>
                    <span className="draft-status" data-save-state={saveStatus.state} title={`${saveStatus.label}. ${saveStatus.detail}`}><span className={cx('status-light', saveStatus.state === 'saved' ? 'is-trusted' : ['changed', 'conflict', 'deleted', 'unavailable'].includes(saveStatus.state) ? 'is-warning' : '')}/>{saveStatusLabel}</span>
                </div>

                <div id="sql-document-panel" role="tabpanel" aria-labelledby={`document-tab-${active.id}`} tabIndex={0} className={cx('workspace-content', experience === 'beginner' && 'beginner-workspace-content', run && 'has-run')}>
                    <section className="editor-surface">
                        <div className="editor-heading">
                            <div className="editor-file-heading"><span className="file-type-icon">SQL</span><label className="document-name"><span className="eyebrow">QUERY</span><input aria-label="SQL document name" value={active.name} onChange={event => patch({ name: event.target.value })}/></label><span className="edit-indicator" title={active.serverId ? `Saved revision ${active.baseRevision}` : 'Only in this browser'}>{active.serverId ? `REV ${active.baseRevision}` : 'LOCAL'}</span></div>
                            <div className="editor-heading-actions">{experience === 'expert' && <>{nativeParserStatus === 'unavailable' && <><span className="toolbar-small" role="status" title="Formatting remains available while the native parser is unavailable.">Parser unavailable</span><Button variant="ghost" className="toolbar-small" onClick={() => editor.current?.retryNativeParser()}>Retry parser</Button></>}<Button variant="ghost" className="toolbar-small" title={nativeParserStatus === 'ready' ? 'Format with the native ClickHouse parser' : 'Format SQL'} onClick={() => void formatActiveSql()}>Format</Button></>}</div>
                        </div>
                        <div className="editor-toolbar">
                            <div className="editor-mode-label"><span className="editor-language-dot"/>ClickHouse SQL<span className="toolbar-divider"/><span>{statementCount === undefined ? 'Incomplete SQL' : `${statementCount} statement${statementCount === 1 ? '' : 's'}`}</span>{experience === 'expert' && nativeParserStatus === 'ready' && <><span className="toolbar-divider"/><span title="Syntax checks and formatting run locally in a Web Worker using ClickHouse's native parser.">Native parser</span></>}</div>
                            <div className="editor-actions">
                                {experience === 'expert' ? <>
                                    <Button variant="ghost" className="sql-ai-button" aria-pressed={inspector === 'assistant'} onClick={() => showInspector('assistant')}><Icon name="assistant"/>SQL AI</Button>
                                    <Button variant="secondary" className="save-revision-button" aria-label={copy.common.saveRevision} onClick={() => void saveDraft()} disabled={Boolean(busy)}><Icon name="documents"/>{copy.common.save}</Button>
                                    <RunActionMenu runLabel={copy.common.runStatement} running={busy === 'run' || busy === 'script'} disabled={!trusted || Boolean(busy)} onRun={() => void execute()} actions={[
                                        { label: 'Run script', shortcut: '⌘ ⇧ ↵', disabled: !trusted || Boolean(busy) || !connection.manifest?.scripts.available, title: connection.manifest?.scripts.reason, onSelect: () => void execute(true) },
                                        { label: 'EXPLAIN', disabled: !trusted || Boolean(busy) || !connection.manifest?.explain.available, title: connection.manifest?.explain.reason, onSelect: () => void execute(false, 'explain') },
                                        { label: 'EXPLAIN PIPELINE', disabled: !trusted || Boolean(busy) || !connection.manifest?.pipeline.available, title: connection.manifest?.pipeline.reason, onSelect: () => void execute(false, 'pipeline') },
                                    ]}/>
                                </> : <>
                                    <Button variant="ghost" className="sql-ai-button" aria-label="Ask AI" onClick={() => showInspector('assistant')}><Icon name="assistant"/>Ask AI</Button>
                                    <Button variant="secondary" className="save-revision-button" aria-label="Save query" onClick={() => void saveDraft()} disabled={Boolean(busy)}><Icon name="documents"/>Save</Button>
                                    <Button variant="primary" className="run-query-button" aria-label="Run query" onClick={() => void execute()} disabled={!trusted || Boolean(busy)}><Icon name="play"/>{busy === 'run' ? 'Running…' : 'Run'}<kbd>⌘ ↵</kbd></Button>
                                </>}
                            </div>
                        </div>
                        {experience === 'beginner' && !trusted && <div className="beginner-connection-notice" role="status"><span>{demoMode ? 'Start the sample workspace to run this query.' : 'Review this connection before running SQL.'}</span><Button variant="secondary" className="toolbar-small" onClick={() => void trustActionRef.current()}>{demoMode ? 'Start exploring' : 'Review connection'}</Button></div>}
                        <div className="editor-frame"><SqlEditor key={active.id} ref={editor} value={active.sql} from={active.from} to={active.to} schema={trusted ? schema : undefined} dark={dark} parserStatus={nativeParserStatus} error={run?.error && (run.sql === active.sql || run.sql === safeSelectedStatement(active.sql, active.from, active.to)?.sql) ? run.error : undefined} onChange={sql => patch({ sql })} onSelection={(from, to) => patch({ from, to })} onRun={wholeScript => void execute(wholeScript)} onNativeParserStatus={setNativeParserStatus} onNativeParseSnapshot={snapshot => setNativeParseSnapshot(snapshot)}/></div>
                        {parameters.length > 0 && <div className="parameters-row"><div className="parameters-label"><span>INPUTS</span><strong>Query parameters</strong><small>Values are bound separately from the SQL text.</small></div>{parameters.map(parameter => <label className="parameter-field" key={parameter.name}><span>{parameter.name}<code>:{parameter.type}</code></span><input value={active.parameters[parameter.name] ?? ''} placeholder="Enter value" onChange={event => patch({ parameters: { ...active.parameters, [parameter.name]: event.target.value } })}/></label>)}<span className="parameter-count">{parameters.filter(parameter => Boolean(active.parameters[parameter.name]?.trim())).length} / {parameters.length} ready</span></div>}
                        <div className="editor-footer"><span><span className="key-hint">⌘↵</span> {experience === 'beginner' ? 'Run query' : <>Run current statement <span className="footer-dot">·</span> <span className="key-hint">⌘⇧↵</span> Run script</>}</span>{experience === 'expert' && <span>{active.sql.length.toLocaleString()} characters <span className="footer-dot">·</span> {active.sql.split('\n').length} lines</span>}</div>
                    </section>

                    {run && <section className={cx('results-surface', experience === 'expert' && 'results-expert')} aria-label="Query results">
                        <div className="results-header">
                            <div className="results-title"><span className="results-mark"><Icon name="chart"/></span><div><span className="eyebrow">WORKSPACE OUTPUT</span><h2>{copy.common.results}</h2></div>{run && <Status run={run}/>}</div>
                            <div className="results-actions">
                                <div className="results-tabs" role="tablist" aria-label="Result views">{(experience === 'beginner' ? ['results', 'chart'] as const : ['results', 'chart', 'insights'] as const).map(tab => <button key={tab} role="tab" aria-selected={visibleResultsView === tab} type="button" onClick={() => { setView(tab); if (tab === 'chart') void perform(loadSnapshot, 'save'); if (tab === 'insights') void perform(loadProfile, 'save'); }}>{tab === 'results' ? copy.common.results : tab === 'chart' ? copy.common.chart : copy.common.insights}{tab === 'chart' && snapshot && <span className="suggested-dot"/>}</button>)}</div>
                                {run?.resultState === 'reopenable' && <Button variant="ghost" className="toolbar-small" onClick={() => { const link = document.createElement('a'); link.href = `/api/runs/${encodeURIComponent(run.id)}/export?format=csv`; link.download = `${run.queryId}.csv`; link.click(); }}>Export <Icon name="chevron"/></Button>}
                            </div>
                        </div>
                        {staleResult && <div className="result-provenance" aria-live="polite"><span className="status-light is-warning"/><span><strong>Result from previous execution</strong><small>SQL or bound parameters changed since this run. Rerun to refresh the result.</small></span></div>}
                        {script && <ScriptResults script={script} runs={history} activeRunId={run?.id} onSelectRun={runId => {
                            if (active.scriptId) scriptFollowRef.current = { scriptId: active.scriptId, enabled: false };
                            update(active.id, draft => ({ ...draft, activeRunId: runId }));
                            setPage(0); setView('results');
                        }} onCancel={() => void cancel()} cancelDisabled={cancelling}/>}
                        {run && visibleResultsView === 'results' && <ResultGrid key={run.id} run={run} page={resultPage} pageIndex={page} loading={!resultPage && run.resultState === 'reopenable'} onPage={setPage}/>}
                        {run && visibleResultsView === 'chart' && <ChartView result={snapshot} loading={!snapshot && run.resultState === 'reopenable'} chart={active.chart} onChart={chart => patch({ chart })}/>}
                        {run && visibleResultsView === 'insights' && <InsightsView run={run} profile={profile} pipeline={pipeline} pipelineAvailable={Boolean(trusted && connection.manifest?.pipeline.available)} onLoad={() => void perform(loadProfile, 'save')} onLoadPipeline={() => void perform(loadPipeline, 'save')} loading={busy === 'save'}/>}
                    </section>}
                </div>
            </main>

            {drawerOpen && (experience === 'beginner' || compactViewport) && <><button className="drawer-backdrop" type="button" aria-label="Close panel" onClick={() => setDrawerOpen(false)}/><InspectorPane {...inspectorProps} drawer onClose={() => setDrawerOpen(false)} onInsert={value => { editor.current?.insert(value); setDrawerOpen(false); }} onOpenDocument={document => { openDocument(document); setDrawerOpen(false); }}/></>}
        </div>
        <ImportWizard open={importOpen} connectionId={connection.id} trusted={trusted} demoMode={demoMode} onClose={() => setImportOpen(false)} onImported={() => { void loadSchema(); setNotice('Import complete. The destination schema was refreshed.'); }}/>
        {run && <ExecutionBar run={run} eventState={eventState} onCancel={() => void cancel()} cancelling={cancelling} scriptRunning={script?.status === 'running'}/>}
    </div>;
}
