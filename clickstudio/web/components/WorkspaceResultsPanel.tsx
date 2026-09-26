import type { ProfilePipeline, QueryProfile, ResultPage, Run, Script } from '../../shared/types';
import type { FlamegraphSnapshot } from '../../shared/flamegraph';
import type { NativeParseSnapshot, NativeParserStatus } from '../../shared/native-parser';
import type { Copy, ExperienceLevel, Locale } from '../i18n';
import type { BusyAction, Connected, ResultsView } from '../workspace-types';
import type { Draft } from '../workspace-state';
import { PanelResizeHandles, panelTargetIsInteractive, type WorkspacePanelController } from '../useWorkspacePanels';
import type { WorkspaceViewState } from '../useWorkspaceViewState';
import { ChartView, GeoView, InsightsView, ResultGrid } from './ResultViews';
import { ExplainAnalyzeView } from './ExplainAnalyzeView';
import { ExplainIndexesView } from './ExplainIndexesView';
import { ExplainPlanView } from './ExplainPlanView';
import { PipelineGraph } from './PipelineGraph';
import { SqlFlowView } from './SqlFlowView';
import { Button, cx, Icon, Status } from './ui';
import { ScriptResults } from './WorkspaceChrome';
import { resultsTabLabel } from '../workspace-helpers';

export type WorkspaceResultsPanelState = Readonly<{
    active: Draft;
    connection: Connected;
    copy: Copy;
    locale: Locale;
    run?: Run;
    script?: Script;
    history: Run[];
    page: number;
    resultPage?: ResultPage;
    profile?: QueryProfile;
    pipeline?: ProfilePipeline;
    flamegraph?: FlamegraphSnapshot;
    profilesByRun: Readonly<Record<string, QueryProfile>>;
    pipelinesByRun: Readonly<Record<string, ProfilePipeline>>;
    nativeParserEnabled: boolean;
    nativeParserStatus: NativeParserStatus;
    nativeParseSnapshot?: NativeParseSnapshot;
    trusted: boolean;
    busy: BusyAction;
    execution?: Readonly<{ sql: string }>;
    retainedExecutionResult?: Readonly<{ run: Run; page: ResultPage; pageIndex: number }>;
    cancelling: boolean;
    experience: ExperienceLevel;
}>;

export type WorkspaceResultsPanelActions = Readonly<{
    onSelectView: (view: ResultsView) => void;
    onSelectScriptRun: (runId: string) => void;
    onCancel: () => void;
    onPage: (page: number) => void;
    onPatch: (values: Partial<Draft>) => void;
    onLoadProfile: () => void;
    onLoadPipeline: () => void;
    onLoadFlamegraph: () => void;
    onRevealRange: (from: number, to: number) => void;
}>;

export function WorkspaceResultsPanel({
    state,
    actions,
    panels,
    viewState,
}: {
    state: WorkspaceResultsPanelState;
    actions: WorkspaceResultsPanelActions;
    panels: WorkspacePanelController;
    viewState: WorkspaceViewState;
}) {
    const {
        active,
        connection,
        copy,
        locale,
        run,
        script,
        history,
        page,
        resultPage,
        profile,
        pipeline,
        flamegraph,
        profilesByRun,
        pipelinesByRun,
        nativeParserEnabled,
        nativeParserStatus,
        nativeParseSnapshot,
        trusted,
        busy,
        execution,
        retainedExecutionResult,
        cancelling,
        experience,
    } = state;
    const {
        resultTabs,
        visibleResultsView,
        retainedSnapshot,
        explainPlan,
        explainIndexAnalysis,
        pipelineResult,
        analyzeEvidence,
        resultsTitle,
        resultsEyebrow,
        resultsPanelLabel,
        snapshotChart,
        sqlMapStatement,
        sqlMapParseStatement,
        queryTreeAvailable,
        queryTreeUnavailableReason,
        staleResult,
    } = viewState;
    const {
        resultsPanelRef,
        resultsMode,
        resultsFloating,
        activeFloatingPanel,
        setActiveFloatingPanel,
        panelStyle,
        togglePanelFloating,
        togglePanelMaximized,
        startPanelDrag,
        startPanelResize,
    } = panels;

    const showPreviousResult = Boolean(execution && retainedExecutionResult && visibleResultsView === 'results');
    const resultsRun = showPreviousResult ? retainedExecutionResult!.run : run;
    const resultsPage = showPreviousResult ? retainedExecutionResult!.page : resultPage;
    const resultsPageIndex = showPreviousResult ? retainedExecutionResult!.pageIndex : page;
    const executionSqlPreview = execution && execution.sql.length > 240 ? `${execution.sql.slice(0, 240)}…` : execution?.sql;

    if (!run && !execution && visibleResultsView !== 'sqlmap') return null;

    return <section
        ref={resultsPanelRef}
        className={cx('results-surface', experience === 'expert' && 'results-expert', panels.resultsCollapsed && 'is-collapsed', resultsFloating && 'is-floating', resultsMode === 'maximized' && 'is-maximized', activeFloatingPanel === 'results' && resultsFloating && 'is-front')}
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
                <span className="results-mark"><Icon name={visibleResultsView === 'sqlmap' || visibleResultsView === 'pipeline' || visibleResultsView === 'indexes' || visibleResultsView === 'runtime' ? 'pipeline' : 'chart'}/></span>
                <div><span className="eyebrow">{resultsEyebrow}</span><h2>{resultsTitle}</h2></div>
                {execution && visibleResultsView !== 'sqlmap'
                    ? <span className="result-execution-header"><span className="loading-orbit" aria-hidden="true"/>{copy.common.statusRunning}</span>
                    : run && visibleResultsView !== 'sqlmap' && <Status run={run} copy={copy.common}/>}
            </div>
            <div className="results-actions">
                {run && resultTabs.length > 1 && <div className="results-tabs" role="tablist" aria-label={copy.common.workspaceOutput}>{resultTabs.map(tab => <button key={tab} role="tab" aria-selected={visibleResultsView === tab} type="button" onClick={() => actions.onSelectView(tab)}>{resultsTabLabel(tab, copy.common)}{tab === 'chart' && retainedSnapshot && <span className="suggested-dot"/>}</button>)}</div>}
                {!panels.compactViewport && <Button variant="ghost" className="panel-window-button" aria-label={resultsFloating ? 'Dock output panel' : 'Pop out output panel'} title={resultsFloating ? 'Dock output panel' : 'Pop out output panel'} onClick={() => togglePanelFloating('results')}><Icon name={resultsFloating ? 'dock' : 'popout'}/></Button>}
                {resultsFloating && <Button variant="ghost" className="panel-window-button" aria-label={resultsMode === 'maximized' ? 'Restore output panel' : 'Maximize output panel'} title={resultsMode === 'maximized' ? 'Restore output panel' : 'Maximize output panel'} onClick={() => togglePanelMaximized('results')}><Icon name={resultsMode === 'maximized' ? 'restore' : 'maximize'}/></Button>}
                <Button variant="ghost" className="panel-collapse-button" aria-label={`${panels.resultsCollapsed ? copy.common.expand : copy.common.collapse} ${resultsPanelLabel}`} aria-expanded={!panels.resultsCollapsed} aria-controls="query-results-content" title={panels.resultsCollapsed ? copy.common.expandOutput : copy.common.collapseOutput} onClick={() => panels.setResultsCollapsed(value => !value)}><Icon className="panel-toggle-icon" name="chevron"/></Button>
            </div>
        </div>
        <div id="query-results-content" className={cx('panel-content results-content', ['insights', 'indexes', 'plan', 'pipeline', 'runtime'].includes(visibleResultsView) && 'results-content-scrollable')} hidden={panels.resultsCollapsed}>
            {visibleResultsView === 'sqlmap' && <SqlFlowView copy={copy.common} sql={sqlMapStatement?.sql ?? active.sql} sourceOffset={sqlMapStatement?.from ?? 0} parseResult={sqlMapParseStatement?.result} parserEnabled={nativeParserEnabled} parserStatus={nativeParserStatus} parseDurationMs={nativeParseSnapshot?.elapsedMs} connectionId={connection.id} parameters={active.parameters} analyzerAvailable={queryTreeAvailable} analyzerUnavailableReason={queryTreeUnavailableReason} onRevealRange={actions.onRevealRange}/>}
            {execution && visibleResultsView !== 'sqlmap' && <div className={cx('result-execution-progress', !showPreviousResult && 'is-initial')} aria-busy="true">
                <div className="result-execution-heading"><span className="loading-orbit" aria-hidden="true"/><span role="status" aria-live="polite">{copy.common.statusRunning}</span>{showPreviousResult && <strong className="result-execution-previous">Result from previous execution</strong>}</div>
                <pre className="result-execution-sql">{executionSqlPreview}</pre>
                {execution.sql.length > 240 && <details className="result-execution-details"><summary>{copy.common.expandQuery}</summary><pre className="result-execution-sql is-full">{execution.sql}</pre></details>}
            </div>}
            {visibleResultsView !== 'sqlmap' && !execution && staleResult && <div className="result-provenance" aria-live="polite"><span className="status-light is-warning"/><span><strong>Result from previous execution</strong><small>SQL or bound parameters changed since this run. Rerun to refresh the result.</small></span></div>}
            {visibleResultsView === 'results' && script && <ScriptResults script={script} runs={history} activeRunId={run?.id} onSelectRun={actions.onSelectScriptRun} onCancel={actions.onCancel} cancelDisabled={cancelling}/>}
            {resultsRun && visibleResultsView === 'results' && (!execution || showPreviousResult) && <ResultGrid key={resultsRun.id} run={resultsRun} page={resultsPage} pageIndex={resultsPageIndex} loading={!resultsPage && resultsRun.resultState === 'reopenable'} onPage={actions.onPage} showPagination={!showPreviousResult}/>}
            {run && visibleResultsView === 'indexes' && <ExplainIndexesView analysis={explainIndexAnalysis} loading={!retainedSnapshot && run.resultState === 'reopenable'} copy={copy.common}/>}
            {run && visibleResultsView === 'plan' && <ExplainPlanView plan={explainPlan} loading={!retainedSnapshot && run.resultState === 'reopenable'} copy={copy.common}/>}
            {run && visibleResultsView === 'pipeline' && (pipelineResult
                ? <PipelineGraph pipeline={pipelineResult} copy={copy.common} heading={copy.common.pipelineGraph} subheading={copy.common.pipelineGraphDescription}/>
                : <div className="pipeline-graph-empty" role="status">{copy.common.pipelineNoOutput}</div>)}
            {run && visibleResultsView === 'runtime' && <ExplainAnalyzeView evidence={analyzeEvidence} loading={!retainedSnapshot && run.resultState === 'reopenable'} copy={copy.common}/>}
            {run && visibleResultsView === 'chart' && snapshotChart?.config.kind === 'table'
                ? <div className="chart-table-fallback"><div className="chart-table-notice" role="status">{copy.chart.fallbackNoMeasure}</div><ResultGrid key={`${run.id}-chart-table`} run={run} page={resultPage} pageIndex={page} loading={!resultPage && run.resultState === 'reopenable'} onPage={actions.onPage}/></div>
                : run && visibleResultsView === 'chart' && <ChartView result={retainedSnapshot} loading={!retainedSnapshot && run.resultState === 'reopenable'} chart={active.chart} onChart={chart => actions.onPatch({ chart })} copy={copy} locale={locale}/>}
            {run && visibleResultsView === 'map' && <GeoView result={retainedSnapshot} loading={!retainedSnapshot && run.resultState === 'reopenable'} locale={locale}/>}
            {run && visibleResultsView === 'insights' && <InsightsView comparison={{ connectionId: connection.id, trusted, history, initialRun: run, profiles: profilesByRun, pipelines: pipelinesByRun, queryLogAvailable: connection.manifest?.queryLog.available === true }} run={run} profile={profile} pipeline={pipeline} pipelineAvailable={Boolean(trusted && connection.manifest?.pipeline.available)} flamegraph={flamegraph} flamegraphCapability={trusted ? connection.manifest?.traceLog : { available: false, reason: 'Trust this connection to inspect profiler samples.' }} onLoad={actions.onLoadProfile} onLoadPipeline={actions.onLoadPipeline} onLoadFlamegraph={actions.onLoadFlamegraph} loading={busy === 'save'}/>}
        </div>
        {resultsMode === 'floating' && !panels.resultsCollapsed && <PanelResizeHandles onResize={(edge, event) => startPanelResize('results', edge, event)}/>}
    </section>;
}
