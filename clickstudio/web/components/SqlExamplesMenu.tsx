import { useEffect, useMemo, useRef, useState } from 'react';
import type { Copy, Locale } from '../i18n';
import type { SqlExample, SqlExampleCategory } from '../sql-examples';
import { localizeSqlExample } from '../sql-examples-locales';
import { OverlayPortal } from './OverlayPortal';
import { Button, Icon, cx } from './ui';

type CategoryFilter = SqlExampleCategory | 'charts' | 'all';

const categories: CategoryFilter[] = ['all', 'basics', 'aggregation', 'timeSeries', 'charts', 'clickhouse', 'schema'];

function categoryLabel(category: CategoryFilter, copy: Copy['common']) {
    if (category === 'all') return copy.allExamples;
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

export function SqlExamplesMenu({ examples, sourceLabel, copy, locale, open, onOpen, onClose, onOpenExample }: {
    examples: SqlExample[];
    sourceLabel: string;
    copy: Copy['common'];
    locale: Locale;
    open: boolean;
    onOpen: (opener: HTMLButtonElement) => void;
    onClose: (restoreFocus?: boolean) => void;
    onOpenExample: (example: SqlExample) => boolean;
}) {
    const panelRef = useRef<HTMLElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const optionRefs = useRef(new Map<string, HTMLButtonElement>());
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<CategoryFilter>('all');
    const [selectedId, setSelectedId] = useState(examples[0]?.id ?? '');

    const filteredExamples = useMemo(() => {
        const term = search.trim().toLocaleLowerCase();
        return examples.filter(example => {
            if (category === 'charts' && example.chart.kind === 'table') return false;
            if (category !== 'all' && category !== 'charts' && example.category !== category) return false;
            if (!term) return true;
            const localized = exampleText(example, locale, copy);
            return [example.name, localized.name, example.dataset ?? '', example.description, localized.description, example.sql].join(' ').toLocaleLowerCase().includes(term);
        });
    }, [category, copy, examples, locale, search]);
    const selected = filteredExamples.find(example => example.id === selectedId) ?? filteredExamples[0];
    const availableCategories = categories.filter(value => value === 'all' || (value === 'charts'
        ? examples.some(example => example.chart.kind !== 'table')
        : examples.some(example => example.category === value)));

    useEffect(() => {
        if (selected && selected.id !== selectedId) setSelectedId(selected.id);
    }, [selected, selectedId]);

    useEffect(() => {
        if (!open) return;
        setSearch('');
        setCategory('all');
        setSelectedId(examples[0]?.id ?? '');

        const previousOverflow = document.body.style.overflow;
        const appRoot = document.getElementById('root');
        const previousInert = appRoot?.inert ?? false;
        document.body.style.overflow = 'hidden';
        if (appRoot) appRoot.inert = true;
        const focusFrame = window.requestAnimationFrame(() => searchRef.current?.focus());
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
                'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ));
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
    }, [open, onClose]);

    return <>
        <div className="sql-examples-menu">
            <button type="button" className="new-tab-button sql-examples-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls="sql-examples-panel" title={copy.examples} onClick={event => onOpen(event.currentTarget)}>
                <Icon name="examples"/><span>{copy.examples}</span>
            </button>
        </div>
        {open && <OverlayPortal><div className="sql-examples-backdrop" onClick={event => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <section ref={panelRef} id="sql-examples-panel" className="sql-examples-panel" role="dialog" aria-modal="true" aria-labelledby="sql-examples-title" tabIndex={-1}>
                <header className="sql-examples-header">
                    <div><span className="eyebrow">{sourceLabel}</span><h2 id="sql-examples-title">{copy.sqlExamples}</h2><p>{copy.examplesHint}</p></div>
                    <button type="button" className="sql-examples-close" aria-label={copy.closeExamples} title={copy.closeExamples} onClick={() => onClose()}><Icon name="close"/></button>
                </header>
                <div className="sql-examples-toolbar">
                    <div className="sql-example-categories" role="group" aria-label={copy.exampleCategories}>
                        {availableCategories.map(value => <button key={value} type="button" className={cx('sql-example-category', category === value && 'is-active')} aria-pressed={category === value} onClick={() => setCategory(value)}>{categoryLabel(value, copy)}</button>)}
                    </div>
                    <label className="sql-example-search"><Icon name="search"/><input ref={searchRef} type="search" aria-label={copy.searchExamples} placeholder={copy.searchExamples} value={search} onChange={event => setSearch(event.target.value)}/></label>
                </div>
                {filteredExamples.length === 0 ? <p className="sql-examples-empty" role="status">{copy.noExamplesFound}</p> : <div className="sql-examples-layout">
                    <div className="sql-examples-list" role="listbox" aria-label={copy.sqlExamples}>
                        {filteredExamples.map((example, index) => <button key={example.id} ref={element => { if (element) optionRefs.current.set(example.id, element); else optionRefs.current.delete(example.id); }} type="button" role="option" tabIndex={example.id === selected?.id ? 0 : -1} aria-selected={example.id === selected?.id} className={cx('sql-example-option', example.id === selected?.id && 'is-selected')} onFocus={() => setSelectedId(example.id)} onClick={() => setSelectedId(example.id)} onKeyDown={event => {
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
                                <span className="sql-example-option-category">{example.dataset ?? categoryLabel(example.category, copy)}</span>
                                <span className="sql-example-chart-kind">{chartLabel(example, copy)}</span>
                            </span>
                        </button>)}
                    </div>
                    {selected && <article className="sql-example-preview">
                        <div className="sql-example-preview-heading"><div><span className="eyebrow">{selected.dataset ?? categoryLabel(selected.category, copy)}</span><h3>{exampleText(selected, locale, copy).name}.sql</h3></div><span className="sql-example-readonly">{chartLabel(selected, copy)}</span></div>
                        <p>{exampleText(selected, locale, copy).description}</p>
                        <pre><code>{selected.sql}</code></pre>
                        <Button variant="primary" className="sql-example-open" onClick={() => { if (onOpenExample(selected)) onClose(false); }}><Icon name="plus"/>{copy.openInNewSql}</Button>
                    </article>}
                </div>}
            </section>
        </div></OverlayPortal>}
    </>;
}
