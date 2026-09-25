import { linkHorizontal } from 'd3';
import { useId, useMemo, useState } from 'react';
import type { Connection } from '../../shared/types';
import { layoutLineage, type LineageEdge, type LineageNode, type LineageSnapshot } from '../../shared/materialized-view-lineage';
import { nativeCount, nativeTime } from '../../shared/native-format';
import { useNativeExplorer } from '../useNativeExplorer';
import { NativeExplorerDialog } from './NativeExplorerDialog';
import { Button } from './ui';

const modeLabels = { incremental: 'Incremental MV', refreshable: 'Refreshable MV', 'append-incremental': 'Append incremental refresh', unknown: 'Mode unavailable' };
const edgeLabels: Record<LineageEdge['kind'], string> = { 'insert-trigger': 'Insert trigger', 'writes-to': 'Writes to', 'refresh-dependency': 'Refresh ordering', 'catalog-dependency': 'Catalog dependency' };
const nodeLabel = (node: LineageNode) => node.mode ? modeLabels[node.mode] : node.engine;
function NodeDetails({ node, snapshot }: { node: LineageNode; snapshot: LineageSnapshot }) {
    const upstream = snapshot.edges.filter(edge => edge.target === node.id), downstream = snapshot.edges.filter(edge => edge.source === node.id);
    const refresh = node.refresh;
    return <aside className="native-node-details" aria-label="Selected object">
        <span className="eyebrow">{nodeLabel(node)}</span><h3>{node.database}.{node.table}</h3>
        <dl className="native-metrics"><div><dt>Incoming relationships</dt><dd>{upstream.length}</dd></div><div><dt>Outgoing relationships</dt><dd>{downstream.length}</dd></div></dl>
        {node.schedule && <p className="native-schedule">{node.schedule}</p>}
        {refresh ? <><span className="native-badge">{refresh.status}</span>{refresh.progress !== undefined && <progress aria-label="Refresh progress" value={refresh.progress} max={1}/>}
            <dl className="native-detail-list"><dt>Last successful refresh</dt><dd>{nativeTime(refresh.lastSuccessAt)}</dd><dt>Last successful duration</dt><dd>{refresh.lastSuccessDurationMs === undefined ? 'Unavailable' : `${nativeCount(refresh.lastSuccessDurationMs)} ms`}</dd><dt>Latest attempt</dt><dd>{nativeTime(refresh.lastAttemptAt)}</dd><dt>Next refresh</dt><dd>{nativeTime(refresh.nextRefreshAt)}</dd><dt>Rows read / written</dt><dd>{nativeCount(refresh.readRows)} / {nativeCount(refresh.writtenRows)}</dd></dl>
            {refresh.exception && <pre className="native-warning">{refresh.exception}</pre>}
        </> : node.kind === 'materialized-view' && <p className="native-notes">{node.mode === 'incremental' ? 'Triggered by inserted blocks; no periodic refresh schedule.' : 'No refresh telemetry available for this object.'}</p>}
        <div className="native-relationships">{[...upstream, ...downstream].map(edge => { const related = snapshot.nodes.find(item => item.id === (edge.source === node.id ? edge.target : edge.source)); return <p key={JSON.stringify(edge)}><span>{edgeLabels[edge.kind]} {edge.source === node.id ? '→' : '←'}</span><code>{related?.database}.{related?.table}</code></p>; })}</div>
        {node.definition && <details><summary>CREATE definition{node.definitionTruncated ? ' (truncated)' : ''}</summary><pre className="native-sql">{node.definition}</pre></details>}
    </aside>;
}
function LineageGraph({ snapshot }: { snapshot: LineageSnapshot }) {
    const [search, setSearch] = useState(''), [selected, setSelected] = useState('');
    const marker = useId().replace(/[^a-zA-Z0-9]/g, '');
    const graph = useMemo(() => {
        const query = search.trim().toLowerCase();
        const matches = new Set(snapshot.nodes.filter(node => `${node.database}.${node.table}`.toLowerCase().includes(query)).map(node => node.id));
        const visible = new Set(matches);
        if (query) for (const edge of snapshot.edges) if (matches.has(edge.source) || matches.has(edge.target)) { visible.add(edge.source); visible.add(edge.target); }
        const nodes = snapshot.nodes.filter(node => visible.has(node.id)).slice(0, 120), ids = new Set(nodes.map(node => node.id));
        const edges = snapshot.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
        return { ...layoutLineage(nodes, edges), edges, clipped: visible.size > nodes.length };
    }, [search, snapshot]);
    const selectedNode = snapshot.nodes.find(node => node.id === selected) ?? graph.nodes.find(node => node.kind === 'materialized-view') ?? graph.nodes[0];
    const positions = new Map(graph.nodes.map(node => [node.id, node]));
    const curve = linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>().x(point => point[0]).y(point => point[1]);
    return <><div className="native-toolbar"><label className="native-search">Find an object<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter by database or table"/></label><span>{graph.nodes.length} objects · {graph.edges.length} relationships</span></div>
        <div className="native-lineage-legend">{Object.entries(edgeLabels).map(([kind, label]) => <span key={kind} className={`edge-${kind}`}>{label}</span>)}</div>
        {(graph.clipped || snapshot.truncated) && <p className="native-warning">This graph is bounded. Search to focus the displayed objects; metadata outside the snapshot remains unavailable.</p>}
        {graph.hasCycle && <p className="native-notes">Cyclic or unresolved dependencies appear in the final column.</p>}
        {!graph.nodes.length ? <div className="native-empty">{search ? 'No matching objects.' : 'No materialized-view relationships were returned for this database.'}</div> : <div className="native-lineage-layout">
            <div className="native-lineage-canvas" tabIndex={0} aria-label="Materialized view dependency graph. Scroll to explore.">
                <svg width={graph.width} height={graph.height} role="group" aria-label="Dependency graph">
                    <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>
                    {graph.edges.map(edge => { const from = positions.get(edge.source)!, to = positions.get(edge.target)!; return <path key={JSON.stringify(edge)} className={`native-edge edge-${edge.kind}`} d={curve({ source: [from.x + 224, from.y + 36], target: [to.x - 3, to.y + 36] }) ?? ''} markerEnd={`url(#${marker})`}><title>{edgeLabels[edge.kind]}: {from.table} → {to.table}</title></path>; })}
                    {graph.nodes.map(node => <g key={node.id} transform={`translate(${node.x},${node.y})`} className={`native-lineage-node ${node.kind} ${node.id === selectedNode?.id ? 'is-selected' : ''}`} tabIndex={0} role="button" aria-label={`${node.database}.${node.table}: ${nodeLabel(node)}`} aria-pressed={node.id === selectedNode?.id} onClick={() => setSelected(node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(node.id); } }}><title>{node.database}.{node.table} · {nodeLabel(node)}</title><rect width="224" height="74" rx="12"/><text x="14" y="21" className="native-node-kind">{nodeLabel(node).slice(0, 30)}</text><text x="14" y="43">{node.table.length > 26 ? `${node.table.slice(0, 25)}…` : node.table}</text><text x="14" y="61" className="native-node-meta">{node.refresh?.status ?? node.database}</text></g>)}
                </svg>
            </div>{selectedNode && <NodeDetails node={selectedNode} snapshot={snapshot}/>}
        </div>}</>;
}
export function MaterializedViewExplorer({ connection, database, onClose, embedded = false, active = true }: { connection: Pick<Connection, 'id'>; database: string; onClose?: () => void; embedded?: boolean; active?: boolean }) {
    const { snapshot, loading, error, refresh } = useNativeExplorer(connection.id, { kind: 'lineage', database }, active, false);
    const current = snapshot?.kind === 'lineage' ? snapshot : undefined;
    const content = <>
        <div className="native-toolbar"><span className="native-snapshot-meta">{current?.source === 'fixture' ? 'SAMPLE DATA · static' : 'SERVER METADATA'}{current && ` · ${nativeTime(current.observedAt)}`}</span><Button onClick={refresh} disabled={loading}>Refresh metadata</Button></div>
        {error && <div role="alert" className="native-warning">{error}{current && <p>The previous snapshot is shown below.</p>}</div>}
        {loading && !current && <div className="native-empty" role="status">Reading materialized-view metadata…</div>}
        {current && <><LineageGraph snapshot={current}/><footer className="native-notes">{current.notes.map(note => <p key={note}>{note}</p>)}</footer></>}
    </>;
    return embedded ? content : <NativeExplorerDialog title="Materialized view dependencies" description={`${database} · Insert triggers, write targets, and refresh schedules`} onClose={() => onClose?.()}>{content}</NativeExplorerDialog>;
}
