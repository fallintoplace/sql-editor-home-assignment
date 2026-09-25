import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { SchemaTable } from '../../shared/types';
import type { Copy, Locale } from '../i18n';
import type { SqlExample, SqlExampleCategory } from '../sql-examples';
import { localizeSqlExample, localizeSqlExampleCategory } from '../sql-examples-locales';
import type { Connected } from '../workspace-types';
import { MaterializedViewExplorer } from './MaterializedViewExplorer';
import { MergeTreePartsPanel } from './MergeTreePartsPanel';
import { OverlayPortal } from './OverlayPortal';
import { ReferenceExplorer } from './ReferenceExplorer';
import { RunComparisonView, type RunComparisonProps } from './RunComparison';
import { SqlFlowView, type SqlFlowViewProps } from './SqlFlowView';
import { Button, Icon, cx, type IconName } from './ui';

export type HelpPanelSection = 'tour' | 'examples' | 'query' | 'explain' | 'storage' | 'dependencies' | 'compare' | 'reference';
export type HelpExplainAction = {
    id: 'indexes' | 'plan' | 'pipeline' | 'analyze';
    label: string;
    description: string;
    disabled: boolean;
    title?: string;
    onSelect: () => void;
};
type CategoryFilter = SqlExampleCategory | 'charts' | 'all' | 'featured';

const categories: CategoryFilter[] = ['featured', 'business', 'observability', 'operations', 'engineering', 'markets', 'cities', 'openSource', 'internet', 'datasets', 'clickhouse', 'charts', 'all', 'basics', 'aggregation', 'timeSeries', 'schema'];

function categoryLabel(category: CategoryFilter, copy: Copy['common'], locale: Locale) {
    if (category === 'all') return copy.allExamples;
    if (category === 'featured') return localizeSqlExampleCategory(category, locale, 'Featured');
    if (category === 'business') return localizeSqlExampleCategory(category, locale, 'Business');
    if (category === 'observability') return localizeSqlExampleCategory(category, locale, 'Observability');
    if (category === 'operations') return localizeSqlExampleCategory(category, locale, 'Operations');
    if (category === 'engineering') return localizeSqlExampleCategory(category, locale, 'Engineering');
    if (category === 'markets') return localizeSqlExampleCategory(category, locale, 'Markets');
    if (category === 'cities') return localizeSqlExampleCategory(category, locale, 'Cities');
    if (category === 'openSource') return localizeSqlExampleCategory(category, locale, 'Open source');
    if (category === 'internet') return localizeSqlExampleCategory(category, locale, 'Internet');
    if (category === 'datasets') return localizeSqlExampleCategory(category, locale, 'Datasets');
    if (category === 'basics') return copy.exampleBasics;
    if (category === 'aggregation') return copy.exampleAggregation;
    if (category === 'timeSeries') return copy.exampleTimeSeries;
    if (category === 'charts') return copy.exampleCharts;
    if (category === 'clickhouse') return copy.exampleClickHouse;
    return copy.exampleSchema;
}

function chartLabel(example: SqlExample, copy: Copy['common']) {
    switch (example.chart.kind) {
        case 'table': return copy.exampleChartTable;
        case 'number': return copy.exampleChartNumber;
        case 'line': return copy.exampleChartLine;
        case 'bar': return copy.exampleChartBar;
        case 'scatter': return copy.exampleChartScatter;
        case 'heatmap': return copy.exampleChartHeatmap;
        case 'candlestick': return copy.exampleChartCandlestick;
        default: return copy.chart;
    }
}

function exampleText(example: SqlExample, locale: Locale, copy: Copy['common']) {
    if (example.category === 'schema') {
        const tableName = example.name.replace(/^Preview /, '');
        return {
            name: copy.examplePreviewTable.replace('{table}', tableName),
            description: copy.exampleReadRows,
        };
    }
    return localizeSqlExample(example, locale);
}


type HelpSectionDefinition = {
    id: HelpPanelSection;
    label: string;
    description: string;
    icon: IconName;
};

function helpSections(copy: Copy['common']): HelpSectionDefinition[] {
    return [
        { id: 'tour', label: copy.helpTour, description: copy.helpTourDescription, icon: 'help' },
        { id: 'examples', label: copy.sqlExamples, description: copy.examplesHint, icon: 'examples' },
        { id: 'query', label: copy.helpQueryEngine, description: copy.helpQueryEngineDescription, icon: 'parser' },
        { id: 'explain', label: copy.helpExplain, description: copy.helpExplainDescription, icon: 'bolt' },
        { id: 'storage', label: copy.helpStorage, description: copy.helpStorageDescription, icon: 'database' },
        { id: 'dependencies', label: copy.helpDependencies, description: copy.helpDependenciesDescription, icon: 'pipeline' },
        { id: 'compare', label: copy.helpCompareRuns, description: copy.helpCompareRunsDescription, icon: 'history' },
        { id: 'reference', label: copy.helpReference, description: copy.helpReferenceDescription, icon: 'reference' },
    ];
}

function HelpSectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
    return <header className="workspace-help-section-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>
    </header>;
}

export function WorkspaceHelpPanel({ examples, sourceLabel, copy, locale, open, section, onSectionChange, onClose, onOpenExample, onRunExample, onStartBlankSql, connection, tables, schemaLoading, trusted, queryEngine, explainActions, comparison, onReferenceInsert }: {
    examples: SqlExample[];
    sourceLabel: string;
    copy: Copy['common'];
    locale: Locale;
    open: boolean;
    section: HelpPanelSection;
    onSectionChange: (section: HelpPanelSection) => void;
    onClose: (restoreFocus?: boolean) => void;
    onOpenExample: (example: SqlExample) => boolean;
    onRunExample: (example: SqlExample, view: 'results' | 'chart') => boolean;
    onStartBlankSql: () => boolean;
    connection: Connected;
    tables: SchemaTable[];
    schemaLoading: boolean;
    trusted: boolean;
    queryEngine: SqlFlowViewProps;
    explainActions: HelpExplainAction[];
    comparison: RunComparisonProps;
    onReferenceInsert: (value: string) => void;
}) {
    const panelRef = useRef<HTMLElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const tabRefs = useRef(new Map<HelpPanelSection, HTMLButtonElement>());
    const sectionRef = useRef(section);
    sectionRef.current = section;
    const optionRefs = useRef(new Map<string, HTMLButtonElement>());
    const sections = helpSections(copy);
    const featuredExamples = useMemo(() => examples
        .filter(example => example.featuredOrder !== undefined)
        .sort((left, right) => left.featuredOrder! - right.featuredOrder!), [examples]);
    const defaultExample = featuredExamples[0] ?? examples[0];
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<CategoryFilter>(featuredExamples.length ? 'featured' : 'all');
    const [selectedId, setSelectedId] = useState(defaultExample?.id ?? '');

    const filteredExamples = useMemo(() => {
        const term = search.trim().toLocaleLowerCase();
        const candidates = category === 'featured' ? featuredExamples : examples;
        return candidates.filter(example => {
            if (category === 'charts' && example.chart.kind === 'table') return false;
            if (category !== 'all' && category !== 'charts' && category !== 'featured' && example.category !== category) return false;
            if (!term) return true;
            const localized = exampleText(example, locale, copy);
            return [example.name, localized.name, example.dataset ?? '', example.description, localized.description, example.sql].join(' ').toLocaleLowerCase().includes(term);
        });
    }, [category, copy, examples, featuredExamples, locale, search]);
    const selected = filteredExamples.find(example => example.id === selectedId) ?? filteredExamples[0];
    const availableCategories = categories.filter(value => {
        if (value === 'all') return true;
        if (value === 'featured') return featuredExamples.length > 0;
        if (value === 'charts') return examples.some(example => example.chart.kind !== 'table');
        return examples.some(example => example.category === value);
    });

    useEffect(() => {
        if (selected && selected.id !== selectedId) setSelectedId(selected.id);
    }, [selected, selectedId]);

    useEffect(() => {
        if (!open) return;
        setSearch('');
        setCategory(featuredExamples.length ? 'featured' : 'all');
        setSelectedId(defaultExample?.id ?? '');

        const previousOverflow = document.body.style.overflow;
        const appRoot = document.getElementById('root');
        const previousInert = appRoot?.inert ?? false;
        document.body.style.overflow = 'hidden';
        if (appRoot) appRoot.inert = true;
        const focusFrame = window.requestAnimationFrame(() => {
            const currentSection = sectionRef.current;
            if (currentSection === 'examples') {
                searchRef.current?.focus();
                return;
            }
            if (currentSection === 'storage') {
                panelRef.current?.querySelector<HTMLElement>('.help-parts-table-picker select:not(:disabled)')?.focus();
                return;
            }
            const activePanel = panelRef.current?.querySelector<HTMLElement>('#workspace-help-panel-' + currentSection);
            const firstAction = activePanel?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
            (firstAction ?? tabRefs.current.get(currentSection))?.focus();
        });
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== 'Tab') return;

            const panel = panelRef.current;
            if (!panel) return;
            const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            )).filter(element => !element.closest('[hidden]'));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const focusIsOutside = !panel.contains(document.activeElement);
            if (!first || !last) {
                event.preventDefault();
                panel.focus();
            } else if (event.shiftKey && (document.activeElement === first || focusIsOutside)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || focusIsOutside)) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            if (appRoot) appRoot.inert = previousInert;
        };
    }, [defaultExample?.id, featuredExamples.length, open, onClose]);

    const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, current: HelpPanelSection) => {
        const currentIndex = sections.findIndex(item => item.id === current);
        let nextIndex: number | undefined;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % sections.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + sections.length) % sections.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = sections.length - 1;
        if (nextIndex === undefined) return;
        event.preventDefault();
        const next = sections[nextIndex]!.id;
        onSectionChange(next);
        window.requestAnimationFrame(() => tabRefs.current.get(next)?.focus());
    };

    const renderTabPanel = (id: HelpPanelSection, className: string, children: ReactNode) =>
        <div id={'workspace-help-panel-' + id} className={cx('workspace-help-tabpanel', className)} role="tabpanel" aria-labelledby={'workspace-help-tab-' + id} hidden={section !== id}>{children}</div>;

    return <>
        {open && <OverlayPortal><div className="workspace-help-backdrop" onClick={event => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <section ref={panelRef} id="workspace-help-panel" className="workspace-help-panel" role="dialog" aria-modal="true" aria-labelledby="workspace-help-title" tabIndex={-1}>
                <header className="workspace-help-header">
                    <div><span className="eyebrow">{sourceLabel}</span><h2 id="workspace-help-title">{copy.helpCenterTitle}</h2><p>{copy.helpCenterDescription}</p></div>
                    <div className="workspace-help-header-actions">
                        <Button variant="secondary" className="sql-example-blank" data-testid="blank-sql" onClick={() => { if (onStartBlankSql()) onClose(false); }}><Icon name="plus"/>{copy.startBlankSql}</Button>
                        <button type="button" className="workspace-help-close" aria-label={copy.closeHelp} title={copy.closeHelp} onClick={() => onClose()}><Icon name="close"/></button>
                    </div>
                </header>
                <div className="workspace-help-body">
                    <div className="workspace-help-tabs" role="tablist" aria-label={copy.helpPanelSections}>
                        {sections.map(item => <button
                            key={item.id}
                            ref={element => { if (element) tabRefs.current.set(item.id, element); else tabRefs.current.delete(item.id); }}
                            id={'workspace-help-tab-' + item.id}
                            data-testid={'help-section-' + item.id}
                            type="button"
                            role="tab"
                            aria-selected={section === item.id}
                            aria-controls={'workspace-help-panel-' + item.id}
                            tabIndex={section === item.id ? 0 : -1}
                            className={cx('workspace-help-tab', section === item.id && 'is-active')}
                            onClick={() => onSectionChange(item.id)}
                            onKeyDown={event => handleTabKeyDown(event, item.id)}
                        ><Icon name={item.icon}/><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}
                    </div>
                    <div className="workspace-help-content">
                        {renderTabPanel('tour', 'workspace-help-tour', <>
                            <HelpSectionHeading eyebrow="CLICKSTUDIO TOUR" title={copy.helpTourTitle} description={copy.helpTourDescription}/>
                            <div className="workspace-help-feature-grid">
                                {sections.filter(item => item.id !== 'tour').map(item => <button type="button" key={item.id} className="workspace-help-feature-card" onClick={() => onSectionChange(item.id)}>
                                    <span className="workspace-help-feature-icon"><Icon name={item.icon}/></span>
                                    <span className="workspace-help-feature-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                                    <span className="workspace-help-feature-arrow">›</span>
                                </button>)}
                            </div>
                            <p className="workspace-help-safe-note"><span className="status-light is-trusted"/>Explore freely. SQL only runs when you explicitly choose Run or an EXPLAIN action.</p>
                        </>)}

                        {renderTabPanel('examples', 'workspace-help-examples', section === 'examples' ? <>
                            <div className="sql-examples-toolbar">
                                <div className="sql-example-categories" role="group" aria-label={copy.exampleCategories}>
                                    {availableCategories.map(value => <button key={value} data-testid={'sql-example-category-' + value} type="button" className={cx('sql-example-category', category === value && 'is-active')} aria-pressed={category === value} onClick={() => setCategory(value)}>{categoryLabel(value, copy, locale)}</button>)}
                                </div>
                                <label className="sql-example-search"><Icon name="search"/><input ref={searchRef} data-testid="sql-example-search" type="search" aria-label={copy.searchExamples} placeholder={copy.searchExamples} value={search} onChange={event => setSearch(event.target.value)}/></label>
                            </div>
                            {filteredExamples.length === 0 ? <p className="sql-examples-empty" role="status">{copy.noExamplesFound}</p> : <div className="sql-examples-layout">
                                <div className="sql-examples-list" role="listbox" aria-label={copy.sqlExamples}>
                                {filteredExamples.map((example, index) => <button key={example.id} data-testid={'sql-example-' + example.id} ref={element => { if (element) optionRefs.current.set(example.id, element); else optionRefs.current.delete(example.id); }} type="button" role="option" tabIndex={example.id === selected?.id ? 0 : -1} aria-selected={example.id === selected?.id} className={cx('sql-example-option', example.id === selected?.id && 'is-selected')} onFocus={() => setSelectedId(example.id)} onClick={() => setSelectedId(example.id)} onKeyDown={event => {
                                    let nextIndex: number | undefined;
                                    if (event.key === 'ArrowDown') nextIndex = (index + 1) % filteredExamples.length;
                                    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + filteredExamples.length) % filteredExamples.length;
                                    else if (event.key === 'Home') nextIndex = 0;
                                    else if (event.key === 'End') nextIndex = filteredExamples.length - 1;
                                    if (nextIndex === undefined) return;
                                    event.preventDefault();
                                    const nextExample = filteredExamples[nextIndex]!;
                                    setSelectedId(nextExample.id);
                                    optionRefs.current.get(nextExample.id)?.focus();
                                }}>
                                    <span className="sql-example-option-title">{exampleText(example, locale, copy).name}</span>
                                    <span className="sql-example-option-description">{exampleText(example, locale, copy).description}</span>
                                    <span className="sql-example-option-meta">
                                        <span className="sql-example-option-category">{example.dataset ?? categoryLabel(example.category, copy, locale)}</span>
                                        <span className="sql-example-chart-kind">{chartLabel(example, copy)}</span>
                                    </span>
                                </button>)}
                                </div>
                                {selected && <article className="sql-example-preview">
                                <div className="sql-example-preview-heading"><div><span className="eyebrow">{selected.dataset ?? categoryLabel(selected.category, copy, locale)}</span><h3>{exampleText(selected, locale, copy).name}.sql</h3></div><span className="sql-example-readonly">{chartLabel(selected, copy)}</span></div>
                                <p>{exampleText(selected, locale, copy).description}</p>
                                <pre><code>{selected.sql}</code></pre>
                                <div className="sql-example-actions">
                                    <Button variant="secondary" className="sql-example-action" data-testid="open-sql-example" aria-label={copy.openInNewSql} title={copy.openInNewSql} onClick={() => { if (onOpenExample(selected)) onClose(false); }}><Icon name="plus"/>{copy.openExample}</Button>
                                    <Button variant="primary" className="sql-example-action" data-testid="run-sql-example" onClick={() => { if (onRunExample(selected, 'results')) onClose(false); }}><Icon name="play"/>{copy.run}</Button>
                                    <Button variant="secondary" className="sql-example-action" data-testid="chart-sql-example" onClick={() => { if (onRunExample(selected, 'chart')) onClose(false); }}><Icon name="chart"/>{copy.chart}</Button>
                                </div>
                                </article>}
                            </div>}
                        </> : null)}

                        {renderTabPanel('query', 'workspace-help-feature-view workspace-help-query', section === 'query' ? <>
                            <HelpSectionHeading eyebrow="QUERY ENGINE" title={copy.helpQueryEngine} description={copy.helpQueryEngineDescription}/>
                            <div className="workspace-help-feature-scroll"><SqlFlowView {...queryEngine}/></div>
                        </> : null)}

                        {renderTabPanel('explain', 'workspace-help-feature-view workspace-help-explain', section === 'explain' ? <>
                            <HelpSectionHeading eyebrow="CLICKHOUSE EXPLAIN" title={copy.helpExplain} description={copy.helpExplainDescription}/>
                            <div className="workspace-help-explain-grid">{explainActions.map((action, index) => <button key={action.id} type="button" className="workspace-help-explain-card" disabled={action.disabled} title={action.title ?? action.label} onClick={() => { onClose(false); action.onSelect(); }}>
                                <span className="workspace-help-explain-index">{String(index + 1).padStart(2, '0')}</span>
                                <strong>{action.label}</strong>
                                <p>{action.description}</p>
                                <span>{action.disabled ? action.title ?? 'Unavailable' : copy.run + ' →'}</span>
                            </button>)}</div>
                            <p className="workspace-help-safe-note"><span className="status-light is-warning"/>EXPLAIN ANALYZE executes the selected query to measure runtime. The other EXPLAIN views inspect planning.</p>
                        </> : null)}

                        {renderTabPanel('storage', 'workspace-help-storage', section === 'storage'
                            ? <MergeTreePartsPanel connection={connection} copy={copy} tables={tables} schemaLoading={schemaLoading} trusted={trusted} active={open && section === 'storage'}/>
                            : null)}

                        {renderTabPanel('dependencies', 'workspace-help-feature-view workspace-help-dependencies', section === 'dependencies' ? <>
                            <HelpSectionHeading eyebrow="MATERIALIZED VIEWS" title={copy.helpDependencies} description={copy.helpDependenciesDescription}/>
                            {!trusted ? <div className="workspace-help-locked"><Icon name="lock"/><strong>{copy.schemaPrivate}</strong><p>{copy.trustToInspect}</p></div> : <div className="workspace-help-feature-scroll"><MaterializedViewExplorer embedded active={open && section === 'dependencies'} connection={connection} database={connection.database}/></div>}
                        </> : null)}

                        {renderTabPanel('compare', 'workspace-help-feature-view workspace-help-compare', section === 'compare' ? <>
                            <HelpSectionHeading eyebrow="QUERY EVIDENCE" title={copy.helpCompareRuns} description={copy.helpCompareRunsDescription}/>
                            <div className="workspace-help-feature-scroll"><RunComparisonView {...comparison}/></div>
                        </> : null)}

                        {renderTabPanel('reference', 'workspace-help-feature-view workspace-help-reference', section === 'reference' ? <>
                            <HelpSectionHeading eyebrow="CLICKHOUSE REFERENCE" title={copy.helpReference} description={copy.helpReferenceDescription}/>
                            <div className="workspace-help-feature-scroll"><ReferenceExplorer copy={copy} connection={connection} trusted={trusted} onTargetHandled={() => undefined} onInsert={onReferenceInsert}/></div>
                        </> : null)}
                    </div>
                </div>
            </section>
        </div></OverlayPortal>}
    </>;
}
