import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ClickHouseSystemTableDocumentation, Schema, SchemaDictionary, SchemaTable } from '../../shared/types';
import {
    buildObjectExplorer,
    explorerCategoryId,
    explorerColumnId,
    explorerColumnsId,
    explorerDictionaryId,
    explorerProjectionId,
    explorerProjectionsId,
    explorerSkipIndexId,
    explorerSkipIndexesId,
    tableQuerySql,
    type ExplorerCategoryKind,
    type ExplorerRelation,
    type ExplorerSelection,
} from '../../shared/object-explorer';
import { quoteIdentifier } from '../../shared/sql';
import { api, message } from '../api';
import type { Connected } from '../workspace-types';
import type { Copy } from '../i18n';
import { Button, cx, formatBytes, formatCount, Icon } from './ui';

type ObjectExplorerProps = {
    copy: Copy['common'];
    connection: Connected;
    schema?: Schema;
    schemaLoading: boolean;
    schemaError: string;
    search: string;
    setSearch: (search: string) => void;
    trusted: boolean;
    onRefreshSchema: () => void;
    onInsert: (value: string) => void;
    onOpenSqlDraft: (name: string, sql: string, run: boolean) => void;
};

type ExplorerUiState = {
    selectedId?: string;
    expandedIds: string[];
};

const uiStateKey = (connectionId: string) => `clickstudio:object-explorer:${connectionId}:v1`;

function recoverUiState(key: string): ExplorerUiState {
    try {
        const value = JSON.parse(window.localStorage.getItem(key) ?? 'null') as { selectedId?: unknown; expandedIds?: unknown } | null;
        return {
            selectedId: typeof value?.selectedId === 'string' ? value.selectedId : undefined,
            expandedIds: Array.isArray(value?.expandedIds) ? value.expandedIds.filter((id): id is string => typeof id === 'string').slice(0, 200) : [],
        };
    } catch {
        return { expandedIds: [] };
    }
}

export function ObjectExplorer({ copy, connection, schema, schemaLoading, schemaError, search, setSearch, trusted, onRefreshSchema, onInsert, onOpenSqlDraft }: ObjectExplorerProps) {
    const model = useMemo(() => buildObjectExplorer(schema, search, connection.database), [schema, search, connection.database]);
    const storageKey = uiStateKey(connection.id);
    const recovered = useMemo(() => recoverUiState(storageKey), [storageKey]);
    const [selectedId, setSelectedId] = useState<string | undefined>(() => recovered.selectedId);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(recovered.expandedIds));
    const [copiedId, setCopiedId] = useState<string>();
    const copyTimer = useRef<number | undefined>(undefined);

    useEffect(() => () => {
        if (copyTimer.current !== undefined) window.clearTimeout(copyTimer.current);
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify({ selectedId, expandedIds: [...expandedIds].slice(0, 200) }));
        } catch {
            // The explorer remains usable when local storage is unavailable.
        }
    }, [storageKey, selectedId, expandedIds]);

    const firstVisibleId = useMemo(() => {
        for (const database of model.databases) {
            if (database.tables[0]) return database.tables[0].id;
            if (database.views[0]) return database.views[0].id;
            if (database.dictionaries[0]) return explorerDictionaryId(database.dictionaries[0].database, database.dictionaries[0].name);
        }
        return undefined;
    }, [model.databases]);

    useEffect(() => {
        if (selectedId && model.selectionById.has(selectedId)) return;
        setSelectedId(firstVisibleId);
    }, [firstVisibleId, model.selectionById, selectedId]);

    useEffect(() => {
        if (search || expandedIds.size || !model.databases.length) return;
        const database = model.databases[0]!;
        const firstCategory: ExplorerCategoryKind | undefined = database.tables.length ? 'table' : database.views.length ? 'view' : database.dictionaries.length ? 'dictionary' : undefined;
        if (!firstCategory) return;
        setExpandedIds(new Set([database.id, explorerCategoryId(database.name, firstCategory)]));
    }, [expandedIds.size, model.databases, search]);

    const toggle = (id: string) => setExpandedIds(current => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
    const expanded = (id: string, forced = false) => forced || expandedIds.has(id);
    const selected = selectedId ? model.selectionById.get(selectedId) : undefined;

    const copyText = async (value: string, id: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedId(id);
            if (copyTimer.current !== undefined) window.clearTimeout(copyTimer.current);
            copyTimer.current = window.setTimeout(() => setCopiedId(current => current === id ? undefined : current), 1200);
        } catch {
            // Clipboard availability varies by browser and embedding context.
        }
    };

    const relationChildrenMatch = (relation: ExplorerRelation) =>
        relation.matchedColumns.length > 0 || relation.matchedProjections.length > 0 || relation.matchedSkipIndexes.length > 0;

    const renderRelation = (relation: ExplorerRelation, level: number) => {
        const relationExpanded = expanded(relation.id, Boolean(model.query && relationChildrenMatch(relation)));
        const columnGroupId = explorerColumnsId(relation.table.database, relation.table.name);
        const projectionGroupId = explorerProjectionsId(relation.table.database, relation.table.name);
        const indexGroupId = explorerSkipIndexesId(relation.table.database, relation.table.name);
        const columnsExpanded = expanded(columnGroupId, Boolean(model.query && relation.matchedColumns.length));
        const projectionsExpanded = expanded(projectionGroupId, Boolean(model.query && relation.matchedProjections.length));
        const indexesExpanded = expanded(indexGroupId, Boolean(model.query && relation.matchedSkipIndexes.length));
        const columns = model.query && relation.matchedColumns.length ? relation.matchedColumns : relation.columns;
        const projections = model.query && relation.matchedProjections.length ? relation.matchedProjections : relation.table.projections ?? [];
        const indexes = model.query && relation.matchedSkipIndexes.length ? relation.matchedSkipIndexes : relation.table.skipIndexes ?? [];
        const hasChildren = relation.columns.length > 0 || (relation.table.projections?.length ?? 0) > 0 || (relation.table.skipIndexes?.length ?? 0) > 0;

        return <div className="object-tree-branch" key={relation.id}>
            <div role="treeitem" aria-level={level} aria-expanded={hasChildren ? relationExpanded : undefined} aria-selected={selectedId === relation.id} className={cx('object-tree-row', 'is-object', selectedId === relation.id && 'is-selected')} style={{ paddingLeft: `${Math.max(0, level - 1) * 13}px` }}>
                <button type="button" className="object-tree-toggle" aria-label={relationExpanded ? copy.collapse : copy.expand} disabled={!hasChildren} onClick={() => hasChildren && toggle(relation.id)}><span className={cx(relationExpanded && 'is-open')}>{hasChildren ? '›' : ''}</span></button>
                <button type="button" className="object-tree-main" onClick={() => setSelectedId(relation.id)}>
                    <span className={cx('object-kind-glyph', relation.kind === 'view' && 'is-view')}>{relation.kind === 'view' ? '◇' : '▦'}</span>
                    <span className="object-tree-label"><strong>{relation.table.name}</strong><small>{relation.table.engine}</small></span>
                </button>
                <button type="button" className="object-tree-inline-action" title={copy.insertTableName} aria-label={`${copy.insertTableName}: ${relation.table.name}`} onClick={() => onInsert(qualifiedTableName(relation.table))}>+</button>
            </div>
            {relationExpanded && hasChildren && <div role="group" className="object-tree-children">
                {relation.columns.length > 0 && <>
                    <ExplorerGroupRow level={level + 1} label={copy.columns} count={relation.columns.length} expanded={columnsExpanded} onToggle={() => toggle(columnGroupId)} />
                    {columnsExpanded && <div role="group">{columns.map(column => {
                        const id = explorerColumnId(relation.table.database, relation.table.name, column.name);
                        return <ObjectLeafRow key={id} level={level + 2} selected={selectedId === id} glyph="·" label={column.name} meta={column.type} onSelect={() => setSelectedId(id)} onInsert={() => onInsert(quoteIdentifier(column.name))} insertLabel="Insert column name"/>;
                    })}</div>}
                </>}
                {(relation.table.projections?.length ?? 0) > 0 && <>
                    <ExplorerGroupRow level={level + 1} label={copy.projections} count={relation.table.projections!.length} expanded={projectionsExpanded} onToggle={() => toggle(projectionGroupId)} />
                    {projectionsExpanded && <div role="group">{projections.map(projection => {
                        const id = explorerProjectionId(relation.table.database, relation.table.name, projection.name);
                        return <ObjectLeafRow key={id} level={level + 2} selected={selectedId === id} glyph="P" label={projection.name} meta={projection.type} onSelect={() => setSelectedId(id)}/>;
                    })}</div>}
                </>}
                {(relation.table.skipIndexes?.length ?? 0) > 0 && <>
                    <ExplorerGroupRow level={level + 1} label={copy.skipIndexes} count={relation.table.skipIndexes!.length} expanded={indexesExpanded} onToggle={() => toggle(indexGroupId)} />
                    {indexesExpanded && <div role="group">{indexes.map(index => {
                        const id = explorerSkipIndexId(relation.table.database, relation.table.name, index.name);
                        return <ObjectLeafRow key={id} level={level + 2} selected={selectedId === id} glyph="I" label={index.name} meta={index.type} onSelect={() => setSelectedId(id)}/>;
                    })}</div>}
                </>}
            </div>}
        </div>;
    };

    return <section className="inspector-section object-explorer-section">
        <div className="inspector-search object-search"><Icon name="search"/><input data-testid="schema-search" value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.objectSearch} aria-label={copy.objectSearch}/>{search && <button type="button" className="object-search-clear" aria-label="Clear object search" onClick={() => setSearch('')}>×</button>}</div>
        <div className="schema-heading object-heading"><span>{copy.objectCount.replace('{count}', (model.query ? model.visibleObjects : model.totalObjects).toLocaleString())}</span><Button variant="ghost" className="toolbar-small" onClick={onRefreshSchema} disabled={schemaLoading || !trusted}>{schemaLoading ? copy.loading : copy.refresh}</Button></div>
        {schemaError && <div className="callout callout-error">{schemaError}</div>}
        {schema?.metadataWarnings?.map(warning => <div className="schema-metadata-warning" key={warning}>{warning}</div>)}
        {!trusted && <div className="inspector-empty"><Icon name="lock"/><strong>{copy.schemaPrivate}</strong><p>{copy.trustToInspect}</p></div>}
        {schemaLoading && <div className="inspector-empty"><span className="loading-orbit"/><p>{copy.readingSchema}</p></div>}
        {trusted && schema && !schemaLoading && <>
            {model.databases.length ? <div className="object-tree-scroll">
                <div className="object-tree" role="tree" aria-label={copy.objects}>
                    {model.databases.map(database => {
                        const databaseExpanded = expanded(database.id, Boolean(model.query));
                        return <div className="object-tree-branch" key={database.id}>
                            <ExplorerGroupRow level={1} label={database.name} count={database.visibleObjectCount} expanded={databaseExpanded} onToggle={() => toggle(database.id)} database />
                            {databaseExpanded && <div role="group" className="object-tree-children">
                                {database.tables.length > 0 && <ObjectCategory label={copy.tables} kind="table" database={database.name} relations={database.tables} level={2} query={model.query} expanded={expanded} toggle={toggle} renderRelation={renderRelation}/>}
                                {database.views.length > 0 && <ObjectCategory label={copy.views} kind="view" database={database.name} relations={database.views} level={2} query={model.query} expanded={expanded} toggle={toggle} renderRelation={renderRelation}/>}
                                {database.dictionaries.length > 0 && <DictionaryCategory label={copy.dictionaries} database={database.name} dictionaries={database.dictionaries} level={2} query={model.query} expanded={expanded} toggle={toggle} selectedId={selectedId} onSelect={setSelectedId}/>}
                            </div>}
                        </div>;
                    })}
                </div>
            </div> : <div className="object-empty-search"><strong>{copy.noObjectsMatch}</strong><span>{search ? 'Try a different name, type, engine, index, or column.' : copy.metadataUnavailable}</span></div>}
            {selected && <ObjectDetails copy={copy} connection={connection} selection={selected} trusted={trusted} copiedId={copiedId} systemTableDocumentationNames={schema.systemTableDocumentationNames} onInsert={onInsert} onCopy={copyText} onOpenSqlDraft={onOpenSqlDraft}/>}
        </>}
    </section>;
}

function ObjectCategory({ label, kind, database, relations, level, query, expanded, toggle, renderRelation }: {
    label: string;
    kind: 'table' | 'view';
    database: string;
    relations: readonly ExplorerRelation[];
    level: number;
    query: string;
    expanded: (id: string, forced?: boolean) => boolean;
    toggle: (id: string) => void;
    renderRelation: (relation: ExplorerRelation, level: number) => ReactNode;
}) {
    const id = explorerCategoryId(database, kind);
    const open = expanded(id, Boolean(query));
    return <div className="object-tree-branch">
        <ExplorerGroupRow level={level} label={label} count={relations.length} expanded={open} onToggle={() => toggle(id)}/>
        {open && <div role="group">{relations.map(relation => renderRelation(relation, level + 1))}</div>}
    </div>;
}

function DictionaryCategory({ label, database, dictionaries, level, query, expanded, toggle, selectedId, onSelect }: {
    label: string;
    database: string;
    dictionaries: readonly SchemaDictionary[];
    level: number;
    query: string;
    expanded: (id: string, forced?: boolean) => boolean;
    toggle: (id: string) => void;
    selectedId?: string;
    onSelect: (id: string) => void;
}) {
    const id = explorerCategoryId(database, 'dictionary');
    const open = expanded(id, Boolean(query));
    return <div className="object-tree-branch">
        <ExplorerGroupRow level={level} label={label} count={dictionaries.length} expanded={open} onToggle={() => toggle(id)}/>
        {open && <div role="group">{dictionaries.map(dictionary => {
            const dictionaryId = explorerDictionaryId(dictionary.database, dictionary.name);
            return <ObjectLeafRow key={dictionaryId} level={level + 1} selected={selectedId === dictionaryId} glyph="◆" label={dictionary.name} meta={dictionary.type || dictionary.status} onSelect={() => onSelect(dictionaryId)}/>;
        })}</div>}
    </div>;
}

function ExplorerGroupRow({ level, label, count, expanded, onToggle, database = false }: { level: number; label: string; count: number; expanded: boolean; onToggle: () => void; database?: boolean }) {
    return <div role="treeitem" aria-level={level} aria-expanded={expanded} className={cx('object-tree-row', 'is-group', database && 'is-database')} style={{ paddingLeft: `${Math.max(0, level - 1) * 13}px` }}>
        <button type="button" className="object-tree-toggle" aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`} onClick={onToggle}><span className={cx(expanded && 'is-open')}>›</span></button>
        <button type="button" className="object-tree-main" onClick={onToggle}><span className="object-kind-glyph">{database ? '◉' : '⌁'}</span><span className="object-tree-label"><strong>{label}</strong></span><small className="object-tree-count">{count.toLocaleString()}</small></button>
    </div>;
}

function ObjectLeafRow({ level, selected, glyph, label, meta, onSelect, onInsert, insertLabel }: { level: number; selected: boolean; glyph: string; label: string; meta?: string; onSelect: () => void; onInsert?: () => void; insertLabel?: string }) {
    return <div role="treeitem" aria-level={level} aria-selected={selected} className={cx('object-tree-row', 'is-object', 'is-leaf', selected && 'is-selected')} style={{ paddingLeft: `${Math.max(0, level - 1) * 13}px` }}>
        <span className="object-tree-toggle object-tree-spacer"/>
        <button type="button" className="object-tree-main" onClick={onSelect}><span className="object-kind-glyph">{glyph}</span><span className="object-tree-label"><strong>{label}</strong>{meta && <small>{meta}</small>}</span></button>
        {onInsert && <button type="button" className="object-tree-inline-action" title={insertLabel} aria-label={`${insertLabel}: ${label}`} onClick={onInsert}>+</button>}
    </div>;
}

function ObjectDetails({ copy, connection, selection, trusted, copiedId, systemTableDocumentationNames, onInsert, onCopy, onOpenSqlDraft }: {
    copy: Copy['common'];
    connection: Connected;
    selection: ExplorerSelection;
    trusted: boolean;
    copiedId?: string;
    systemTableDocumentationNames?: readonly string[];
    onInsert: (value: string) => void;
    onCopy: (value: string, id: string) => void;
    onOpenSqlDraft: (name: string, sql: string, run: boolean) => void;
}) {
    if (selection.kind === 'relation') {
        const { table, columns } = selection;
        const qualified = qualifiedTableName(table);
        return <section className="object-details" aria-label="Selected object">
            <div className="object-details-hero"><span className={cx('object-kind-badge', selection.relationKind === 'view' && 'is-view')}>{selection.relationKind === 'view' ? 'VIEW' : 'TABLE'}</span><strong>{table.name}</strong><code>{table.database}.{table.name}</code><small>{table.engine} · {tableSummary(table, copy)}</small></div>
            <div className="object-action-grid">
                <Button variant="secondary" className="toolbar-small" disabled={!trusted} title={!trusted ? copy.runActionTrustRequired : undefined} onClick={() => onOpenSqlDraft(`Preview ${table.name}.sql`, tableQuerySql(table, columns, 'preview'), true)}>{copy.previewRows}</Button>
                <Button variant="secondary" className="toolbar-small" onClick={() => onOpenSqlDraft(`Select ${table.name}.sql`, tableQuerySql(table, columns, 'select'), false)}>{copy.generateSelect}</Button>
                <Button variant="ghost" className="toolbar-small" onClick={() => onInsert(qualified)}>{copy.insertName}</Button>
                <Button variant="ghost" className="toolbar-small" onClick={() => void onCopy(qualified, selection.id)}>{copiedId === selection.id ? copy.copied : copy.copyName}</Button>
            </div>
            <TableMetadata table={table}/>
            {table.database === 'system' && systemTableDocumentationNames?.includes(table.name) && connection.dataSource !== 'fixture' && connection.trusted && connection.manifest?.documentation.available !== false && <SystemTableDocumentation connectionId={connection.id} name={table.name} serverVersion={connection.manifest?.serverVersion ?? 'current server'}/>}
        </section>;
    }

    if (selection.kind === 'column') {
        const quoted = quoteIdentifier(selection.column.name);
        return <section className="object-details" aria-label="Selected object">
            <div className="object-details-hero"><span className="object-kind-badge">COLUMN</span><strong>{selection.column.name}</strong><code>{selection.table.database}.{selection.table.name}</code><small>{selection.column.type}</small></div>
            <div className="object-action-grid compact">
                <Button variant="secondary" className="toolbar-small" onClick={() => onInsert(quoted)}>{copy.insertName}</Button>
                <Button variant="ghost" className="toolbar-small" onClick={() => void onCopy(quoted, selection.id)}>{copiedId === selection.id ? copy.copied : copy.copyName}</Button>
            </div>
            <div className="object-fact-list">
                <ObjectFact label="TYPE" value={selection.column.type}/>
                {selection.column.defaultKind && <ObjectFact label="DEFAULT" value={selection.column.defaultKind}/>}
                {selection.column.comment && <ObjectFact label="COMMENT" value={selection.column.comment}/>}
            </div>
        </section>;
    }

    if (selection.kind === 'dictionary') {
        const dictionary = selection.dictionary;
        const qualified = dictionary.database ? `${quoteIdentifier(dictionary.database)}.${quoteIdentifier(dictionary.name)}` : quoteIdentifier(dictionary.name);
        return <section className="object-details" aria-label="Selected object">
            <div className="object-details-hero"><span className="object-kind-badge is-dictionary">DICTIONARY</span><strong>{dictionary.name}</strong><code>{dictionary.database || 'Server level'}</code><small>{dictionary.type || 'Dictionary'} · {dictionary.status.toLowerCase().replaceAll('_', ' ')}</small></div>
            <div className="object-action-grid compact">
                <Button variant="secondary" className="toolbar-small" onClick={() => onInsert(qualified)}>{copy.insertName}</Button>
                <Button variant="ghost" className="toolbar-small" onClick={() => void onCopy(qualified, selection.id)}>{copiedId === selection.id ? copy.copied : copy.copyName}</Button>
            </div>
            <div className="object-fact-list">
                {dictionary.keyColumns && <ObjectFact label="KEY" value={dictionary.keyColumns}/>}
                {dictionary.attributeColumns && <ObjectFact label="ATTRIBUTES" value={dictionary.attributeColumns}/>}
                {dictionary.elementCount && <ObjectFact label="ENTRIES" value={formatCount(dictionary.elementCount)}/>}
                {dictionary.memoryBytes && <ObjectFact label="MEMORY" value={formatBytes(dictionary.memoryBytes)}/>}
                {dictionary.lastSuccessfulUpdate && <ObjectFact label="LAST UPDATED" value={dictionary.lastSuccessfulUpdate}/>}
            </div>
        </section>;
    }

    if (selection.kind === 'projection') {
        return <section className="object-details" aria-label="Selected object"><div className="object-details-hero"><span className="object-kind-badge">PROJECTION</span><strong>{selection.projection.name}</strong><code>{selection.table.database}.{selection.table.name}</code><small>{selection.projection.type}</small></div><div className="object-fact-list">{selection.projection.sortingKey && <ObjectFact label="SORTING KEY" value={selection.projection.sortingKey}/>}</div></section>;
    }

    return <section className="object-details" aria-label="Selected object"><div className="object-details-hero"><span className="object-kind-badge">SKIP INDEX</span><strong>{selection.index.name}</strong><code>{selection.table.database}.{selection.table.name}</code><small>{selection.index.type}</small></div><div className="object-fact-list"><ObjectFact label="EXPRESSION" value={selection.index.expression}/><ObjectFact label="GRANULARITY" value={selection.index.granularity}/></div></section>;
}

function ObjectFact({ label, value }: { label: string; value: string }) {
    return <div className="object-fact"><span>{label}</span><code>{value}</code></div>;
}

function qualifiedTableName(table: SchemaTable) {
    return `${quoteIdentifier(table.database)}.${quoteIdentifier(table.name)}`;
}

function tableSummary(table: SchemaTable, copy: Copy['common']): string {
    const values = [
        table.rowEstimate == null ? undefined : `${formatCount(table.rowEstimate)} ${copy.rowsEstimated}`,
        table.sizeBytes == null ? undefined : formatBytes(table.sizeBytes),
        table.activeParts == null ? undefined : `${formatCount(table.activeParts)} ${copy.parts}`,
    ].filter((value): value is string => Boolean(value));
    return values.join(' · ') || (table.database === 'system' ? copy.systemTable : copy.metadataUnavailable);
}

function TableMetadata({ table }: { table: SchemaTable }) {
    const stats = [
        table.rowEstimate === undefined ? undefined : { label: 'Row estimate', value: table.rowEstimate === null ? 'Unavailable' : `${formatCount(table.rowEstimate)} rows`, detail: table.rowEstimate ?? undefined },
        table.sizeBytes === undefined ? undefined : { label: 'Reported size', value: table.sizeBytes === null ? 'Unavailable' : formatBytes(table.sizeBytes), detail: table.sizeBytes === null ? undefined : `ClickHouse reports ${table.sizeBytes} bytes. On-disk tables report compressed size; in-memory tables report an approximate memory size.` },
        table.uncompressedBytes === undefined ? undefined : { label: 'Uncompressed size', value: table.uncompressedBytes === null ? 'Unavailable' : formatBytes(table.uncompressedBytes), detail: table.uncompressedBytes ?? undefined },
        table.parts === undefined && table.activeParts === undefined ? undefined : { label: 'Parts', value: `${table.activeParts == null ? '—' : formatCount(table.activeParts)} active · ${table.parts == null ? '—' : formatCount(table.parts)} total`, detail: undefined },
    ].filter((stat): stat is NonNullable<typeof stat> => Boolean(stat));
    const keys = [
        ['ORDER BY', table.orderBy],
        ['PRIMARY KEY', table.primaryKey],
        ['PARTITION BY', table.partitionKey],
        ['SAMPLE BY', table.samplingKey],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    const hasKeyMetadata = table.orderBy !== undefined || table.primaryKey !== undefined || table.partitionKey !== undefined || table.samplingKey !== undefined;

    return <div className="schema-table-metadata">
        {stats.length > 0 && <div className="schema-stat-grid">{stats.map(stat => <div className="schema-stat" key={stat.label} title={stat.detail ? `${stat.label}: ${stat.detail}` : undefined}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</div>}
        {(keys.length > 0 || hasKeyMetadata) && <div className="schema-key-list">{keys.length ? keys.map(([label, value]) => <div className="schema-key" key={label}><span>{label}</span><code>{value}</code></div>) : <div className="schema-metadata-empty">No table keys configured</div>}</div>}
        {table.ttlConfigured !== undefined && <div className={cx('schema-ttl', table.ttlConfigured ? 'is-configured' : 'is-empty')}><span>TTL</span><strong>{table.ttlConfigured ? 'Configured' : 'None'}</strong></div>}
        {table.materializedViewTarget && <div className="schema-view-target"><span>WRITES TO</span><code>{table.materializedViewTarget}</code></div>}
    </div>;
}

function SystemTableDocumentation({ connectionId, name, serverVersion }: { connectionId: string; name: string; serverVersion: string }) {
    const [open, setOpen] = useState(false);
    const [documentation, setDocumentation] = useState<ClickHouseSystemTableDocumentation>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const request = useRef<AbortController | undefined>(undefined);

    useEffect(() => () => request.current?.abort(), []);

    const toggle = async () => {
        if (open) { setOpen(false); return; }
        setOpen(true);
        if (documentation || loading) return;
        const controller = new AbortController();
        request.current = controller;
        setLoading(true);
        setError('');
        try {
            const result = await api<ClickHouseSystemTableDocumentation>(`/connections/${encodeURIComponent(connectionId)}/documentation?name=${encodeURIComponent(name)}`, { signal: controller.signal });
            if (!controller.signal.aborted) setDocumentation(result);
        } catch (caught) {
            if (!controller.signal.aborted) setError(message(caught));
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };

    return <div className="grid gap-2">
        <Button variant="secondary" className="w-full justify-start" aria-expanded={open} onClick={() => void toggle()}>{open ? 'Hide ClickHouse documentation' : 'Read ClickHouse documentation'}</Button>
        {open && <article aria-label={`ClickHouse documentation for ${name}`} className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--page-raised)] p-2.5">
            <div className="flex items-center justify-between gap-2 text-[7px] font-bold tracking-[.1em] text-[var(--muted)]"><span>SERVER DOCUMENTATION</span><span>ClickHouse {documentation?.serverVersion ?? serverVersion}</span></div>
            {loading && <p className="text-[9px] text-[var(--muted)]">Loading documentation…</p>}
            {error && <p role="alert" className="text-[9px] text-[var(--amber)]">{error}</p>}
            {documentation && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-[9px] leading-relaxed text-[var(--text-soft)]">{documentation.description}</pre>}
        </article>}
    </div>;
}
