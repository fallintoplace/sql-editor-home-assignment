import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ApiError, AssistantAction, ProfilePipeline, Proposal, QueryDocument, QueryProfile, Result, Run, RunKind, Schema, Script } from '../shared/types';
import { DEFAULT_LIMITS } from '../shared/types';
import { parseExplainPlan } from '../shared/explain-plan';
import { parseExplainIndexAnalysis } from '../shared/explain-indexes';
import { parsePipelineResult } from '../shared/profile';
import { exportCsv, recommendChart } from '../shared/results';
import { matchesDraft } from '../shared/evidence';
import { formatSql, hasSqlComments, parameterNames, selectedStatement, splitSql } from '../shared/sql';
import { api, download, isFrontendDemoPreview, message, post, RequestError } from './api';
import { DEMO_PREVIEW_INITIAL_STARTERS, DEMO_PREVIEW_SQL, DEMO_PREVIEW_STARTER_DOCUMENT_ID, demoPreviewStarterRunId, PLAYGROUND_PREVIEW_STARTER } from './demo-preview';
import { PLAYGROUND_CONNECTION_ID } from './playground';
import { SqlEditor, type EditorHandle } from './components/SqlEditor';
import { ImportWizard } from './components/ImportWizard';
import { SqlExamplesMenu } from './components/SqlExamplesMenu';
import { HelpExamplesButton } from './components/HelpExamplesButton';
import { RestoreSqlMenu } from './components/RestoreSqlMenu';
import { OverlayPortal } from './components/OverlayPortal';
import { ChartView, InsightsView, ResultGrid } from './components/ResultViews';
import { ExplainPlanView } from './components/ExplainPlanView';
import { ExplainIndexesView } from './components/ExplainIndexesView';
import { PipelineGraph } from './components/PipelineGraph';
import { SqlFlowView } from './components/SqlFlowView';
import { InspectorPane, type InspectorPaneProps } from './components/InspectorPane';
import { Button, cx, Icon, Status, terminal } from './components/ui';
import { ExecutionBar, RailButton, RunActionGroup, ScriptResults } from './components/WorkspaceChrome';
import { checkpoint, closeDraft, draftFromDocument, MAX_TABS, newDraft, recover, reopenDraft, SAMPLE_SQL, type Draft, type WorkspaceState } from './workspace-state';
import { draftSaveStatus, rememberRunIds, sameSavedContent } from '../shared/workspace-view';
import type { NativeParseSnapshot, NativeParserStatus } from '../shared/native-parser';
import { useWorkspacePersistence } from './useWorkspacePersistence';
import { useRunEvidence } from './useRunEvidence';
import { useResultSnapshot } from './useResultSnapshot';
import { useScriptExecution } from './useScriptExecution';
import { useScopedValue } from './useScopedValue';
import { sqlExamplesFor, type SqlExample } from './sql-examples';
import { localizeSqlExample } from './sql-examples-locales';
import { sqlErrorRangeInDraft, type SqlErrorRange } from './sql-error';
import type { Copy, ExperienceLevel, Locale } from './i18n';
import type { AssistantContext, BusyAction, Connected, Inspector, ResultsView, SpeechRecognitionLike } from './workspace-types';
import {
    WORKSPACE_LAYOUT_STORAGE_KEY,
    clampPanelSplitRatio,
    movePanelGeometry,
    normalizeWorkspacePanelLayout,
    recoverWorkspacePanelLayout,
    resizePanelGeometry,
    type PanelGeometry,
    type PanelResizeEdge,
    type WorkspacePanelId,
    type WorkspacePanelMode,
} from './workspace-layout';

const stateKey = (connectionId: string) => `clickstudio:workspace:${connectionId}:v1`;
function safeSelectedStatement(sql: string, from: number, to: number) {
    try { return selectedStatement(sql, from, to); } catch { return undefined; }
}
function safeStatementCount(sql: string) {
    try { return splitSql(sql).length; } catch { return undefined; }
}
type FailedQueryError = { draftId: string; draftSql: string; statementSql: string; sourceFrom: number; error: ApiError };
type PanelPointerStartEvent = {
    clientX: number;
    clientY: number;
    target: EventTarget | null;
    preventDefault: () => void;
    stopPropagation: () => void;
};

const PANEL_RESIZE_EDGES: readonly PanelResizeEdge[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const panelViewport = () => ({ width: window.innerWidth, height: window.innerHeight });
const panelTargetIsInteractive = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('button, input, select, textarea, a, [role="tab"], [role="button"]'));

function PanelResizeHandles({ onResize }: { onResize: (edge: PanelResizeEdge, event: PanelPointerStartEvent) => void }) {
    return <>{PANEL_RESIZE_EDGES.map(edge =>
        <span
            key={edge}
            aria-hidden="true"
            className={`workspace-panel-resize-handle edge-${edge}`}
            data-edge={edge}
            onPointerDown={event => onResize(edge, event)}
        />)}</>;
}
function apiErrorDetail(error: unknown): ApiError {
    if (error instanceof RequestError) return error.detail;
    const candidate = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : undefined;
    return {
        code: typeof candidate?.code === 'string' ? candidate.code : 'EXECUTION_FAILED',
        message: typeof candidate?.message === 'string' ? candidate.message : message(error),
    };
}
function assistantContextKey(connectionId: string, draftId: string, sql: string, parameters: Record<string, string>, runId: string | undefined, includeResult: boolean, action: AssistantAction, question: string) {
    return JSON.stringify({ connectionId, draftId, sql, parameters: Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right)), runId, includeResult, action, question });
}
function previewStarterDraft(starter: typeof DEMO_PREVIEW_INITIAL_STARTERS[number]): Draft {
    const runId = demoPreviewStarterRunId(starter.id);
    return {
        ...newDraft(starter.name, starter.sql), serverId: starter.id, baseRevision: starter.revision ?? 1,
        chart: { ...starter.chart, ys: [...starter.chart.ys] }, runIds: [runId], activeRunId: runId,
    };
}

type WorkspaceProps = {
    connection: Connected;
    connectionLabel: string;
    connections: Connected[];
    onSelectConnection: (id: string) => void;
    onRefreshConnections: () => Promise<void>;
    trustActionRef: { current: () => Promise<void> };
    testConnectionActionRef: { current: () => Promise<void> };
    demoMode: boolean;
    experience: ExperienceLevel;
    nativeParserEnabled: boolean;
    dark: boolean;
    copy: Copy;
    locale: Locale;
};

export function Workspace({ connection, connectionLabel, connections, onSelectConnection, onRefreshConnections, trustActionRef, testConnectionActionRef, demoMode, experience, nativeParserEnabled, dark, copy, locale }: WorkspaceProps) {
    const key = stateKey(connection.id);
    const [workspace, setWorkspace] = useState<WorkspaceState>(() => {
        const recovered = recover(key);
        if (!isFrontendDemoPreview) return recovered;
        const activeId = recovered.tabs.find(tab => tab.id === recovered.activeId)?.id ?? recovered.tabs[0]!.id;
        const active = recovered.tabs.find(tab => tab.id === activeId)!;
        const isStarterDraft = active.name === 'Getting started.sql' &&
            (active.sql.trim() === SAMPLE_SQL.trim() || active.sql.trim() === DEMO_PREVIEW_SQL.trim()) &&
            (!active.serverId || active.serverId === DEMO_PREVIEW_STARTER_DOCUMENT_ID);
        if (!isStarterDraft || recovered.tabs.length !== 1 || recovered.closedTabs?.length) return recovered;
        if (connection.id === 'playground') {
            return {
                ...recovered,
                tabs: [{
                    ...active, name: PLAYGROUND_PREVIEW_STARTER.name, sql: PLAYGROUND_PREVIEW_STARTER.sql,
                    serverId: undefined, baseRevision: undefined, chart: { ...PLAYGROUND_PREVIEW_STARTER.chart, ys: [] },
                    runIds: [], activeRunId: undefined, scriptId: undefined, parentRunId: undefined,
                    parentDocumentId: undefined, kind: 'query', metric: undefined, dependencies: [],
                }],
            };
        }
        const gettingStarted = DEMO_PREVIEW_INITIAL_STARTERS[0]!;
        const runId = demoPreviewStarterRunId(gettingStarted.id);
        return {
            ...recovered,
            tabs: [
                {
                    ...active, sql: DEMO_PREVIEW_SQL,
                    serverId: DEMO_PREVIEW_STARTER_DOCUMENT_ID, baseRevision: gettingStarted.revision ?? 1,
                    chart: { ...gettingStarted.chart, ys: [...gettingStarted.chart.ys] },
                    activeRunId: runId, runIds: [...new Set([...active.runIds, runId])],
                },
                ...DEMO_PREVIEW_INITIAL_STARTERS.slice(1).map(previewStarterDraft),
            ],
        };
    });
    const [renamingTabId, setRenamingTabId] = useState<string>();
    const [tabRenameValue, setTabRenameValue] = useState('');
    const cancelTabRenameOnBlur = useRef(false);
    const workspaceRef = useRef(workspace);
    workspaceRef.current = workspace;
    const active = workspace.tabs.find(tab => tab.id === workspace.activeId) ?? workspace.tabs[0]!;
    const tabScrollerRef = useRef<HTMLDivElement>(null);
    const [tabScrollState, setTabScrollState] = useState({ overflow: false, canScrollLeft: false, canScrollRight: false });
    const tabLayoutKey = workspace.tabs.map(tab => `${tab.id}\u0000${tab.name}`).join('\u0001');
    const updateTabScrollState = useCallback(() => {
        const scroller = tabScrollerRef.current;
        if (!scroller) return;
        const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
        const next = {
            overflow: maxScrollLeft > 1,
            canScrollLeft: scroller.scrollLeft > 1,
            canScrollRight: scroller.scrollLeft < maxScrollLeft - 1,
        };
        setTabScrollState(current => current.overflow === next.overflow
            && current.canScrollLeft === next.canScrollLeft
            && current.canScrollRight === next.canScrollRight ? current : next);
    }, []);
    const scrollTabs = useCallback((direction: -1 | 1) => {
        const scroller = tabScrollerRef.current;
        if (!scroller) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        scroller.scrollBy({
            left: direction * Math.max(180, scroller.clientWidth * 0.65),
            behavior: reducedMotion ? 'auto' : 'smooth',
        });
        if (reducedMotion) window.requestAnimationFrame(updateTabScrollState);
    }, [updateTabScrollState]);
    useEffect(() => {
        const handleResize = () => updateTabScrollState();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateTabScrollState]);
    useEffect(() => {
        const frame = window.requestAnimationFrame(updateTabScrollState);
        return () => window.cancelAnimationFrame(frame);
    }, [tabLayoutKey, updateTabScrollState]);
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const scroller = tabScrollerRef.current;
            const tab = document.getElementById(`document-tab-${active.id}`);
            if (!scroller || !tab) return;
            const scrollerRect = scroller.getBoundingClientRect();
            const tabRect = tab.getBoundingClientRect();
            if (tabRect.left < scrollerRect.left)
                scroller.scrollBy({ left: tabRect.left - scrollerRect.left - 6 });
            else if (tabRect.right > scrollerRect.right)
                scroller.scrollBy({ left: tabRect.right - scrollerRect.right + 6 });
            updateTabScrollState();
        });
        return () => window.cancelAnimationFrame(frame);
    }, [active.id, active.name, updateTabScrollState]);
    const activeRunId = active.activeRunId;
    const activeRunIdRef = useRef(activeRunId);
    activeRunIdRef.current = activeRunId;
    const editor = useRef<EditorHandle>(null);
    const [nativeParserStatus, setNativeParserStatus] = useState<NativeParserStatus>('loading');
    const [nativeParseSnapshot, setNativeParseSnapshot] = useState<NativeParseSnapshot>();
    const [schema, setSchema] = useState<Schema>();
    const sqlExamples = useMemo(() => sqlExamplesFor(connection, schema), [connection, schema]);
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [schemaError, setSchemaError] = useState('');
    const [documents, setDocuments] = useState<QueryDocument[]>([]);
    const [documentsLoaded, setDocumentsLoaded] = useState(false);
    const [documentsReadError, setDocumentsReadError] = useState(false);
    const [documentRevisions, setDocumentRevisions] = useState<QueryDocument[]>([]);
    const [revisionsDocumentId, setRevisionsDocumentId] = useState<string>();
    const [revisionLoading, setRevisionLoading] = useState(false);
    const [revisionError, setRevisionError] = useState('');
    const [savingDraftIds, setSavingDraftIds] = useState<Record<string, boolean>>({});
    const [history, setHistory] = useState<Run[]>([]);
    const [scripts, setScripts] = useState<Record<string, Script>>({});
    const script = active.scriptId ? scripts[active.scriptId] : undefined;
    const [view, setView] = useState<ResultsView>('results');
    const [exampleChartRunId, setExampleChartRunId] = useState<string>();
    const [queryCollapsed, setQueryCollapsed] = useState(false);
    const [resultsCollapsed, setResultsCollapsed] = useState(false);
    const [panelLayout, setPanelLayout] = useState(() => {
        let stored: string | null = null;
        try { stored = window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY); } catch {}
        return recoverWorkspacePanelLayout(stored, panelViewport());
    });
    const [activeFloatingPanel, setActiveFloatingPanel] = useState<WorkspacePanelId>('query');
    const queryPanelRef = useRef<HTMLElement>(null);
    const resultsPanelRef = useRef<HTMLElement>(null);
    const workspaceContentRef = useRef<HTMLDivElement>(null);
    const [inspector, setInspector] = useState<Inspector>('schema');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [compactViewport, setCompactViewport] = useState(() => window.matchMedia('(max-width: 850px)').matches);
    const [importOpen, setImportOpen] = useState(false);
    const [examplesOpen, setExamplesOpen] = useState(false);
    const examplesOpenerRef = useRef<HTMLButtonElement | null>(null);
    const openExamples = useCallback((opener: HTMLButtonElement) => {
        examplesOpenerRef.current = opener;
        setExamplesOpen(true);
    }, []);
    const closeExamples = useCallback((restoreFocus = true) => {
        setExamplesOpen(false);
        if (restoreFocus) window.requestAnimationFrame(() => examplesOpenerRef.current?.focus());
    }, []);
    const [busy, setBusy] = useState<BusyAction>('');
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState('');
    const [failedQueryError, setFailedQueryError] = useState<FailedQueryError>();
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
    const unsupportedParameters = parameters.length > 0 && connection.manifest?.parameters.available === false;
    const runActionTitle = (capability: { available: boolean; reason?: string } | undefined, action: 'script' | 'explain' | 'explain-plan' | 'explain-pipeline') => {
        if (!trusted) return copy.common.runActionTrustRequired;
        if (busy) return copy.common.runActionWait;
        if (unsupportedParameters) return copy.common.runActionRemoveParameters;
        if (capability?.available === false) {
            if (action === 'script' && connection.id === PLAYGROUND_CONNECTION_ID) return copy.common.playgroundScriptUnavailable;
            return capability.reason;
        }
        return undefined;
    };
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
    useEffect(() => {
        try { window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(panelLayout)); } catch {}
    }, [panelLayout]);
    useEffect(() => {
        const normalize = () => setPanelLayout(current => normalizeWorkspacePanelLayout(current, panelViewport()));
        window.addEventListener('resize', normalize);
        return () => window.removeEventListener('resize', normalize);
    }, []);
    const trustedRef = useRef(trusted);
    trustedRef.current = trusted;
    const schemaRequestRef = useRef(0), historyRequestRef = useRef(0), documentsRequestRef = useRef(0), revisionsRequestRef = useRef(0);
    const invalidateWorkspaceRequests = useCallback(() => {
        schemaRequestRef.current++;
        historyRequestRef.current++;
        documentsRequestRef.current++;
        revisionsRequestRef.current++;
    }, []);
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
    const beginTabRename = (draft: Draft) => {
        cancelTabRenameOnBlur.current = false;
        setTabRenameValue(draft.name);
        setRenamingTabId(draft.id);
    };
    const finishTabRename = (draftId: string, value: string, restoreFocus = false) => {
        if (cancelTabRenameOnBlur.current) {
            cancelTabRenameOnBlur.current = false;
        } else {
            const name = value.trim();
            if (name) update(draftId, draft => draft.name === name ? draft : { ...draft, name });
        }
        setRenamingTabId(current => current === draftId ? undefined : current);
        if (restoreFocus) window.requestAnimationFrame(() => document.getElementById(`document-tab-${draftId}`)?.focus());
    };
    const cancelTabRename = (draftId: string) => {
        cancelTabRenameOnBlur.current = true;
        setRenamingTabId(current => current === draftId ? undefined : current);
        window.requestAnimationFrame(() => document.getElementById(`document-tab-${draftId}`)?.focus());
    };
    const formatActiveSql = useCallback(async (formatter: 'wasm' | 'builtin') => {
        const draftId = active.id, sourceSql = active.sql;
        const applyBuiltIn = () => setWorkspace(current => current.activeId !== draftId ? current : ({ ...current,
            tabs: current.tabs.map(draft => draft.id === draftId && draft.sql === sourceSql ? { ...draft, sql: formatSql(sourceSql) } : draft),
        }));
        if (formatter === 'builtin') {
            applyBuiltIn();
            return;
        }
        if (!nativeParserEnabled || nativeParserStatus !== 'ready') return;
        const result = await editor.current?.formatNative();
        if (result === 'unavailable' || result === 'fallback')
            applyBuiltIn();
    }, [active.id, active.sql, nativeParserEnabled, nativeParserStatus]);

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
                setWorkspace(current => ({
                    ...current,
                    tabs: current.tabs.map(draft => {
                        const saved = next.find(document => document.id === draft.serverId);
                        return saved && draft.baseRevision !== saved.revision && sameSavedContent(draft, saved)
                            ? { ...draft, baseRevision: saved.revision }
                            : draft;
                    }),
                }));
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
    const loadDocumentRevisions = useCallback(async (documentId = active.serverId) => {
        if (!documentId) {
            revisionsRequestRef.current++;
            setRevisionsDocumentId(undefined);
            setDocumentRevisions([]);
            setRevisionError('Save this query before opening version history.');
            setRevisionLoading(false);
            return;
        }
        const requestId = ++revisionsRequestRef.current;
        setRevisionsDocumentId(documentId);
        setDocumentRevisions([]);
        setRevisionError('');
        setRevisionLoading(true);
        try {
            const next = await api<QueryDocument[]>(`/documents/${encodeURIComponent(documentId)}/revisions`);
            const currentDraft = workspaceRef.current.tabs.find(draft => draft.id === workspaceRef.current.activeId);
            if (revisionsRequestRef.current === requestId && currentDraft?.serverId === documentId)
                setDocumentRevisions([...next].sort((left, right) => right.revision - left.revision));
        } catch (caught) {
            if (revisionsRequestRef.current === requestId) setRevisionError(message(caught));
        } finally {
            if (revisionsRequestRef.current === requestId) setRevisionLoading(false);
        }
    }, [active.serverId]);
    useEffect(() => {
        if (inspector === 'revisions') void loadDocumentRevisions(active.serverId);
    }, [active.serverId, inspector, loadDocumentRevisions]);
    const loadSchema = useCallback(async (refresh = false) => {
        const requestId = ++schemaRequestRef.current;
        if (!trustedRef.current) {
            setSchema(undefined);
            setSchemaError('');
            setSchemaLoading(false);
            return;
        }
        setSchemaLoading(true); setSchemaError('');
        try {
            const next = await api<Schema>(`/connections/${encodeURIComponent(connection.id)}/schema${refresh ? '?refresh=true' : ''}`);
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
        return () => { window.clearInterval(interval); invalidateWorkspaceRequests(); };
    }, [invalidateWorkspaceRequests, loadDocuments, loadHistory, loadSchema, trusted]);

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
    const openNewDraft = (draft: Draft) => {
        if (!addDraft(draft)) return false;
        setQueryCollapsed(false);
        return true;
    };

    const createExampleDraft = (example: SqlExample) => {
        const name = example.category === 'schema'
            ? copy.common.examplePreviewTable.replace('{table}', example.name.replace(/^Preview /, ''))
            : localizeSqlExample(example, locale).name;
        const draft = newDraft(`${name}.sql`, example.sql);
        draft.chart = { ...example.chart, title: locale === 'en' ? example.chart.title : name, ys: [...example.chart.ys], ...(example.chart.candlestick ? { candlestick: { ...example.chart.candlestick } } : {}) };
        return draft;
    };

    const runExample = (example: SqlExample, output: 'results' | 'chart') => {
        if (busy) { setError(copy.common.runActionWait); return true; }
        if (!trusted) { setError(copy.common.runActionTrustRequired); return true; }

        const draft = createExampleDraft(example);
        if (!openNewDraft(draft)) return true;
        void perform(async () => {
            const statements = splitSql(draft.sql);
            if (statements.length !== 1) throw new Error('An example must contain exactly one SQL statement to run directly.');
            const statement = statements[0]!;
            const created = await post<Run>('/runs', {
                clientRequestId: crypto.randomUUID(), connectionId: connection.id, documentId: draft.serverId,
                sql: statement.sql, parameters: draft.parameters, parentRunId: draft.parentRunId, kind: 'query',
                limits: { rows: connection.limits.rows || DEFAULT_LIMITS.rows, seconds: connection.limits.seconds || DEFAULT_LIMITS.seconds },
                tags: { workspace: 'clickstudio', experience }, sourceFrom: statement.from, sourceTo: statement.to,
            });
            setRunForRun(created.id, created, true);
            setPage(0);
            update(draft.id, current => ({ ...current, activeRunId: created.id, scriptId: undefined, runIds: rememberRunIds(current.runIds, [created.id]) }));
            setView(output);
            setResultsCollapsed(false);
            setDrawerOpen(false);
            setExampleChartRunId(output === 'chart' ? created.id : undefined);
            if (!isFrontendDemoPreview)
                setNotice(demoMode
                    ? 'Sample results were generated. Query SQL was not sent to ClickHouse.'
                    : 'Query submitted to the selected ClickHouse connection.');
            void loadHistory().catch(() => undefined);
        }, 'run');
        return true;
    };

    const execute = (wholeScript = false, kind: RunKind = 'query') => perform(async () => {
        if (!trusted) throw new Error('Review and trust this read only connection before running SQL.');
        if (wholeScript && connection.manifest?.scripts.available === false)
            throw new Error(connection.manifest.scripts.reason ?? 'Scripts are unavailable on this connection.');
        if (unsupportedParameters)
            throw new Error(connection.manifest?.parameters.reason ?? 'Query parameters are unavailable on this connection.');
        if (kind === 'explain' && connection.manifest?.explain.available === false)
            throw new Error(connection.manifest.explain.reason ?? 'EXPLAIN is unavailable on this connection.');
        const explainPlan = connection.manifest?.explainPlan ?? connection.manifest?.explain;
        if (kind === 'plan' && explainPlan?.available === false)
            throw new Error(explainPlan.reason ?? 'EXPLAIN PLAN is unavailable on this connection.');
        const explainPipeline = connection.manifest?.explainPipeline ?? connection.manifest?.pipeline;
        if (kind === 'pipeline' && explainPipeline?.available === false)
            throw new Error(explainPipeline.reason ?? 'EXPLAIN PIPELINE is unavailable on this connection.');
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
            setFailedQueryError(undefined);
            let created: Run;
            try {
                created = await post<Run>('/runs', payload);
            } catch (caught) {
                if (statement) setFailedQueryError({ draftId: active.id, draftSql: active.sql, statementSql: statement.sql, sourceFrom: statement.from, error: apiErrorDetail(caught) });
                throw caught;
            }
            setRunForRun(created.id, created, true);
            setPage(0); setView(kind === 'explain' ? 'indexes' : kind === 'plan' ? 'plan' : kind === 'pipeline' ? 'pipeline' : 'results');
            patch({ activeRunId: created.id, scriptId: undefined, runIds: [...new Set([...active.runIds, created.id])] });
            editor.current?.focus();
        }
        setDrawerOpen(false);
        if (!isFrontendDemoPreview)
            setNotice(demoMode
                ? wholeScript ? 'Sample results were generated. Script SQL was not sent to ClickHouse.' : 'Sample results were generated. Query SQL was not sent to ClickHouse.'
                : wholeScript ? 'Script submitted to the selected ClickHouse connection.' : 'Query submitted to the selected ClickHouse connection.');
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
        setView(selected.kind === 'plan' ? 'plan' : selected.kind === 'pipeline' ? 'pipeline' : 'results'); setDrawerOpen(false); setNotice(`Opened retained run ${selected.queryId}. No query was rerun.`);
    };

    const saveDraft = async () => perform(async () => {
        setSavingDraftIds(current => ({ ...current, [active.id]: true }));
        try {
            const payload = { name: active.name, sql: active.sql, connectionId: connection.id, baseRevision: active.baseRevision, parameters: active.parameters, chart: active.chart, runId: active.activeRunId, parentDocumentId: active.parentDocumentId, kind: active.kind, metric: active.metric, dependencies: active.dependencies };
            const saved = await api<QueryDocument>(active.serverId ? `/documents/${encodeURIComponent(active.serverId)}` : '/documents', { method: active.serverId ? 'PUT' : 'POST', body: payload });
            patch({ serverId: saved.id, baseRevision: saved.revision });
            setDocuments(current => [saved, ...current.filter(document => document.id !== saved.id)]);
            setNotice(`Saved ${saved.name} · revision ${saved.revision}`);
            if (active.serverId && inspector === 'revisions') void loadDocumentRevisions(saved.id);
        } finally { setSavingDraftIds(current => ({ ...current, [active.id]: false })); }
    }, 'save');

    const restoreDocumentRevision = (revision: QueryDocument) => void perform(async () => {
        const draft = workspaceRef.current.tabs.find(item => item.id === workspaceRef.current.activeId);
        if (!draft?.serverId || draft.serverId !== revision.id) throw new Error('Open the saved query before restoring one of its versions.');
        const latestSaved = revisionsDocumentId === draft.serverId ? documentRevisions[0] : documents.find(document => document.id === draft.serverId);
        if (!latestSaved || latestSaved.deletedAt) throw new Error('The latest saved version could not be checked. Refresh saved queries and try again.');
        const hasUnsavedChanges = draft.baseRevision !== latestSaved.revision || !sameSavedContent(draft, latestSaved);
        if (hasUnsavedChanges && !window.confirm(`Restore Version ${revision.revision}? This will replace the current unsaved draft. The restored SQL will be saved as a new version.`)) return;
        const restoreBase: QueryDocument = {
            ...latestSaved,
            name: draft.name,
            sql: draft.sql,
            parameters: { ...draft.parameters },
            chart: { ...draft.chart, ys: [...draft.chart.ys] },
            runId: draft.activeRunId,
            parentDocumentId: draft.parentDocumentId,
            kind: draft.kind,
            metric: draft.metric ? { ...draft.metric, dimensions: [...draft.metric.dimensions], sourceColumns: [...draft.metric.sourceColumns] } : undefined,
            dependencies: [...draft.dependencies],
        };
        const restored = await post<QueryDocument>(`/documents/${encodeURIComponent(draft.serverId)}/restore-revision`, {
            revision: revision.revision,
            baseRevision: latestSaved.revision,
        });
        const currentDraft = workspaceRef.current.tabs.find(item => item.id === draft.id);
        const editedDuringRestore = Boolean(currentDraft && !sameSavedContent(currentDraft, restoreBase));
        update(draft.id, current => editedDuringRestore ? { ...current, baseRevision: restored.revision } : ({
            ...checkpoint(current, `Before restoring Version ${revision.revision}`),
            name: restored.name,
            sql: restored.sql,
            baseRevision: restored.revision,
            parameters: { ...restored.parameters },
            chart: { ...restored.chart, ys: [...restored.chart.ys] },
            activeRunId: undefined,
            scriptId: undefined,
            parentRunId: undefined,
            parentDocumentId: restored.parentDocumentId,
            kind: restored.kind,
            metric: restored.metric ? { ...restored.metric, dimensions: [...restored.metric.dimensions], sourceColumns: [...restored.metric.sourceColumns] } : undefined,
            dependencies: [...restored.dependencies],
            from: 0,
            to: 0,
        }));
        setDocuments(current => [restored, ...current.filter(document => document.id !== restored.id)]);
        setNotice(editedDuringRestore
            ? `Restored Version ${revision.revision} as Version ${restored.revision}. Edits made during restore are still in your draft.`
            : `Restored Version ${revision.revision} as Version ${restored.revision}.`);
        await loadDocumentRevisions(restored.id);
    }, 'save');

    const loadSnapshot = useResultSnapshot({
        activeRunId, run, snapshot, setSnapshotForRun,
        onSnapshot: (runId, full) => {
            if (activeRunIdRef.current !== runId || workspaceRef.current.activeId !== active.id) return;
            const suggestion = recommendChart(full.columns, full.rows);
            if (active.chart.kind === 'table' && suggestion.config.kind !== 'table') patch({ chart: suggestion.config });
        },
    });

    useEffect(() => {
        if (!exampleChartRunId || exampleChartRunId !== activeRunId || run?.id !== exampleChartRunId || !terminal(run)) return;
        if (snapshot?.runId === exampleChartRunId || run.resultState !== 'reopenable') {
            setExampleChartRunId(undefined);
            return;
        }
        void loadSnapshot().catch(caught => setError(message(caught))).finally(() => {
            setExampleChartRunId(current => current === exampleChartRunId ? undefined : current);
        });
    }, [activeRunId, exampleChartRunId, loadSnapshot, run, setError, snapshot?.runId]);

    useEffect(() => {
        if (!run || !['chart', 'indexes', 'plan', 'pipeline'].includes(view) || !terminal(run) || run.resultState !== 'reopenable' || snapshot?.runId === run.id) return;
        void loadSnapshot().catch(caught => setError(message(caught)));
    }, [loadSnapshot, run, setError, snapshot?.runId, view]);

    const exportCurrentCsv = async () => {
        if (!run) return;
        try {
            if (isFrontendDemoPreview) {
                const full = snapshot?.runId === run.id ? snapshot : await api<Result>(`/runs/${encodeURIComponent(run.id)}/snapshot`);
                download(`${run.queryId}.csv`, exportCsv(full), 'text/csv;charset=utf-8');
                return;
            }
            const link = document.createElement('a');
            link.href = `/api/runs/${encodeURIComponent(run.id)}/export?format=csv`;
            link.download = `${run.queryId}.csv`;
            link.click();
        } catch (caught) {
            setError(message(caught));
        }
    };

    const loadProfile = async () => {
        if (!activeRunId) return;
        if (connection.manifest?.queryLog.available === false) return;
        const runId = activeRunId;
        const response = await api<QueryProfile>(`/runs/${encodeURIComponent(runId)}/profile`);
        setProfileForRun(runId, response);
    };

    const loadPipeline = async () => {
        if (!activeRunId) return;
        if (connection.manifest?.pipeline.available === false) return;
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

    const testConnection = () => perform(async () => {
        const tested = await post<Connected>(`/connections/${encodeURIComponent(connection.id)}/test`);
        await onRefreshConnections();
        setNotice(`Connection tested · ClickHouse ${tested.manifest?.serverVersion ?? 'server'}. Review the connection, then trust it to run queries.`);
    }, 'save');
    testConnectionActionRef.current = testConnection;

    const sortedHistory = useMemo(() => [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [history]);
    const savedDocument = documents.find(document => document.id === active.serverId);
    const saveStatus = draftSaveStatus(active, connection.id, savedDocument, { saving: Boolean(savingDraftIds[active.id]), pending: !documentsLoaded, readError: documentsReadError });
    const statementCount = safeStatementCount(active.sql);
    const runSourceSql = run && run.sourceFrom !== undefined && run.sourceTo !== undefined && run.sourceTo <= active.sql.length
        ? active.sql.slice(run.sourceFrom, run.sourceTo)
        : safeSelectedStatement(active.sql, active.from, active.to)?.sql;
    const selectedRunStatement = safeSelectedStatement(active.sql, active.from, active.to);
    const runErrorContext = run?.error && (run.sql === active.sql || run.sql === selectedRunStatement?.sql)
        ? { draftId: active.id, draftSql: active.sql, statementSql: run.sql, sourceFrom: run.sourceFrom ?? (run.sql === active.sql ? 0 : selectedRunStatement?.from ?? 0), error: run.error }
        : undefined;
    const requestErrorContext = failedQueryError?.draftId === active.id && failedQueryError.draftSql === active.sql ? failedQueryError : undefined;
    const editorErrorContext = requestErrorContext ?? runErrorContext;
    const editorErrorRange: SqlErrorRange | undefined = editorErrorContext
        ? sqlErrorRangeInDraft(active.sql, editorErrorContext.statementSql, editorErrorContext.sourceFrom, editorErrorContext.error)
        : undefined;
    const staleResult = Boolean(run && (!runSourceSql || run.connectionId !== connection.id || !matchesDraft(run, runSourceSql, active.parameters)));
    const saveStatusLabel = saveStatus.state === 'local' ? copy.common.localDraft : ({
        local: 'Local draft', checking: 'Checking save…', saving: 'Saving…', saved: `Saved r${active.baseRevision}`,
        changed: 'Unsaved changes', conflict: 'Newer revision available', deleted: 'Saved file in trash', unavailable: 'Save status unavailable',
    } as const)[saveStatus.state];
    const visibleResultsView = experience === 'beginner' && view === 'insights' ? 'results' : view;
    const queryMode = compactViewport ? 'docked' : panelLayout.query.mode;
    const resultsMode = compactViewport ? 'docked' : panelLayout.results.mode;
    const queryFloating = queryMode !== 'docked';
    const resultsFloating = resultsMode !== 'docked';

    const panelElement = (panel: WorkspacePanelId) => panel === 'query' ? queryPanelRef.current : resultsPanelRef.current;
    const applyPanelGeometry = (element: HTMLElement, geometry: PanelGeometry) => {
        element.style.left = `${geometry.x}px`;
        element.style.top = `${geometry.y}px`;
        element.style.width = `${geometry.width}px`;
        element.style.height = `${geometry.height}px`;
    };
    const panelStyle = (panel: WorkspacePanelId, mode: WorkspacePanelMode): CSSProperties | undefined => {
        if (mode === 'docked') return undefined;
        const zIndex = activeFloatingPanel === panel ? 480 : 470;
        if (mode === 'maximized') {
            return { left: 8, top: 8, width: 'calc(100vw - 16px)', height: 'calc(100dvh - 16px)', zIndex };
        }
        const geometry = panelLayout[panel].geometry;
        return { left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height, zIndex };
    };
    const setPanelExpanded = (panel: WorkspacePanelId) => {
        if (panel === 'query') setQueryCollapsed(false);
        else setResultsCollapsed(false);
    };
    const togglePanelFloating = (panel: WorkspacePanelId) => {
        if (compactViewport) return;
        setPanelExpanded(panel);
        setActiveFloatingPanel(panel);
        setPanelLayout(current => ({
            ...current,
            [panel]: {
                ...current[panel],
                mode: current[panel].mode === 'docked' ? 'floating' : 'docked',
            },
        }));
    };
    const togglePanelMaximized = (panel: WorkspacePanelId) => {
        if (compactViewport) return;
        setPanelExpanded(panel);
        setActiveFloatingPanel(panel);
        setPanelLayout(current => ({
            ...current,
            [panel]: {
                ...current[panel],
                mode: current[panel].mode === 'maximized' ? 'floating' : 'maximized',
            },
        }));
    };
    const beginPanelGeometryGesture = (
        panel: WorkspacePanelId,
        event: PanelPointerStartEvent,
        update: (start: PanelGeometry, dx: number, dy: number) => PanelGeometry,
    ) => {
        const element = panelElement(panel);
        if (!element || compactViewport || panelLayout[panel].mode !== 'floating') return;
        event.preventDefault();
        event.stopPropagation();
        setActiveFloatingPanel(panel);
        const start = panelLayout[panel].geometry;
        const startX = event.clientX;
        const startY = event.clientY;
        let latest = start;
        document.body.classList.add('is-workspace-panel-gesturing');
        const move = (pointer: PointerEvent) => {
            latest = update(start, pointer.clientX - startX, pointer.clientY - startY);
            applyPanelGeometry(element, latest);
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            document.body.classList.remove('is-workspace-panel-gesturing');
            setPanelLayout(current => ({ ...current, [panel]: { ...current[panel], geometry: latest } }));
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
    };
    const startPanelDrag = (panel: WorkspacePanelId, event: PanelPointerStartEvent) => {
        if (panelTargetIsInteractive(event.target)) return;
        beginPanelGeometryGesture(panel, event, (start, dx, dy) => movePanelGeometry(start, dx, dy, panelViewport()));
    };
    const startPanelResize = (panel: WorkspacePanelId, edge: PanelResizeEdge, event: PanelPointerStartEvent) => {
        beginPanelGeometryGesture(panel, event, (start, dx, dy) => resizePanelGeometry(start, edge, dx, dy, panelViewport()));
    };
    const canSplitPanels = Boolean((run || visibleResultsView === 'sqlmap')
        && queryMode === 'docked' && resultsMode === 'docked'
        && !queryCollapsed && !resultsCollapsed && !compactViewport);
    const workspaceLayoutStyle = canSplitPanels
        ? { '--query-panel-basis': `${panelLayout.splitRatio * 100}%` } as CSSProperties
        : undefined;
    const startPanelSplit = (event: PanelPointerStartEvent) => {
        const content = workspaceContentRef.current;
        if (!content || !canSplitPanels) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = content.getBoundingClientRect();
        const computed = getComputedStyle(content);
        const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
        const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
        const splitterHeight = 10;
        const top = rect.top + paddingTop;
        const usableHeight = Math.max(1, rect.height - paddingTop - paddingBottom - splitterHeight);
        let latest = panelLayout.splitRatio;
        document.body.classList.add('is-workspace-panel-gesturing');
        const move = (pointer: PointerEvent) => {
            latest = clampPanelSplitRatio((pointer.clientY - top) / usableHeight);
            content.style.setProperty('--query-panel-basis', `${latest * 100}%`);
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            document.body.classList.remove('is-workspace-panel-gesturing');
            setPanelLayout(current => ({ ...current, splitRatio: latest }));
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
    };
    const sqlMapStatement = safeSelectedStatement(active.sql, active.from, active.from);
    const sqlMapParseStatement = sqlMapStatement && nativeParseSnapshot?.statements.find(statement =>
        statement.from === sqlMapStatement.from && statement.to === sqlMapStatement.to && active.sql.slice(statement.from, statement.to) === statement.sql);
    const resultTabs: readonly ResultsView[] = run?.kind === 'explain'
        ? ['results', 'indexes']
        : run?.kind === 'plan'
            ? ['results', 'plan']
        : run?.kind === 'pipeline'
            ? ['results', 'pipeline']
            : experience === 'beginner' ? ['results', 'chart', 'sqlmap'] : ['results', 'chart', 'sqlmap', 'insights'];
    const retainedSnapshot = run && snapshot?.runId === run.id ? snapshot : undefined;
    const explainPlanOutput = run?.kind === 'plan' ? retainedSnapshot?.rows[0]?.[0] : undefined;
    const explainPlan = useMemo(() => parseExplainPlan(explainPlanOutput), [explainPlanOutput]);
    const explainIndexRows = run?.kind === 'explain' ? retainedSnapshot?.rows : undefined;
    const explainIndexAnalysis = useMemo(() => explainIndexRows ? parseExplainIndexAnalysis(explainIndexRows) : undefined, [explainIndexRows]);
    const pipelineOutputRows = run?.kind === 'pipeline' ? retainedSnapshot?.rows : undefined;
    const pipelineResult = useMemo(() => pipelineOutputRows
        ? parsePipelineResult(pipelineOutputRows.map(row => row[0]).filter((value): value is string => typeof value === 'string'))
        : undefined, [pipelineOutputRows]);
    const resultsTitle = visibleResultsView === 'sqlmap' ? copy.common.sqlStructure
        : visibleResultsView === 'indexes' ? copy.common.explain
            : visibleResultsView === 'plan' ? copy.common.logicalPlan
            : visibleResultsView === 'pipeline' ? copy.common.pipelineGraph : copy.common.results;
    const resultsEyebrow = visibleResultsView === 'sqlmap' ? copy.common.queryVisualization : copy.common.workspaceOutput;
    const resultsPanelLabel = visibleResultsView === 'sqlmap' ? copy.common.sqlStructure
        : visibleResultsView === 'plan' || visibleResultsView === 'pipeline' || visibleResultsView === 'indexes' ? resultsTitle : copy.common.queryResults;
    const snapshotChart = retainedSnapshot ? recommendChart(retainedSnapshot.columns, retainedSnapshot.rows) : undefined;
    const openDocument = (document: QueryDocument) => {
        addDraft(draftFromDocument(document));
    };
    const openSqlDraft = (name: string, sql: string, run: boolean) => {
        if (run && busy) { setError(copy.common.runActionWait); return; }
        if (run && !trusted) { setError(copy.common.runActionTrustRequired); return; }
        const draft = newDraft(name, sql);
        if (!openNewDraft(draft)) return;
        setDrawerOpen(false);
        if (!run) {
            window.requestAnimationFrame(() => editor.current?.focus());
            return;
        }
        void perform(async () => {
            const statements = splitSql(draft.sql);
            if (statements.length !== 1) throw new Error('Generated object preview must contain exactly one SQL statement.');
            const statement = statements[0]!;
            const created = await post<Run>('/runs', {
                clientRequestId: crypto.randomUUID(), connectionId: connection.id, documentId: draft.serverId,
                sql: statement.sql, parameters: draft.parameters, parentRunId: draft.parentRunId, kind: 'query',
                limits: { rows: connection.limits.rows || DEFAULT_LIMITS.rows, seconds: connection.limits.seconds || DEFAULT_LIMITS.seconds },
                tags: { workspace: 'clickstudio', experience }, sourceFrom: statement.from, sourceTo: statement.to,
            });
            setRunForRun(created.id, created, true);
            setPage(0);
            update(draft.id, current => ({ ...current, activeRunId: created.id, scriptId: undefined, runIds: rememberRunIds(current.runIds, [created.id]) }));
            setView('results');
            setResultsCollapsed(false);
            setExampleChartRunId(undefined);
            if (!isFrontendDemoPreview)
                setNotice(demoMode ? 'Sample preview generated. SQL was not sent to ClickHouse.' : 'Table preview submitted to the selected ClickHouse connection.');
            void loadHistory().catch(() => undefined);
        }, 'run');
    };
    const inspectorProps = {
        copy: copy.common,
        inspector,
        setInspector: showInspector,
        connection,
        schema,
        schemaLoading,
        schemaError,
        search,
        setSearch,
        history: sortedHistory,
        documents,
        revisions: revisionsDocumentId === active.serverId ? documentRevisions : [],
        revisionsDocumentId,
        revisionLoading,
        revisionError,
        currentRevision: revisionsDocumentId === active.serverId
            ? documentRevisions[0]?.revision ?? savedDocument?.revision ?? active.baseRevision
            : savedDocument?.revision ?? active.baseRevision,
        unsavedDraft: saveStatus.state !== 'saved' && saveStatus.state !== 'checking',
        canRestoreRevision: Boolean(active.serverId && revisionsDocumentId === active.serverId && documentRevisions.length > 1 && !revisionLoading && !documentsReadError && savedDocument && !savedDocument.deletedAt),
        run,
        profile,
        pipeline,
        onRefreshSchema: () => void loadSchema(true),
        onRefreshHistory: () => void loadHistory(),
        onInsert: (value: string) => editor.current?.insert(value),
        onOpenSqlDraft: openSqlDraft,
        onOpenImport: () => setImportOpen(true),
        onExportResult: () => void exportCurrentCsv(),
        exportDisabled: run?.resultState !== 'reopenable',
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
        onRefreshRevisions: () => void loadDocumentRevisions(active.serverId),
        onRestoreRevision: restoreDocumentRevision,
        assistantAction,
        onAssistantAction: (value: AssistantAction) => { setAssistantAction(value); setAssistantContext(undefined); setAssistantProposal(undefined); },
        assistantQuestion,
        onAssistantQuestion: changeAssistantQuestion,
        assistantContext,
        assistantProposal,
        assistantBusy,
        assistantError,
        nativeParserEnabled,
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
        runDisabled: !trusted || Boolean(busy) || unsupportedParameters,
        expert: experience === 'expert',
    } satisfies InspectorPaneProps;

    return <div className={cx('workspace-root', experience === 'expert' && 'is-expert', experience === 'beginner' && 'is-beginner')}>
        <OverlayPortal><div className="toast-stack">
            {error && <div className="toast toast-error animate-enter" role="alert"><span>!</span>{error}<button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close"/></button></div>}
            {notice && <div className="toast toast-success animate-enter" role="status"><span>✓</span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><Icon name="close"/></button></div>}
            {storageError && <div className="toast toast-error" role="alert">Local draft storage could not save changes: {storageError}</div>}
        </div></OverlayPortal>

        <div className="workspace-layout">
            <aside className="icon-rail" aria-label="Workspace tools">
                <span className="rail-separator"/>
                <RailButton icon="schema" label={copy.common.objects} active={inspector === 'schema' && drawerOpen} onClick={() => showInspector('schema')}/>
                <RailButton icon="reference" label={copy.common.reference} active={inspector === 'reference' && drawerOpen} onClick={() => showInspector('reference')}/>
                {experience === 'expert' && <>
                    <RailButton icon="history" label={copy.common.history} active={inspector === 'history' && drawerOpen} onClick={() => showInspector('history')}/>
                    <RailButton icon="documents" label={copy.common.queries} active={inspector === 'documents' && drawerOpen} onClick={() => showInspector('documents')}/>
                </>}
                <span className="rail-spacer"/>
                {experience === 'expert' && <RailButton icon="assistant" label={copy.common.assistant} accent active={inspector === 'assistant'} onClick={() => showInspector('assistant')}/>}
                {experience === 'expert' && <><RailButton icon="details" label="Run details" active={inspector === 'details'} onClick={() => showInspector('details')}/><RailButton icon="pipeline" label="Pipeline" active={inspector === 'pipeline'} onClick={() => showInspector('pipeline')}/></>}
                {experience === 'expert' && <RailButton icon="parser" label="Parser" active={inspector === 'parser'} onClick={() => showInspector('parser')}/>}
                {experience === 'expert' && <><span className="rail-separator"/><button className="rail-icon-button rail-icon-muted" type="button" title="Export local drafts" onClick={() => download('clickstudio-local-drafts.json', workspace)}><Icon name="settings"/></button></>}
            </aside>

            {experience === 'expert' && <InspectorPane {...inspectorProps}/>}

            <main className="workspace-main">
                <div className={cx('document-tabs', tabScrollState.overflow && 'has-tab-overflow')}>
                    <div
                        ref={tabScrollerRef}
                        className="document-tabs-scroll"
                        role="tablist"
                        aria-label="SQL documents"
                        onScroll={updateTabScrollState}
                    >
                    {workspace.tabs.map((draft, index) => <div key={draft.id} id={`document-tab-${draft.id}`} className={cx('document-tab', draft.id === active.id && 'is-active')} role="tab" aria-label={draft.name} aria-selected={draft.id === active.id} aria-controls="sql-document-panel" tabIndex={draft.id === active.id ? 0 : -1} onClick={() => setWorkspace(current => ({ ...current, activeId: draft.id }))} onKeyDown={event => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'F2') {
                            event.preventDefault();
                            beginTabRename(draft);
                            return;
                        }
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
                        {renamingTabId === draft.id
                            ? <input className="document-tab-rename" aria-label={`Rename ${draft.name}`} value={tabRenameValue} autoFocus onFocus={event => event.currentTarget.select()} onClick={event => event.stopPropagation()} onChange={event => setTabRenameValue(event.target.value)} onBlur={event => finishTabRename(draft.id, event.currentTarget.value)} onKeyDown={event => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    finishTabRename(draft.id, event.currentTarget.value, true);
                                } else if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancelTabRename(draft.id);
                                }
                            }}/>
                            : <span className="document-tab-name" title={`Double-click to rename ${draft.name} · F2`} onDoubleClick={event => { event.stopPropagation(); beginTabRename(draft); }}>{draft.name}</span>}{(() => {
                            const status = draftSaveStatus(draft, connection.id, documents.find(document => document.id === draft.serverId), {
                                saving: Boolean(savingDraftIds[draft.id]), pending: !documentsLoaded, readError: documentsReadError,
                            });
                            const unsaved = ['local', 'changed', 'conflict', 'deleted', 'unavailable'].includes(status.state);
                            return unsaved ? <span className="tab-unsaved" title={status.label} aria-hidden="true"/> : null;
                        })()}<button type="button" aria-label={`Close ${draft.name}`} onClick={event => { event.stopPropagation(); setWorkspace(current => closeDraft(current, draft.id)); }}>×</button>
                    </div>)}
                    </div>
                    <div className="document-tab-actions">
                        {tabScrollState.overflow && <>
                            <button
                                className="document-tabs-scroll-button is-left"
                                data-testid="scroll-sql-tabs-left"
                                type="button"
                                aria-label="Scroll SQL tabs left"
                                title="More SQL tabs to the left"
                                disabled={!tabScrollState.canScrollLeft}
                                onClick={() => scrollTabs(-1)}
                            ><Icon name="chevron"/></button>
                            <button
                                className="document-tabs-scroll-button is-right"
                                data-testid="scroll-sql-tabs-right"
                                type="button"
                                aria-label="Scroll SQL tabs right"
                                title="More SQL tabs to the right"
                                disabled={!tabScrollState.canScrollRight}
                                onClick={() => scrollTabs(1)}
                            ><Icon name="chevron"/></button>
                        </>}
                    <button className="new-tab-button new-tab-labeled" data-testid="new-sql" type="button" aria-label={copy.common.newSql} title={copy.common.newSql} aria-haspopup="dialog" aria-expanded={examplesOpen} aria-controls="sql-examples-panel" onClick={event => openExamples(event.currentTarget)}><Icon name="plus"/><span>{copy.common.newSql}</span></button>
                    <SqlExamplesMenu open={examplesOpen} onClose={closeExamples} examples={sqlExamples} sourceLabel={connectionLabel} copy={copy.common} locale={locale} onOpenExample={example => {
                        const draft = createExampleDraft(example);
                        if (!openNewDraft(draft)) return false;
                        window.requestAnimationFrame(() => editor.current?.focus());
                        return true;
                    }} onRunExample={runExample} onStartBlankSql={() => {
                        if (!openNewDraft(newDraft())) return false;
                        window.requestAnimationFrame(() => editor.current?.focus());
                        return true;
                    }}/>
                    {!!workspace.closedTabs?.length && <RestoreSqlMenu closedTabs={workspace.closedTabs} copy={copy.common} onRestore={draftId => {
                        if (workspaceRef.current.tabs.length >= MAX_TABS) { setError(`Close a tab before restoring one. This workspace supports ${MAX_TABS} open drafts.`); return false; }
                        setWorkspace(current => reopenDraft(current, draftId));
                        window.requestAnimationFrame(() => editor.current?.focus());
                        return true;
                    }}/>}
                    <span className="draft-status" data-save-state={saveStatus.state} title={`${saveStatus.label}. ${saveStatus.detail}`}><span className={cx('status-light', saveStatus.state === 'saved' ? 'is-trusted' : ['changed', 'conflict', 'deleted', 'unavailable'].includes(saveStatus.state) ? 'is-warning' : '')}/>{saveStatusLabel}</span>
                    {active.serverId && <Button variant="ghost" className="revision-history-trigger" aria-label={`Version history for ${active.name}`} aria-pressed={inspector === 'revisions'} title="View saved versions" onClick={() => showInspector('revisions')}><Icon name="history"/><span>Versions</span></Button>}
                    </div>
                </div>

                <div
                    ref={workspaceContentRef}
                    id="sql-document-panel"
                    role="tabpanel"
                    aria-labelledby={`document-tab-${active.id}`}
                    tabIndex={0}
                    style={workspaceLayoutStyle}
                    className={cx(
                        'workspace-content',
                        experience === 'beginner' && 'beginner-workspace-content',
                        run && 'has-run',
                        visibleResultsView === 'sqlmap' && 'has-sql-map',
                        queryCollapsed && 'is-query-collapsed',
                        (run || visibleResultsView === 'sqlmap') && resultsCollapsed && 'is-results-collapsed',
                        queryFloating && 'has-floating-query',
                        resultsFloating && 'has-floating-results',
                        canSplitPanels && 'has-panel-split',
                    )}
                >
                    <section
                        ref={queryPanelRef}
                        className={cx('editor-surface', queryCollapsed && 'is-collapsed', queryFloating && 'is-floating', queryMode === 'maximized' && 'is-maximized', activeFloatingPanel === 'query' && queryFloating && 'is-front')}
                        style={panelStyle('query', queryMode)}
                        onPointerDownCapture={() => { if (queryFloating) setActiveFloatingPanel('query'); }}
                    >
                        <div
                            className={cx('editor-heading', queryFloating && 'workspace-panel-drag-handle')}
                            onPointerDown={event => startPanelDrag('query', event)}
                            onDoubleClick={event => {
                                if (queryFloating && !panelTargetIsInteractive(event.target)) togglePanelMaximized('query');
                            }}
                        >
                            <div className="editor-file-heading"><span className="file-type-icon">SQL</span><label className="document-name"><span className="eyebrow">{copy.common.query}</span><input aria-label="SQL document name" value={active.name} onChange={event => patch({ name: event.target.value })}/></label></div>
                        <div className="editor-heading-actions">
                            {experience === 'expert' && <>
                                {nativeParserEnabled && nativeParserStatus === 'unavailable' && <>
                                    <span className="toolbar-small" role="status" title="Formatting remains available while the native parser is unavailable.">{copy.common.parserUnavailable}</span>
                                    <Button variant="ghost" className="toolbar-small" onClick={() => editor.current?.retryNativeParser()}>{copy.common.retryParser}</Button>
                                </>}
                                <div className="formatter-control" role="group" aria-label={copy.common.formatSql}>
                                    <span className="formatter-control-label">{copy.common.format}</span>
                                    <Button
                                        variant="ghost"
                                        className="toolbar-small formatter-choice formatter-choice-wasm"
                                        disabled={!nativeParserEnabled || nativeParserStatus !== 'ready'}
                                        title={!nativeParserEnabled
                                            ? 'Select WASM in the parser switch to enable this formatter.'
                                            : nativeParserStatus === 'loading'
                                                ? 'The WASM parser is loading.'
                                                : nativeParserStatus === 'unavailable'
                                                    ? 'The WASM parser is unavailable. Retry the parser to enable this formatter.'
                                                    : hasSqlComments(active.sql)
                                                        ? 'Formats with WASM when supported; SQL with comments falls back to Built-in Format to preserve them.'
                                                        : 'Format SQL with the native ClickHouse WASM parser.'}
                                        onClick={() => void formatActiveSql('wasm')}
                                    >WASM</Button>
                                    <Button
                                        variant="ghost"
                                        className="toolbar-small formatter-choice formatter-choice-builtin"
                                        title="Format SQL with ClickStudio’s built-in formatter."
                                        onClick={() => void formatActiveSql('builtin')}
                                    >{copy.common.builtInFormatter}</Button>
                                </div>
                            </>}
                            {!compactViewport && <Button variant="ghost" className="panel-window-button" aria-label={queryFloating ? 'Dock query panel' : 'Pop out query panel'} title={queryFloating ? 'Dock query panel' : 'Pop out query panel'} onClick={() => togglePanelFloating('query')}><Icon name={queryFloating ? 'dock' : 'popout'}/></Button>}
                            {queryFloating && <Button variant="ghost" className="panel-window-button" aria-label={queryMode === 'maximized' ? 'Restore query panel' : 'Maximize query panel'} title={queryMode === 'maximized' ? 'Restore query panel' : 'Maximize query panel'} onClick={() => togglePanelMaximized('query')}><Icon name={queryMode === 'maximized' ? 'restore' : 'maximize'}/></Button>}
                            <Button variant="ghost" className="panel-collapse-button" aria-label={queryCollapsed ? copy.common.expandQuery : copy.common.collapseQuery} aria-expanded={!queryCollapsed} aria-controls="sql-editor-content" title={queryCollapsed ? copy.common.expandQuery : copy.common.collapseQuery} onClick={() => setQueryCollapsed(value => !value)}><Icon className="panel-toggle-icon" name="chevron"/></Button>
                        </div>
                        </div>
                        <div id="sql-editor-content" className="panel-content editor-content" hidden={queryCollapsed}>
                        <div className="editor-toolbar">
                            <div className="editor-mode-label"><span className="editor-language-dot"/>{copy.common.clickhouseSql}<span className="toolbar-divider"/><span>{statementCount === undefined ? copy.common.incompleteSql : (statementCount === 1 ? copy.common.oneStatement : copy.common.manyStatements).replace('{count}', String(statementCount))}</span></div>
                            <div className="editor-actions">
                                <Button variant="ghost" className="sql-map-button" aria-label={copy.common.visualizeSqlStructure} aria-pressed={view === 'sqlmap'} title={copy.common.visualizeSqlStructure} onClick={() => { setView(current => current === 'sqlmap' ? 'results' : 'sqlmap'); setResultsCollapsed(false); }}><Icon name="pipeline"/>{copy.common.sqlMap}</Button>
                                {experience === 'expert' ? <>
                                    <Button variant="ghost" className="sql-ai-button" data-testid="open-ai" aria-label={copy.common.askAi} aria-pressed={inspector === 'assistant'} onClick={() => showInspector('assistant')}><Icon name="assistant"/>{copy.common.askAi}</Button>
                                    <Button variant="secondary" className="save-revision-button" data-testid="save-query" aria-label={copy.common.saveRevision} onClick={() => void saveDraft()} disabled={Boolean(busy)}><Icon name="documents"/>{copy.common.save}</Button>
                                    <RunActionGroup copy={copy.common} runLabel={copy.common.runStatement} running={busy === 'run' || busy === 'script'} disabled={!trusted || Boolean(busy) || unsupportedParameters} onRun={() => void execute()} actions={[
                                        { id: 'script', label: copy.common.runScript, disabled: !trusted || Boolean(busy) || unsupportedParameters || !connection.manifest?.scripts.available, title: runActionTitle(connection.manifest?.scripts, 'script'), onSelect: () => void execute(true) },
                                        { id: 'explain', label: copy.common.explain, disabled: !trusted || Boolean(busy) || unsupportedParameters || !connection.manifest?.explain.available, title: runActionTitle(connection.manifest?.explain, 'explain'), onSelect: () => void execute(false, 'explain') },
                                        { id: 'explain-plan', label: copy.common.explainPlan, disabled: !trusted || Boolean(busy) || unsupportedParameters || !(connection.manifest?.explainPlan ?? connection.manifest?.explain)?.available, title: runActionTitle(connection.manifest?.explainPlan ?? connection.manifest?.explain, 'explain-plan'), onSelect: () => void execute(false, 'plan') },
                                        { id: 'explain-pipeline', label: copy.common.explainPipeline, disabled: !trusted || Boolean(busy) || unsupportedParameters || !(connection.manifest?.explainPipeline ?? connection.manifest?.pipeline)?.available, title: runActionTitle(connection.manifest?.explainPipeline ?? connection.manifest?.pipeline, 'explain-pipeline'), onSelect: () => void execute(false, 'pipeline') },
                                    ]}/>
                                </> : <>
                                    <Button variant="ghost" className="sql-ai-button" data-testid="open-ai" aria-label={copy.common.askAi} onClick={() => showInspector('assistant')}><Icon name="assistant"/>{copy.common.askAi}</Button>
                                    <Button variant="secondary" className="save-revision-button" data-testid="save-query" aria-label={copy.common.save} onClick={() => void saveDraft()} disabled={Boolean(busy)}><Icon name="documents"/>{copy.common.save}</Button>
                                    <Button variant="primary" className="run-query-button" data-testid="run-statement" aria-label={copy.common.runStatement} onClick={() => void execute()} disabled={!trusted || Boolean(busy) || unsupportedParameters}><Icon name="play"/>{busy === 'run' ? copy.common.running : copy.common.run}</Button>
                                </>}
                            </div>
                        </div>
                        {experience === 'beginner' && (!trusted || (!demoMode && !connection.manifest)) && <div className="beginner-connection-notice" role="status"><span>{demoMode ? 'Start the sample workspace to run this query.' : !connection.manifest ? trusted ? 'Retest this connection to refresh its feature checks.' : 'Test this connection to discover its ClickHouse features.' : 'Trust this connection to run SQL.'}</span><Button variant="secondary" className="toolbar-small" onClick={() => void (!demoMode && !connection.manifest ? testConnectionActionRef.current() : trustActionRef.current())}>{demoMode ? 'Start exploring' : !connection.manifest ? trusted ? 'Retest connection' : 'Test connection' : 'Trust connection'}</Button></div>}
                        <div className="editor-frame"><SqlEditor key={active.id} ref={editor} value={active.sql} from={active.from} to={active.to} schema={trusted ? schema : undefined} dark={dark} nativeParserEnabled={nativeParserEnabled} parserStatus={nativeParserStatus} copy={copy.common} error={editorErrorContext?.error} errorRange={editorErrorRange} onChange={sql => patch({ sql })} onSelection={(from, to) => patch({ from, to })} onRun={wholeScript => void execute(wholeScript)} onNativeParserStatus={setNativeParserStatus} onNativeParseSnapshot={snapshot => setNativeParseSnapshot(snapshot)}/></div>
                        {unsupportedParameters
                            ? <div className="callout mt-3" role="status">{connection.manifest?.parameters.reason ?? 'Query parameters are unavailable on this connection.'} Replace placeholders with SQL literals to run this query.</div>
                            : parameters.length > 0 && <div className="parameters-row"><div className="parameters-label"><span>INPUTS</span><strong>Query parameters</strong><small>Values are bound separately from the SQL text.</small></div>{parameters.map(parameter => <label className="parameter-field" key={parameter.name}><span>{parameter.name}<code>:{parameter.type}</code></span><input value={active.parameters[parameter.name] ?? ''} placeholder="Enter value" onChange={event => patch({ parameters: { ...active.parameters, [parameter.name]: event.target.value } })}/></label>)}<span className="parameter-count">{parameters.filter(parameter => Boolean(active.parameters[parameter.name]?.trim())).length} / {parameters.length} ready</span></div>}
                        {experience === 'expert' && <div className="editor-footer"><span>{active.sql.length.toLocaleString()} {copy.common.characters} <span className="footer-dot">·</span> {active.sql.split('\n').length} {copy.common.lines}</span></div>}
                        </div>
                        {queryMode === 'floating' && !queryCollapsed && <PanelResizeHandles onResize={(edge, event) => startPanelResize('query', edge, event)}/>}
                    </section>

                    {canSplitPanels && <div
                        className="workspace-panel-splitter"
                        role="separator"
                        aria-label="Resize query and output panels"
                        aria-orientation="horizontal"
                        aria-valuemin={25}
                        aria-valuemax={75}
                        aria-valuenow={Math.round(panelLayout.splitRatio * 100)}
                        tabIndex={0}
                        onPointerDown={startPanelSplit}
                        onKeyDown={event => {
                            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                            event.preventDefault();
                            const delta = event.key === 'ArrowUp' ? -0.05 : 0.05;
                            setPanelLayout(current => ({ ...current, splitRatio: clampPanelSplitRatio(current.splitRatio + delta) }));
                        }}
                    ><span/></div>}

                    {(run || visibleResultsView === 'sqlmap') && <section
                        ref={resultsPanelRef}
                        className={cx('results-surface', experience === 'expert' && 'results-expert', resultsCollapsed && 'is-collapsed', resultsFloating && 'is-floating', resultsMode === 'maximized' && 'is-maximized', activeFloatingPanel === 'results' && resultsFloating && 'is-front')}
                        style={panelStyle('results', resultsMode)}
                        aria-label={resultsPanelLabel}
                        onPointerDownCapture={() => { if (resultsFloating) setActiveFloatingPanel('results'); }}
                    >
                        <div
                            className={cx('results-header', resultsFloating && 'workspace-panel-drag-handle')}
                            onPointerDown={event => startPanelDrag('results', event)}
                            onDoubleClick={event => {
                                if (resultsFloating && !panelTargetIsInteractive(event.target)) togglePanelMaximized('results');
                            }}
                        >
                            <div className="results-title">
                                <span className="results-mark"><Icon name={visibleResultsView === 'sqlmap' || visibleResultsView === 'pipeline' || visibleResultsView === 'indexes' ? 'pipeline' : 'chart'}/></span>
                                <div><span className="eyebrow">{resultsEyebrow}</span><h2>{resultsTitle}</h2></div>
                                {run && visibleResultsView !== 'sqlmap' && <Status run={run} copy={copy.common}/>}
                            </div>
                            <div className="results-actions">
                                {run && <div className="results-tabs" role="tablist" aria-label={copy.common.workspaceOutput}>{resultTabs.map(tab => <button key={tab} role="tab" aria-selected={visibleResultsView === tab} type="button" onClick={() => {
                                    setView(tab);
                                    if (tab === 'insights') void perform(loadProfile, 'save');
                                }}>{tab === 'results' ? copy.common.results : tab === 'chart' ? copy.common.chart : tab === 'sqlmap' ? copy.common.sqlMap : tab === 'indexes' ? copy.common.explain : tab === 'plan' ? copy.common.logicalPlan : tab === 'pipeline' ? copy.common.pipelineGraph : copy.common.insights}{tab === 'chart' && retainedSnapshot && <span className="suggested-dot"/>}</button>)}</div>}
                                {!compactViewport && <Button variant="ghost" className="panel-window-button" aria-label={resultsFloating ? 'Dock output panel' : 'Pop out output panel'} title={resultsFloating ? 'Dock output panel' : 'Pop out output panel'} onClick={() => togglePanelFloating('results')}><Icon name={resultsFloating ? 'dock' : 'popout'}/></Button>}
                                {resultsFloating && <Button variant="ghost" className="panel-window-button" aria-label={resultsMode === 'maximized' ? 'Restore output panel' : 'Maximize output panel'} title={resultsMode === 'maximized' ? 'Restore output panel' : 'Maximize output panel'} onClick={() => togglePanelMaximized('results')}><Icon name={resultsMode === 'maximized' ? 'restore' : 'maximize'}/></Button>}
                                <Button variant="ghost" className="panel-collapse-button" aria-label={`${resultsCollapsed ? copy.common.expand : copy.common.collapse} ${resultsPanelLabel}`} aria-expanded={!resultsCollapsed} aria-controls="query-results-content" title={resultsCollapsed ? copy.common.expandOutput : copy.common.collapseOutput} onClick={() => setResultsCollapsed(value => !value)}><Icon className="panel-toggle-icon" name="chevron"/></Button>
                            </div>
                        </div>
                        <div id="query-results-content" className={cx('panel-content results-content', ['insights', 'indexes', 'plan', 'pipeline'].includes(visibleResultsView) && 'results-content-scrollable')} hidden={resultsCollapsed}>
                            {visibleResultsView === 'sqlmap' && <SqlFlowView copy={copy.common} sql={sqlMapStatement?.sql ?? active.sql} sourceOffset={sqlMapStatement?.from ?? 0} parseResult={sqlMapParseStatement?.result} parserEnabled={nativeParserEnabled} parserStatus={nativeParserStatus} parseDurationMs={nativeParseSnapshot?.elapsedMs} onRevealRange={(from, to) => editor.current?.revealRange(from, to)}/>}
                            {visibleResultsView !== 'sqlmap' && staleResult && <div className="result-provenance" aria-live="polite"><span className="status-light is-warning"/><span><strong>Result from previous execution</strong><small>SQL or bound parameters changed since this run. Rerun to refresh the result.</small></span></div>}
                            {visibleResultsView === 'results' && script && <ScriptResults script={script} runs={history} activeRunId={run?.id} onSelectRun={runId => {
                                if (active.scriptId) scriptFollowRef.current = { scriptId: active.scriptId, enabled: false };
                                update(active.id, draft => ({ ...draft, activeRunId: runId }));
                                setPage(0); setView('results');
                            }} onCancel={() => void cancel()} cancelDisabled={cancelling}/>}
                            {run && visibleResultsView === 'results' && <ResultGrid key={run.id} run={run} page={resultPage} pageIndex={page} loading={!resultPage && run.resultState === 'reopenable'} onPage={setPage}/>}
                            {run && visibleResultsView === 'indexes' && <ExplainIndexesView analysis={explainIndexAnalysis} loading={!retainedSnapshot && run.resultState === 'reopenable'} copy={copy.common}/>}
                            {run && visibleResultsView === 'plan' && <ExplainPlanView plan={explainPlan} loading={!retainedSnapshot && run.resultState === 'reopenable'} copy={copy.common}/>}
                            {run && visibleResultsView === 'pipeline' && (pipelineResult
                                ? <PipelineGraph pipeline={pipelineResult} copy={copy.common} heading={copy.common.pipelineGraph} subheading={copy.common.pipelineGraphDescription}/>
                                : <div className="pipeline-graph-empty" role="status">{copy.common.pipelineNoOutput}</div>)}
                            {run && visibleResultsView === 'chart' && snapshotChart?.config.kind === 'table' ? <div className="chart-table-fallback"><div className="chart-table-notice" role="status">{copy.chart.fallbackNoMeasure}</div><ResultGrid key={`${run.id}-chart-table`} run={run} page={resultPage} pageIndex={page} loading={!resultPage && run.resultState === 'reopenable'} onPage={setPage}/></div> : run && visibleResultsView === 'chart' && <ChartView result={retainedSnapshot} loading={!retainedSnapshot && run.resultState === 'reopenable'} chart={active.chart} onChart={chart => patch({ chart })} copy={copy} locale={locale}/>}
                            {run && visibleResultsView === 'insights' && <InsightsView run={run} profile={profile} pipeline={pipeline} pipelineAvailable={Boolean(trusted && connection.manifest?.pipeline.available)} onLoad={() => void perform(loadProfile, 'save')} onLoadPipeline={() => void perform(loadPipeline, 'save')} loading={busy === 'save'}/>}
                        </div>
                        {resultsMode === 'floating' && !resultsCollapsed && <PanelResizeHandles onResize={(edge, event) => startPanelResize('results', edge, event)}/>}
                    </section>}
                </div>
            </main>

            {drawerOpen && (experience === 'beginner' || compactViewport) && <OverlayPortal><><button className="drawer-backdrop" type="button" aria-label="Close panel" onClick={() => setDrawerOpen(false)}/><InspectorPane {...inspectorProps} drawer onClose={() => setDrawerOpen(false)} onInsert={value => { editor.current?.insert(value); setDrawerOpen(false); }} onOpenDocument={document => { openDocument(document); setDrawerOpen(false); }}/></></OverlayPortal>}
        </div>
        <ImportWizard open={importOpen} connectionId={connection.id} trusted={trusted} demoMode={demoMode} onClose={() => setImportOpen(false)} onImported={() => { void loadSchema(); setNotice('Import complete. The destination schema was refreshed.'); }}/>
        <ExecutionBar run={run} eventState={eventState} onCancel={() => void cancel()} cancelling={cancelling} scriptRunning={script?.status === 'running'} copy={copy.common} helpButton={<HelpExamplesButton copy={copy.common} open={examplesOpen} onOpen={openExamples}/>}/>
    </div>;
}
