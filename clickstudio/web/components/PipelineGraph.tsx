import { useEffect, useMemo, useState, useId, type KeyboardEvent } from 'react';
import { dagre } from 'd3-dag';
import type { ProfilePipeline, ProfilePipelineNode } from '../../shared/types';
import type { Copy } from '../i18n';

const nodeWidth = 220;
const nodeHeight = 74;
const graphPadding = 28;

type PositionedNode = { node: ProfilePipelineNode; x: number; y: number };
type PositionedEdge = { source: string; target: string; label?: string; points: Array<{ x: number; y: number }> };
type GraphLayout = { width: number; height: number; nodes: PositionedNode[]; edges: PositionedEdge[] };

function fallbackLayout(pipeline: ProfilePipeline): GraphLayout {
    const byId = new Map(pipeline.nodes.map(node => [node.id, node]));
    const ranks = new Map(pipeline.nodes.map(node => [node.id, 0]));
    const incoming = new Map(pipeline.nodes.map(node => [node.id, 0]));
    const outgoing = new Map(pipeline.nodes.map(node => [node.id, [] as string[]]));
    for (const edge of pipeline.edges) {
        if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
        incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
        outgoing.get(edge.source)?.push(edge.target);
    }
    const queue = pipeline.nodes.filter(node => incoming.get(node.id) === 0).map(node => node.id);
    const visited = new Set<string>();
    while (queue.length) {
        const id = queue.shift()!;
        visited.add(id);
        for (const next of outgoing.get(id) ?? []) {
            ranks.set(next, Math.max(ranks.get(next) ?? 0, (ranks.get(id) ?? 0) + 1));
            incoming.set(next, (incoming.get(next) ?? 1) - 1);
            if (incoming.get(next) === 0) queue.push(next);
        }
    }
    let nextRank = Math.max(0, ...ranks.values()) + 1;
    for (const node of pipeline.nodes) {
        if (!visited.has(node.id)) ranks.set(node.id, nextRank++);
    }
    const layers = new Map<number, ProfilePipelineNode[]>();
    for (const node of pipeline.nodes) {
        const rank = ranks.get(node.id) ?? 0;
        layers.set(rank, [...(layers.get(rank) ?? []), node]);
    }
    const maxLayerSize = Math.max(1, ...[...layers.values()].map(layer => layer.length));
    const width = maxLayerSize * (nodeWidth + 32) + graphPadding * 2;
    const height = layers.size * (nodeHeight + 54) + graphPadding * 2;
    const positions = new Map<string, { x: number; y: number }>();
    for (const [rank, layer] of layers) {
        layer.forEach((node, index) => positions.set(node.id, {
            x: graphPadding + (index + 0.5) * (width - graphPadding * 2) / layer.length,
            y: graphPadding + rank * (nodeHeight + 54) + nodeHeight / 2,
        }));
    }
    return {
        width,
        height,
        nodes: pipeline.nodes.flatMap(node => {
            const position = positions.get(node.id);
            return position ? [{ node, ...position }] : [];
        }),
        edges: pipeline.edges.flatMap(edge => {
            const start = positions.get(edge.source), end = positions.get(edge.target);
            if (!start || !end) return [];
            const middleY = (start.y + end.y) / 2;
            return [{ ...edge, points: [{ x: start.x, y: start.y + nodeHeight / 2 }, { x: start.x, y: middleY }, { x: end.x, y: middleY }, { x: end.x, y: end.y - nodeHeight / 2 }] }];
        }),
    };
}

function layoutPipeline(pipeline: ProfilePipeline): GraphLayout {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: 'TB', nodesep: 34, ranksep: 74, quality: 'fast' });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const node of pipeline.nodes) graph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    const edgeKeys = new Set<string>();
    for (const edge of pipeline.edges) {
        if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
        const key = `${edge.source}\u0000${edge.target}`;
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        graph.setEdge(edge.source, edge.target);
    }
    try {
        dagre.layout(graph);
        const dimensions = graph.graph();
        if (!Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height)) return fallbackLayout(pipeline);
        const positions = new Map(graph.nodes().map(id => {
            const position = graph.node(id);
            return [id, { x: position.x + graphPadding, y: position.y + graphPadding }] as const;
        }));
        return {
            width: dimensions.width + graphPadding * 2,
            height: dimensions.height + graphPadding * 2,
            nodes: pipeline.nodes.flatMap(node => {
                const position = positions.get(node.id);
                return position ? [{ node, ...position }] : [];
            }),
            edges: pipeline.edges.flatMap(edge => {
                if (!graph.hasEdge(edge.source, edge.target)) return [];
                const points = graph.edge(edge.source, edge.target).points.map(point => ({ x: point.x + graphPadding, y: point.y + graphPadding }));
                return points.length ? [{ ...edge, points }] : [];
            }),
        };
    }
    catch {
        return fallbackLayout(pipeline);
    }
}

function labelLines(label: string) {
    const words = label.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        if (current && `${current} ${word}`.length > 28) {
            lines.push(current);
            current = word;
        }
        else current = current ? `${current} ${word}` : word;
    }
    if (current) lines.push(current);
    if (lines.length > 2) lines[1] = `${lines[1]!.slice(0, 25)}…`;
    return lines.slice(0, 2);
}

function pathFor(points: PositionedEdge['points']) {
    return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
}

function sqlFlowNodeKind(kind: string, copy?: Copy['common']) {
    const translation: Partial<Record<ProfilePipelineNode['kind'], keyof Copy['common']>> = {
        read: 'sqlFlowReadKind', filter: 'sqlFlowFilterKind', aggregate: 'sqlFlowAggregateKind', sort: 'sqlFlowSortKind',
        resize: 'sqlFlowResizeKind', join: 'sqlFlowJoinKind', transform: 'sqlFlowTransformKind', output: 'sqlFlowOutputKind', stage: 'sqlFlowStageKind',
    };
    const key = translation[kind as ProfilePipelineNode['kind']];
    return key && copy ? copy[key] : kind;
}

function sqlFlowNodeStatus(status: string, copy?: Copy['common']) {
    return status === 'estimated' ? copy?.sqlFlowEstimatedStatus ?? status : status;
}

function sqlFlowNodeLabel(node: ProfilePipelineNode, copy?: Copy['common']) {
    if (!copy) return node.label;
    if (node.kind === 'output' && node.label === 'Return result') return copy.sqlFlowReturnResult;
    if (node.kind === 'filter') return `${node.label.split(' · ')[0]} · ${copy.sqlFlowFilterKind}`;
    if (node.kind === 'aggregate' && node.label.startsWith('Aggregate · ')) return `${copy.sqlFlowAggregateKind} · ${node.label.slice('Aggregate · '.length)}`;
    if (node.kind === 'sort' && node.label.startsWith('ORDER BY · ')) return `ORDER BY · ${copy.sqlFlowSortKind}`;
    if (node.kind === 'join' && node.label.startsWith('Join · ')) return `${copy.sqlFlowJoinKind} · ${node.label.slice('Join · '.length)}`;
    if (node.kind === 'transform') {
        if (node.label.startsWith('Project · ')) return `${copy.sqlFlowTransformKind} · ${node.label.slice('Project · '.length)}`;
        if (node.label.startsWith('Window · ')) return `${copy.sqlFlowTransformKind} · ${node.label.slice('Window · '.length)}`;
        if (node.label.startsWith('LIMIT / OFFSET · ')) return `LIMIT / OFFSET · ${copy.sqlFlowTransformKind}`;
    }
    return node.label;
}

function sqlFlowNodeDetail(node: ProfilePipelineNode, copy?: Copy['common']) {
    if (!node.detail || !copy) return node.detail;
    if (node.detail === 'Table source') return copy.sqlFlowSourceDetail;
    if (node.detail.startsWith('Table source · alias ')) return `${copy.sqlFlowSourceDetail} · alias ${node.detail.slice('Table source · alias '.length)}`;
    if (node.detail === 'Columns produced by the SELECT list') return copy.sqlFlowOutputColumns;
    return node.detail;
}

export function PipelineGraph({ pipeline, heading, subheading, graphKind = 'execution', onSelectNode, copy }: {
    pipeline: ProfilePipeline;
    heading?: string;
    subheading?: string;
    graphKind?: 'execution' | 'sql-flow';
    onSelectNode?: (node: ProfilePipelineNode) => void;
    copy?: Copy['common'];
}) {
    const layout = useMemo(() => layoutPipeline(pipeline), [pipeline]);
    const [selectedId, setSelectedId] = useState<string | undefined>(pipeline.nodes[0]?.id);
    useEffect(() => setSelectedId(pipeline.nodes[0]?.id), [pipeline]);
    const selected = pipeline.nodes.find(node => node.id === selectedId) ?? pipeline.nodes[0];
    const markerId = `pipeline-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const incomingCount = selected ? pipeline.edges.filter(edge => edge.target === selected.id).length : 0;
    const outgoingCount = selected ? pipeline.edges.filter(edge => edge.source === selected.id).length : 0;
    const chooseNode = (node: ProfilePipelineNode) => {
        setSelectedId(node.id);
        onSelectNode?.(node);
    };
    const onNodeKeyDown = (event: KeyboardEvent<SVGGElement>, node: ProfilePipelineNode) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        chooseNode(node);
    };

    if (!pipeline.nodes.length) return <div className="pipeline-graph-empty">{graphKind === 'sql-flow' ? copy?.sqlFlowNoStages ?? 'No SQL stages were found in this statement.' : 'This pipeline did not return any operator nodes.'}</div>;

    const terminology = graphKind === 'sql-flow'
        ? { graph: copy?.sqlMap ?? 'SQL flow graph', item: copy?.sqlFlowStages ?? 'stages', selected: copy?.sqlFlowSelectedStage ?? 'Selected stage', action: copy?.sqlFlowInspectStage ?? 'Inspect stage', details: copy?.sqlFlowStageDetails ?? 'Selected stage details' }
        : { graph: 'Execution plan graph', item: copy?.sqlFlowOperators ?? 'operators', selected: 'Selected operator', action: 'Inspect operator', details: 'Selected operator details' };
    const connectionLabel = graphKind === 'sql-flow' ? copy?.sqlFlowConnections ?? 'connections' : 'connections';

    return <section className="pipeline-graph-card grid gap-3 rounded-xl border p-3" aria-label={terminology.graph}>
        <div className="pipeline-graph-heading">
            <div><span className="eyebrow">{heading ?? (pipeline.source === 'explain_pipeline' ? 'CLICKHOUSE OPERATOR PLAN' : 'ESTIMATED QUERY SHAPE')}</span><strong>{pipeline.nodes.length.toLocaleString()} {terminology.item} <i>·</i> {pipeline.edges.length.toLocaleString()} {connectionLabel}</strong></div>
            <small>{subheading ?? (pipeline.source === 'explain_pipeline' ? 'Planned topology · runtime counters are run-level' : 'Estimated from SQL structure')}</small>
        </div>
        {pipeline.truncated && <p className="pipeline-graph-warning" role="status">{graphKind === 'sql-flow' ? copy?.sqlFlowTruncatedWarning ?? 'This query is large. The graph shows a bounded set of SQL stages.' : 'This plan is large. The graph shows a bounded set of operators.'}</p>}
        <div className="pipeline-graph-scroll overflow-auto" role="region" aria-label={graphKind === 'sql-flow' ? copy?.sqlMap ?? 'Scrollable SQL flow graph' : 'Scrollable operator graph'}>
            <svg className="pipeline-graph-svg" width={Math.max(480, layout.width)} height={Math.max(160, layout.height)} viewBox={`0 0 ${Math.max(480, layout.width)} ${Math.max(160, layout.height)}`} role="group" aria-label={graphKind === 'sql-flow' ? copy?.sqlFlowGraphHint ?? 'Click a stage to inspect it' : 'Click an operator to inspect it'}>
                <defs><marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" className="pipeline-graph-arrow"/></marker></defs>
                <g className="pipeline-graph-edges" aria-hidden="true">
                    {layout.edges.map((edge, index) => {
                        const middle = edge.points[Math.floor(edge.points.length / 2)];
                        return <g key={`${edge.source}-${edge.target}-${index}`}><path d={pathFor(edge.points)} markerEnd={`url(#${markerId})`}/>{edge.label && middle && <text x={middle.x + 7} y={middle.y - 5}>{edge.label}</text>}</g>;
                    })}
                </g>
                {layout.nodes.map(({ node, x, y }) => {
                    const label = graphKind === 'sql-flow' ? sqlFlowNodeLabel(node, copy) : node.label;
                    const lines = labelLines(label);
                    const active = selected?.id === node.id;
                    return <g key={node.id} role="button" tabIndex={0} aria-label={`${terminology.action} ${label}`} aria-pressed={active} data-node-id={node.id} className={`pipeline-graph-node pipeline-node-${node.kind}${active ? ' is-selected' : ''}`} transform={`translate(${x - nodeWidth / 2} ${y - nodeHeight / 2})`} onClick={() => chooseNode(node)} onKeyDown={event => onNodeKeyDown(event, node)}>
                        <title>{label}</title>
                        <rect width={nodeWidth} height={nodeHeight} rx="11"/>
                        <text className="pipeline-node-kind" x="14" y="19">{(graphKind === 'sql-flow' ? sqlFlowNodeKind(node.kind, copy) : node.kind).toUpperCase()}</text>
                        {lines.map((line, index) => <text className="pipeline-node-label" key={index} x="14" y={43 + index * 15}>{line}</text>)}
                        {node.parallelism !== undefined && <text className="pipeline-node-parallel" x={nodeWidth - 12} y="20" textAnchor="end">× {node.parallelism}</text>}
                        <text className="pipeline-node-status" x={nodeWidth - 12} y={nodeHeight - 11} textAnchor="end">{graphKind === 'sql-flow' ? sqlFlowNodeStatus(node.status, copy) : node.status}</text>
                    </g>;
                })}
            </svg>
        </div>
        {selected && <div className="pipeline-node-inspector" aria-live="polite" aria-label={terminology.details}>
            <div className="pipeline-node-inspector-main"><span className="eyebrow">{terminology.selected.toUpperCase()}</span><strong>{graphKind === 'sql-flow' ? sqlFlowNodeLabel(selected, copy) : selected.label}</strong><small>{graphKind === 'sql-flow' ? sqlFlowNodeKind(selected.kind, copy) : selected.kind} <i>·</i> {graphKind === 'sql-flow' ? sqlFlowNodeStatus(selected.status, copy) : selected.status}</small>{sqlFlowNodeDetail(selected, graphKind === 'sql-flow' ? copy : undefined) && sqlFlowNodeDetail(selected, graphKind === 'sql-flow' ? copy : undefined) !== selected.label && <p>{sqlFlowNodeDetail(selected, graphKind === 'sql-flow' ? copy : undefined)}</p>}</div>
            <div className="pipeline-node-facts">
                {selected.parallelism !== undefined && <span><small>Parallelism</small><strong>{selected.parallelism.toLocaleString()}</strong></span>}
                <span><small>{graphKind === 'sql-flow' ? copy?.sqlFlowInputs ?? 'Inputs' : 'Inputs'}</small><strong>{incomingCount}</strong></span>
                <span><small>{graphKind === 'sql-flow' ? copy?.sqlFlowOutputs ?? 'Outputs' : 'Outputs'}</small><strong>{outgoingCount}</strong></span>
                {selected.durationMs !== undefined && <span><small>Run duration</small><strong>{Math.round(selected.durationMs)} ms</strong></span>}
                {selected.rows !== undefined && <span><small>Run rows</small><strong>{Number(selected.rows).toLocaleString()}</strong></span>}
                {selected.bytes !== undefined && <span><small>Run bytes</small><strong>{selected.bytes}</strong></span>}
            </div>
        </div>}
    </section>;
}
