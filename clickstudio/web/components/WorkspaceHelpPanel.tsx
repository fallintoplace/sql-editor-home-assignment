import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Connection, SchemaTable } from '../../shared/types';
import type { Copy, Locale } from '../i18n';
import type { SqlExample, SqlExampleCategory } from '../sql-examples';
import { localizeSqlExample, localizeSqlExampleCategory } from '../sql-examples-locales';
import { MergeTreePartsPanel } from './MergeTreePartsPanel';
import { OverlayPortal } from './OverlayPortal';
import { Button, Icon, cx } from './ui';

export type HelpPanelSection = 'examples' | 'parts';
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

export function WorkspaceHelpPanel({ examples, sourceLabel, copy, locale, open, section, onSectionChange, onClose, onOpenExample, onRunExample, onStartBlankSql, connection, tables, schemaLoading, trusted }: {
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
    connection: Pick<Connection, 'id' | 'dataSource'>;
    tables: SchemaTable[];
    schemaLoading: boolean;
    trusted: boolean;
}) {
    const panelRef = useRef<HTMLElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const tabRefs = useRef<Record<HelpPanelSection, HTMLButtonElement | null>>({ examples: null, parts: null });
    const sectionRef = useRef(section);
    sectionRef.current = section;
    const optionRefs = useRef(new Map<string, HTMLButtonElement>());
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
            if (sectionRef.current === 'examples') searchRef.current?.focus();
            else panelRef.current?.querySelector<HTMLElement>('.help-parts-table-picker select:not(:disabled), .workspace-help-close')?.focus();
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
        const next = event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? current === 'examples' ? 'parts' : 'examples'
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                ? current === 'examples' ? 'parts' : 'examples'
                : undefined;
        if (!next) return;
        event.preventDefault();
        onSectionChange(next);
        window.requestAnimationFrame(() => tabRefs.current[next]?.focus());
    };

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
                <div className="workspace-help-tabs" role="tablist" aria-label={copy.helpPanelSections}>
                    <button ref={element => { tabRefs.current.examples = element; }} id="workspace-help-tab-examples" type="button" role="tab" aria-selected={section === 'examples'} aria-controls="workspace-help-panel-examples" tabIndex={section === 'examples' ? 0 : -1} className={cx('workspace-help-tab', section === 'examples' && 'is-active')} onClick={() => onSectionChange('examples')} onKeyDown={event => handleTabKeyDown(event, 'examples')}>{copy.sqlExamples}</button>
                    <button ref={element => { tabRefs.current.parts = element; }} id="workspace-help-tab-parts" type="button" role="tab" aria-selected={section === 'parts'} aria-controls="workspace-help-panel-parts" tabIndex={section === 'parts' ? 0 : -1} className={cx('workspace-help-tab', section === 'parts' && 'is-active')} onClick={() => onSectionChange('parts')} onKeyDown={event => handleTabKeyDown(event, 'parts')}>{copy.helpPartsTitle}</button>
                </div>
                <div id="workspace-help-panel-examples" className="workspace-help-tabpanel workspace-help-examples" role="tabpanel" aria-labelledby="workspace-help-tab-examples" hidden={section !== 'examples'}>
                    <div className="sql-examples-toolbar">
                        <div className="sql-example-categories" role="group" aria-label={copy.exampleCategories}>
                            {availableCategories.map(value => <button key={value} data-testid={`sql-example-category-${value}`} type="button" className={cx('sql-example-category', category === value && 'is-active')} aria-pressed={category === value} onClick={() => setCategory(value)}>{categoryLabel(value, copy, locale)}</button>)}
                        </div>
                        <label className="sql-example-search"><Icon name="search"/><input ref={searchRef} data-testid="sql-example-search" type="search" aria-label={copy.searchExamples} placeholder={copy.searchExamples} value={search} onChange={event => setSearch(event.target.value)}/></label>
                    </div>
                    {filteredExamples.length === 0 ? <p className="sql-examples-empty" role="status">{copy.noExamplesFound}</p> : <div className="sql-examples-layout">
                        <div className="sql-examples-list" role="listbox" aria-label={copy.sqlExamples}>
                        {filteredExamples.map((example, index) => <button key={example.id} data-testid={`sql-example-${example.id}`} ref={element => { if (element) optionRefs.current.set(example.id, element); else optionRefs.current.delete(example.id); }} type="button" role="option" tabIndex={example.id === selected?.id ? 0 : -1} aria-selected={example.id === selected?.id} className={cx('sql-example-option', example.id === selected?.id && 'is-selected')} onFocus={() => setSelectedId(example.id)} onClick={() => setSelectedId(example.id)} onKeyDown={event => {
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
                </div>
                <div id="workspace-help-panel-parts" className="workspace-help-tabpanel workspace-help-parts" role="tabpanel" aria-labelledby="workspace-help-tab-parts" hidden={section !== 'parts'}>
                    <MergeTreePartsPanel connection={connection} copy={copy} tables={tables} schemaLoading={schemaLoading} trusted={trusted} active={open && section === 'parts'}/>
                </div>
            </section>
        </div></OverlayPortal>}
    </>;
}
