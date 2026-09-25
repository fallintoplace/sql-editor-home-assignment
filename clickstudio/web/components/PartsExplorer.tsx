import { easeCubicInOut, hierarchy, pack, select, treemap } from 'd3';
import type { HierarchyCircularNode, HierarchyRectangularNode } from 'd3';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { MergeTreePart, MergeTreePartsSnapshot, PartsLayout, PartsMetric } from '../../shared/parts';
import { formatCompressionRatio, scalePartMetrics } from '../../shared/parts';
import type { Connection, SchemaTable } from '../../shared/types';
import type { Copy } from '../i18n';
import { loadTableParts } from '../table-parts-provider';
import { message } from '../api';
import { Button, formatBytes } from './ui';

type Cell = {
    id: string;
    label: string;
    value?: number;
    part?: MergeTreePart;
    colorIndex?: number;
    children?: Cell[];
};

const width = 1_000;
const height = 510;
const palette = ['var(--accent)', 'var(--violet)', 'var(--green)', 'var(--amber)', 'var(--cyan)'];

function exactCount(value: string) {
    try { return BigInt(value).toLocaleString(); } catch { return value; }
}

function exactBytes(value: string) {
    try {
        const bytes = BigInt(value);
        const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
        let unit = 0, divisor = 1n;
        while (bytes >= divisor * 1024n && unit < units.length - 1) { divisor *= 1024n; unit++; }
        if (!unit) return `${exactCount(value)} B`;
        const tenths = (bytes % divisor * 10n) / divisor;
        return `${(bytes / divisor).toLocaleString()}.${tenths} ${units[unit]}`;
    } catch { return formatBytes(value); }
}

function makeTree(snapshot: MergeTreePartsSnapshot, metric: PartsMetric): Cell {
    const values = scalePartMetrics(snapshot.parts, metric);
    const grouped = new Map<string, Cell[]>();
    snapshot.parts.forEach((part, index) => {
        const children = grouped.get(part.partition) ?? [];
        children.push({ id: `part:${part.partition}:${part.name}`, label: part.name, part, value: values[index] });
        grouped.set(part.partition, children);
    });
    return {
        id: 'table',
        label: `${snapshot.database}.${snapshot.table}`,
        children: [...grouped].map(([partition, children], index) => ({
            id: `partition:${partition}`,
            label: partition,
            children,
            colorIndex: index,
        })),
    };
}

function tooltip(part: MergeTreePart) {
    return `${part.name}\n${part.partition}\nRows: ${part.rows}\nMarks: ${part.marks}\nCompressed: ${part.compressedBytes} bytes\nUncompressed: ${part.uncompressedBytes} bytes\nCompression: ${formatCompressionRatio(part)}\nLevel: ${part.level}\nModified: ${part.modifiedAt}`;
}

export function PartsExplorer({ connection, table, copy, onClose }: { connection: Pick<Connection, 'id' | 'dataSource'>; table: SchemaTable; copy: Copy['common']; onClose: () => void }) {
    const [state, setState] = useState<{ key: string; loading: boolean; snapshot?: MergeTreePartsSnapshot; error?: string }>();
    const [metric, setMetric] = useState<PartsMetric>('compressedBytes');
    const [layoutMode, setLayoutMode] = useState<PartsLayout>('treemap');
    const [selectedPart, setSelectedPart] = useState<MergeTreePart>();
    const [zoomedPartition, setZoomedPartition] = useState<string>();
    const transformGroup = useRef<SVGGElement>(null);
    const requestKey = `${connection.id}:${table.database}.${table.name}`;

    useEffect(() => {
        const controller = new AbortController();
        setState({ key: requestKey, loading: true });
        setSelectedPart(undefined);
        setZoomedPartition(undefined);
        void loadTableParts(connection.id, table.database, table.name, controller.signal).then(snapshot => {
            if (!controller.signal.aborted) setState({ key: requestKey, loading: false, snapshot });
        }).catch(error => {
            if (!controller.signal.aborted) setState({ key: requestKey, loading: false, error: message(error) });
        });
        return () => controller.abort();
    }, [connection.id, requestKey, table.database, table.name]);

    const snapshot = state?.key === requestKey ? state.snapshot : undefined;
    const tree = useMemo(() => snapshot ? makeTree(snapshot, metric) : undefined, [metric, snapshot]);
    const layout = useMemo(() => {
        if (!tree) return undefined;
        const root = hierarchy(tree, node => node.children).sum(node => node.value ?? 0).sort((left, right) => (right.value ?? 0) - (left.value ?? 0));
        return layoutMode === 'treemap'
            ? treemap<Cell>().size([width, height]).paddingInner(3).paddingTop(node => node.depth === 1 ? 25 : 3).round(true)(root)
            : pack<Cell>().size([width, height]).padding(4)(root);
    }, [layoutMode, tree]);

    useEffect(() => {
        const group = transformGroup.current;
        if (!group || !layout) return;
        const selected = layout.descendants().find(node => node.data.id === zoomedPartition);
        let transform = 'translate(0,0) scale(1)';
        if (selected) {
            const bounds = layoutMode === 'treemap'
                ? (() => {
                    const rect = selected as HierarchyRectangularNode<Cell>;
                    return { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1 };
                })()
                : (() => {
                    const circle = selected as HierarchyCircularNode<Cell>;
                    return { x0: circle.x - circle.r, y0: circle.y - circle.r, x1: circle.x + circle.r, y1: circle.y + circle.r };
                })();
            const scale = Math.min(width / Math.max(1, bounds.x1 - bounds.x0), height / Math.max(1, bounds.y1 - bounds.y0)) * 0.94;
            const x = (width - (bounds.x0 + bounds.x1) * scale) / 2;
            const y = (height - (bounds.y0 + bounds.y1) * scale) / 2;
            transform = `translate(${x},${y}) scale(${scale})`;
        }
        select(group).interrupt().transition().duration(520).ease(easeCubicInOut).attr('transform', transform);
    }, [layout, layoutMode, zoomedPartition]);

    useEffect(() => {
        const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    const current = state?.key === requestKey ? state : undefined;
    const partitions = snapshot ? new Set(snapshot.parts.map(part => part.partition)).size : 0;
    const activeMetricLabel = metric === 'compressedBytes' ? copy.partsMetricSize : metric === 'rows' ? copy.partsMetricRows : copy.partsMetricMarks;
    const selectedPartition = zoomedPartition?.replace(/^partition:/, '');
    const partitionParts = selectedPartition && snapshot ? snapshot.parts.filter(part => part.partition === selectedPartition) : [];
    const handleCell = (id: string, part?: MergeTreePart) => {
        if (id.startsWith('partition:')) {
            setSelectedPart(undefined);
            setZoomedPartition(currentZoom => currentZoom === id ? undefined : id);
        } else if (part) setSelectedPart(part);
    };
    const keyCell = (event: KeyboardEvent<SVGElement>, id: string, part?: MergeTreePart) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleCell(id, part); }
    };

    return <div className="parts-explorer-layer">
        <button className="parts-explorer-scrim" type="button" aria-label={copy.closePanel} onClick={onClose}/>
        <section className="parts-explorer-dialog" role="dialog" aria-modal="true" aria-label={copy.partsExplorerTitle}>
            <header className="parts-explorer-header">
                <div><span className="eyebrow">{copy.partsExplorerTitle.toUpperCase()}</span><h2>{table.database}.{table.name}</h2><p>{copy.partsExplorerDescription}</p></div>
                <Button variant="ghost" className="panel-collapse-button" aria-label={copy.closePanel} onClick={onClose}>×</Button>
            </header>
            <div className="parts-explorer-toolbar">
                <div className="parts-view-control" role="group" aria-label={copy.partsExplorerTitle}>
                    {(['compressedBytes', 'rows', 'marks'] as const).map(value => <button key={value} type="button" aria-pressed={metric === value} onClick={() => setMetric(value)}>{value === 'compressedBytes' ? copy.partsMetricSize : value === 'rows' ? copy.partsMetricRows : copy.partsMetricMarks}</button>)}
                </div>
                <div className="parts-view-control" role="group" aria-label={copy.partsExplorerTitle}>
                    {(['treemap', 'galaxy'] as const).map(value => <button key={value} type="button" aria-pressed={layoutMode === value} onClick={() => setLayoutMode(value)}>{value === 'treemap' ? copy.partsTreemap : copy.partsGalaxy}</button>)}
                </div>
                <span className="parts-count-summary">{snapshot ? `${snapshot.parts.length.toLocaleString()}${snapshot.truncated ? '+' : ''} ${copy.partsActive} · ${partitions} ${copy.partsPartitions}` : current?.loading ? copy.partsLoading : ''}</span>
            </div>
            {current?.loading && <div className="parts-state" role="status">{copy.partsLoading}</div>}
            {current?.error && <div className="parts-state is-error" role="alert">{current.error}</div>}
            {snapshot && !snapshot.parts.length && <div className="parts-state" role="status">{copy.partsEmpty}</div>}
            {snapshot && snapshot.parts.length > 0 && layout && <>
                <div className="parts-graph-meta">
                    <span className="parts-breadcrumb"><button type="button" onClick={() => setZoomedPartition(undefined)}>{snapshot.database}.{snapshot.table}</button>{selectedPartition && <><i>/</i><strong>{selectedPartition}</strong></>}</span>
                    <span>{copy.partsMetricSize}: <strong>{exactBytes(snapshot.totals.compressedBytes)}</strong> · {copy.partsMetricRows}: <strong>{exactCount(snapshot.totals.rows)}</strong></span>
                </div>
                <div className={`parts-graph-viewport is-${layoutMode}`}>
                    <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${copy.partsExplorerTitle} · ${activeMetricLabel}`}>
                        <g ref={transformGroup}>
                            {layout.descendants().slice(1).map(node => {
                                const depth = node.depth;
                                const colorIndex = node.ancestors().find(ancestor => ancestor.depth === 1)?.data.colorIndex ?? 0;
                                const color = palette[colorIndex % palette.length]!;
                                const part = node.data.part;
                                const selected = part && selectedPart?.name === part.name && selectedPart.partition === part.partition;
                                if (layoutMode === 'treemap') {
                                    const rect = node as HierarchyRectangularNode<Cell>;
                                    const cellWidth = Math.max(0, rect.x1 - rect.x0), cellHeight = Math.max(0, rect.y1 - rect.y0);
                                    const label = part?.name ?? node.data.label;
                                    const labelLimit = Math.max(3, Math.floor((cellWidth - 14) / 7));
                                    return <g key={node.data.id} role={depth === 1 ? undefined : 'button'} tabIndex={depth === 1 ? undefined : 0} aria-label={part ? tooltip(part) : undefined} className={`parts-map-cell${depth === 1 ? ' is-partition-cell' : ' is-part-cell'}${selected ? ' is-selected' : ''}`} onClick={depth === 1 ? undefined : () => handleCell(node.data.id, part)} onKeyDown={depth === 1 ? undefined : event => keyCell(event, node.data.id, part)}>
                                        <title>{part ? tooltip(part) : node.data.label}</title>
                                        <rect x={rect.x0} y={rect.y0} width={cellWidth} height={cellHeight} rx={depth === 1 ? 10 : 4} style={{ '--part-color': color } as CSSProperties}/>
                                        {part && cellWidth > 82 && cellHeight > 28 && <text className="parts-cell-label" x={rect.x0 + 7} y={rect.y0 + Math.min(cellHeight - 7, 22)}>{label.length > labelLimit ? `${label.slice(0, labelLimit - 1)}…` : label}</text>}
                                    </g>;
                                }
                                const circle = node as HierarchyCircularNode<Cell>;
                                const radius = circle.r;
                                return <g key={node.data.id} role={depth === 1 ? undefined : 'button'} tabIndex={depth === 1 ? undefined : 0} aria-label={part ? tooltip(part) : undefined} className={`parts-galaxy-cell${depth === 1 ? ' is-partition-cell' : ' is-part-cell'}${selected ? ' is-selected' : ''}`} transform={`translate(${circle.x},${circle.y})`} onClick={depth === 1 ? undefined : () => handleCell(node.data.id, part)} onKeyDown={depth === 1 ? undefined : event => keyCell(event, node.data.id, part)}>
                                    <title>{part ? tooltip(part) : node.data.label}</title>
                                    <circle r={radius} style={{ '--part-color': color } as CSSProperties}/>
                                    {part && radius > 22 && <text className="parts-cell-label" y="3">{part.name.length > 20 ? `${part.name.slice(0, 19)}…` : part.name}</text>}
                                </g>;
                            })}
                            {layout.descendants().filter(node => node.depth === 1).map(node => {
                                if (layoutMode === 'treemap') {
                                    const rect = node as HierarchyRectangularNode<Cell>;
                                    const rectWidth = Math.max(0, rect.x1 - rect.x0), rectHeight = Math.max(0, rect.y1 - rect.y0);
                                    const badgeWidth = Math.min(rectWidth, Math.max(36, node.data.label.length * 6 + 18));
                                    const badgeHeight = Math.min(23, rectHeight);
                                    const labelLimit = Math.max(1, Math.floor((badgeWidth - 18) / 6));
                                    return <g key={`${node.data.id}:zoom`} className="parts-partition-zoom" role="button" tabIndex={0} aria-label={copy.partsZoomPartition.replace('{partition}', node.data.label)} onClick={() => handleCell(node.data.id)} onKeyDown={event => keyCell(event, node.data.id)}>
                                        <title>{copy.partsZoomPartition.replace('{partition}', node.data.label)}</title>
                                        <rect x={rect.x0} y={rect.y0} width={badgeWidth} height={badgeHeight} rx="7" style={{ '--part-color': palette[(node.data.colorIndex ?? 0) % palette.length] } as CSSProperties}/>
                                        {badgeWidth > 35 && <text x={rect.x0 + 9} y={rect.y0 + Math.min(16, badgeHeight - 5)}>{node.data.label.length > labelLimit ? `${node.data.label.slice(0, labelLimit - 1)}…` : node.data.label}</text>}
                                    </g>;
                                }
                                const circle = node as HierarchyCircularNode<Cell>;
                                const badgeWidth = Math.min(circle.r * 2, Math.max(36, node.data.label.length * 6 + 18));
                                const labelLimit = Math.max(1, Math.floor((badgeWidth - 18) / 6));
                                return <g key={`${node.data.id}:zoom`} className="parts-partition-zoom is-galaxy-zoom" role="button" tabIndex={0} aria-label={copy.partsZoomPartition.replace('{partition}', node.data.label)} transform={`translate(${circle.x},${circle.y})`} onClick={() => handleCell(node.data.id)} onKeyDown={event => keyCell(event, node.data.id)}>
                                    <title>{copy.partsZoomPartition.replace('{partition}', node.data.label)}</title>
                                    <rect x={-badgeWidth / 2} y={-Math.min(circle.r, 13)} width={badgeWidth} height="21" rx="10" style={{ '--part-color': palette[(node.data.colorIndex ?? 0) % palette.length] } as CSSProperties}/>
                                    {badgeWidth > 35 && <text y={-Math.min(circle.r, 13) + 14}>{node.data.label.length > labelLimit ? `${node.data.label.slice(0, labelLimit - 1)}…` : node.data.label}</text>}
                                </g>;
                            })}
                        </g>
                    </svg>
                    <div className="parts-legend"><span><i className="parts-legend-square"/>{activeMetricLabel}</span>{snapshot.truncated && <span>{copy.partsShowingLimit.replace('{count}', snapshot.parts.length.toLocaleString())}</span>}</div>
                </div>
                <div className="parts-inspector" aria-live="polite">
                    {selectedPart ? <>
                        <div className="parts-inspector-heading"><span className="eyebrow">{copy.partsPart.toUpperCase()}</span><strong>{selectedPart.name}</strong><code>{selectedPart.partition}</code></div>
                        <div className="parts-inspector-stats">
                            <span><small>{copy.partsRows}</small><strong>{exactCount(selectedPart.rows)}</strong></span>
                            <span><small>{copy.partsMarks}</small><strong>{exactCount(selectedPart.marks)}</strong></span>
                            <span><small>{copy.partsCompressed}</small><strong>{exactBytes(selectedPart.compressedBytes)}</strong></span>
                            <span><small>{copy.partsUncompressed}</small><strong>{exactBytes(selectedPart.uncompressedBytes)}</strong></span>
                            <span><small>{copy.partsCompression}</small><strong>{formatCompressionRatio(selectedPart)}</strong></span>
                            <span><small>{copy.partsLevel}</small><strong>{selectedPart.level}</strong></span>
                            <span><small>{copy.partsModified}</small><strong>{selectedPart.modifiedAt}</strong></span>
                        </div>
                    </> : selectedPartition && partitionParts.length > 0 ? <>
                        <div className="parts-inspector-heading"><span className="eyebrow">{copy.partsPartitions.toUpperCase()}</span><strong>{selectedPartition}</strong><code>{partitionParts.length} {copy.partsActive}</code></div>
                        <div className="parts-inspector-stats"><span><small>{copy.partsRows}</small><strong>{exactCount(partitionParts.reduce((sum, part) => sum + BigInt(part.rows), 0n).toString())}</strong></span><span><small>{copy.partsCompressed}</small><strong>{exactBytes(partitionParts.reduce((sum, part) => sum + BigInt(part.compressedBytes), 0n).toString())}</strong></span></div>
                    </> : <p>{copy.partsSelectForDetails}</p>}
                </div>
            </>}
            {connection.dataSource === 'fixture' && snapshot && <span className="parts-fixture-label">{copy.partsFixture}</span>}
            <div className="parts-explorer-footer"><span>{snapshot && `${exactCount(snapshot.totalParts)} ${copy.partsActive}`}</span><Button variant="secondary" className="toolbar-small" onClick={onClose}>{copy.closePanel}</Button></div>
        </section>
    </div>;
}
