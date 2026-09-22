import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { graphStratify, sugiyama } from 'd3-dag';
import { select } from 'd3-selection';
import { curveBumpY, line } from 'd3-shape';
import 'd3-transition';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import type { ProfilePipeline, ProfilePipelineNode } from '../../shared/types';
import { Action } from '../ui';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 88;
const PADDING = 42;

interface DagDatum {
    id: string;
    parentIds: string[];
    node: ProfilePipelineNode;
}

interface PositionedNode {
    id: string;
    data: DagDatum;
    x: number;
    y: number;
}

interface PositionedLink {
    source: PositionedNode;
    target: PositionedNode;
    points: [number, number][];
}

interface Layout {
    width: number;
    height: number;
    nodes: PositionedNode[];
    links: PositionedLink[];
}

function layoutPipeline(pipeline: ProfilePipeline): Layout {
    const parents = new Map(pipeline.nodes.map(node => [node.id, [] as string[]]));
    for (const edge of pipeline.edges)
        parents.get(edge.target)?.push(edge.source);
    const data: DagDatum[] = pipeline.nodes.map(node => ({ id: node.id, parentIds: parents.get(node.id) ?? [], node }));
    const stratify = graphStratify().id((datum: DagDatum) => datum.id).parentIds((datum: DagDatum) => datum.parentIds);
    const dag = stratify(data);
    const layout = sugiyama().nodeSize([NODE_WIDTH, NODE_HEIGHT]).gap([34, 58]);
    const dimensions = layout(dag);
    const nodes = [...dag.nodes()].map(node => ({ id: node.data.id, data: node.data, x: node.x + PADDING, y: node.y + PADDING }));
    const positions = new Map(nodes.map(node => [node.id, node]));
    const links = [...dag.links()].map(link => ({ source: positions.get(link.source.data.id)!, target: positions.get(link.target.data.id)!, points: link.points.map(([x, y]) => [x + PADDING, y + PADDING] as [number, number]) }));
    return { width: dimensions.width + PADDING * 2, height: dimensions.height + PADDING * 2, nodes, links };
}

function label(value: string, length = 28) {
    return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function metric(node: ProfilePipelineNode) {
    const values = [node.durationMs === undefined ? undefined : `${Math.round(node.durationMs)} ms`, node.rows ? `${node.rows} rows` : undefined, node.bytes ? `${node.bytes} bytes` : undefined].filter(Boolean);
    return values.join(' · ') || (node.status === 'estimated' ? 'shape estimate' : 'stage evidence');
}

export function PipelineGraph({ pipeline }: { pipeline: ProfilePipeline }) {
    const svgRef = useRef<SVGSVGElement>(null), zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null), [selectedId, setSelectedId] = useState<string>();
    const markerId = `pipeline-arrow-${useId().replace(/:/g, '-')}`;
    const layout = useMemo(() => layoutPipeline(pipeline), [pipeline]);
    const selected = layout.nodes.find(node => node.id === selectedId);

    useEffect(() => {
        const svgElement = svgRef.current;
        if (!svgElement)
            return;
        const svg = select(svgElement);
        svg.selectAll('*').remove();
        svg.append('defs').append('marker').attr('id', markerId).attr('viewBox', '0 -5 10 10').attr('refX', 9).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto').append('path').attr('d', 'M0,-5L10,0L0,5Z').attr('class', 'pipeline-arrow');
        const viewport = svg.append('g').attr('class', 'pipeline-viewport');
        const path = line<[number, number]>().x(point => point[0]).y(point => point[1]).curve(curveBumpY);
        const links = viewport.append('g').attr('class', 'pipeline-links').selectAll<SVGPathElement, PositionedLink>('path').data(layout.links, link => `${link.source.id}-${link.target.id}`).join('path').attr('d', link => path(link.points) ?? '').attr('class', 'pipeline-link').attr('marker-end', `url(#${markerId})`);
        const nodes = viewport.append('g').attr('class', 'pipeline-nodes').selectAll<SVGGElement, PositionedNode>('g').data(layout.nodes, node => node.id).join('g').attr('class', node => `pipeline-node kind-${node.data.node.kind} ${node.data.node.status}`).attr('transform', node => `translate(${node.x - NODE_WIDTH / 2},${node.y - NODE_HEIGHT / 2})`).attr('tabindex', 0).attr('role', 'button').attr('aria-label', node => `${node.data.node.label}, ${metric(node.data.node)}`).on('click', (_event, node) => setSelectedId(node.id)).on('keydown', (event, node) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedId(node.id);
            }
        });
        nodes.append('rect').attr('class', 'pipeline-node-surface').attr('width', NODE_WIDTH).attr('height', NODE_HEIGHT).attr('rx', 12);
        nodes.append('rect').attr('class', 'pipeline-node-accent').attr('width', 4).attr('height', NODE_HEIGHT).attr('rx', 2);
        nodes.append('text').attr('class', 'pipeline-node-label').attr('x', 18).attr('y', 27).text(node => label(node.data.node.label));
        nodes.append('text').attr('class', 'pipeline-node-detail').attr('x', 18).attr('y', 51).text(node => metric(node.data.node));
        nodes.append('text').attr('class', 'pipeline-node-kind').attr('x', 18).attr('y', 72).text(node => node.data.node.kind);
        const zoomBehavior = zoom<SVGSVGElement, unknown>().scaleExtent([0.35, 3]).on('zoom', event => viewport.attr('transform', event.transform));
        zoomRef.current = zoomBehavior;
        svg.call(zoomBehavior).on('dblclick.zoom', null);
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            links.attr('opacity', 0).transition().duration(420).attr('opacity', 1);
            nodes.attr('opacity', 0).transition().duration(320).delay((_datum, index) => index * 55).attr('opacity', 1);
        }
        return () => {
            svg.on('.zoom', null);
            links.interrupt();
            nodes.interrupt();
            zoomRef.current = null;
        };
    }, [layout, markerId]);

    useEffect(() => {
        const svgElement = svgRef.current;
        if (!svgElement)
            return;
        const related = new Set<string>();
        if (selectedId) {
            related.add(selectedId);
            for (const link of layout.links) {
                if (link.source.id === selectedId || link.target.id === selectedId) {
                    related.add(link.source.id);
                    related.add(link.target.id);
                }
            }
        }
        const svg = select(svgElement);
        svg.selectAll<SVGGElement, PositionedNode>('.pipeline-node').classed('is-selected', node => node.id === selectedId).classed('is-muted', node => Boolean(selectedId) && !related.has(node.id));
        svg.selectAll<SVGPathElement, PositionedLink>('.pipeline-link').classed('is-related', link => !selectedId || link.source.id === selectedId || link.target.id === selectedId).classed('is-muted', link => Boolean(selectedId) && link.source.id !== selectedId && link.target.id !== selectedId);
    }, [layout.links, selectedId]);

    const changeZoom = (factor: number) => {
        if (svgRef.current && zoomRef.current)
            select(svgRef.current).transition().duration(220).call(zoomRef.current.scaleBy, factor);
    };
    const resetView = () => {
        if (svgRef.current && zoomRef.current)
            select(svgRef.current).transition().duration(250).call(zoomRef.current.transform, zoomIdentity);
    };
    return <section className="pipeline-graph" aria-label="ClickHouse execution pipeline"><div className="pipeline-graph-toolbar"><div><span className="eyebrow">Execution map · {layout.nodes.length} stages</span><strong>{pipeline.source === 'explain_pipeline' ? 'ClickHouse processor evidence' : 'Query-shape sketch'}</strong></div><div className="toolbar"><span className="pipeline-legend"><i className="pipeline-legend-dot measured"/> measured <i className="pipeline-legend-dot estimated"/> inferred</span><div className="pipeline-zoom-controls" role="group" aria-label="Graph zoom"><Action type="empty" aria-label="Zoom out" title="Zoom out" onClick={() => changeZoom(0.8)}>−</Action><Action type="empty" aria-label="Zoom in" title="Zoom in" onClick={() => changeZoom(1.25)}>+</Action><Action type="empty" onClick={resetView}>Fit graph</Action></div></div></div><div className="pipeline-canvas"><svg ref={svgRef} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`${layout.nodes.length} execution stages`}/></div><p className="muted pipeline-graph-notice">{pipeline.notice} Drag to pan. Scroll to zoom. Select a stage to focus its neighbors.</p>{selected && <aside className="pipeline-selection"><div className="toolbar spread"><strong>{selected.data.node.label}</strong><Action type="empty" onClick={() => setSelectedId(undefined)}>Clear</Action></div><p className="muted">{selected.data.node.detail ?? metric(selected.data.node)}</p><dl><div><dt>Kind</dt><dd>{selected.data.node.kind}</dd></div><div><dt>Evidence</dt><dd>{selected.data.node.status}</dd></div>{selected.data.node.durationMs !== undefined && <div><dt>Duration</dt><dd>{Math.round(selected.data.node.durationMs)} ms</dd></div>}{selected.data.node.rows && <div><dt>Rows</dt><dd>{selected.data.node.rows}</dd></div>}{selected.data.node.bytes && <div><dt>Bytes</dt><dd>{selected.data.node.bytes}</dd></div>}</dl></aside>}</section>;
}
