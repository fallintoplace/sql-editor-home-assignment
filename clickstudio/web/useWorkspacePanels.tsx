import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
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

export type PanelPointerStartEvent = {
    clientX: number;
    clientY: number;
    target: EventTarget | null;
    preventDefault: () => void;
    stopPropagation: () => void;
};

const PANEL_RESIZE_EDGES: readonly PanelResizeEdge[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const panelViewport = () => ({ width: window.innerWidth, height: window.innerHeight });

export const panelTargetIsInteractive = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('button, input, select, textarea, a, [role="tab"], [role="button"]'));

export function PanelResizeHandles({ onResize }: { onResize: (edge: PanelResizeEdge, event: PanelPointerStartEvent) => void }) {
    return <>{PANEL_RESIZE_EDGES.map(edge =>
        <span
            key={edge}
            aria-hidden="true"
            className={`workspace-panel-resize-handle edge-${edge}`}
            data-edge={edge}
            onPointerDown={event => onResize(edge, event)}
        />)}</>;
}

export function useWorkspacePanels({
    compactViewport,
    queryCollapsed,
    setQueryCollapsed,
    resultsCollapsed,
    setResultsCollapsed,
    hasOutput,
}: {
    compactViewport: boolean;
    queryCollapsed: boolean;
    setQueryCollapsed: Dispatch<SetStateAction<boolean>>;
    resultsCollapsed: boolean;
    setResultsCollapsed: Dispatch<SetStateAction<boolean>>;
    hasOutput: boolean;
}) {
    const [panelLayout, setPanelLayout] = useState(() => {
        let stored: string | null = null;
        try { stored = window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY); } catch {}
        return recoverWorkspacePanelLayout(stored, panelViewport());
    });
    const [activeFloatingPanel, setActiveFloatingPanel] = useState<WorkspacePanelId>('query');
    const queryPanelRef = useRef<HTMLElement>(null);
    const resultsPanelRef = useRef<HTMLElement>(null);
    const workspaceContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try { window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(panelLayout)); } catch {}
    }, [panelLayout]);

    useEffect(() => {
        const normalize = () => setPanelLayout(current => normalizeWorkspacePanelLayout(current, panelViewport()));
        window.addEventListener('resize', normalize);
        return () => window.removeEventListener('resize', normalize);
    }, []);

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
        if (mode === 'maximized')
            return { left: 8, top: 8, width: 'calc(100vw - 16px)', height: 'calc(100dvh - 16px)', zIndex };
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
            [panel]: { ...current[panel], mode: current[panel].mode === 'docked' ? 'floating' : 'docked' },
        }));
    };
    const togglePanelMaximized = (panel: WorkspacePanelId) => {
        if (compactViewport) return;
        setPanelExpanded(panel);
        setActiveFloatingPanel(panel);
        setPanelLayout(current => ({
            ...current,
            [panel]: { ...current[panel], mode: current[panel].mode === 'maximized' ? 'floating' : 'maximized' },
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
        const startX = event.clientX, startY = event.clientY;
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
    const canSplitPanels = Boolean(hasOutput
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

    return {
        panelLayout,
        setPanelLayout,
        activeFloatingPanel,
        setActiveFloatingPanel,
        queryPanelRef,
        resultsPanelRef,
        workspaceContentRef,
        queryMode,
        resultsMode,
        queryFloating,
        resultsFloating,
        panelStyle,
        togglePanelFloating,
        togglePanelMaximized,
        startPanelDrag,
        startPanelResize,
        canSplitPanels,
        workspaceLayoutStyle,
        startPanelSplit,
    };
}

export type WorkspacePanelController = ReturnType<typeof useWorkspacePanels>;
