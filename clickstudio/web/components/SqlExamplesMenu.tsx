import { useEffect, useMemo, useRef, useState } from 'react';
import type { Copy } from '../i18n';
import type { SqlExample, SqlExampleCategory } from '../sql-examples';
import { OverlayPortal } from './OverlayPortal';
import { Button, Icon, cx } from './ui';

type CategoryFilter = SqlExampleCategory | 'all';
type PanelPosition = { top: number; left: number; width: number; maxHeight: number };

const categories: CategoryFilter[] = ['all', 'basics', 'aggregation', 'timeSeries', 'clickhouse', 'schema'];

function categoryLabel(category: CategoryFilter, copy: Copy['common']) {
    if (category === 'all') return copy.allExamples;
    if (category === 'basics') return copy.exampleBasics;
    if (category === 'aggregation') return copy.exampleAggregation;
    if (category === 'timeSeries') return copy.exampleTimeSeries;
    if (category === 'clickhouse') return copy.exampleClickHouse;
    return copy.exampleSchema;
}

export function SqlExamplesMenu({ examples, sourceLabel, copy, onOpenExample }: {
    examples: SqlExample[];
    sourceLabel: string;
    copy: Copy['common'];
    onOpenExample: (example: SqlExample) => boolean;
}) {
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const optionRefs = useRef(new Map<string, HTMLButtonElement>());
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<CategoryFilter>('all');
    const [selectedId, setSelectedId] = useState(examples[0]?.id ?? '');
    const [position, setPosition] = useState<PanelPosition>();

    const filteredExamples = useMemo(() => {
        const term = search.trim().toLocaleLowerCase();
        return examples.filter(example => {
            if (category !== 'all' && example.category !== category) return false;
            if (!term) return true;
            return `${example.name} ${example.description} ${example.sql}`.toLocaleLowerCase().includes(term);
        });
    }, [category, examples, search]);
    const selected = filteredExamples.find(example => example.id === selectedId) ?? filteredExamples[0];
    const availableCategories = categories.filter(value => value === 'all' || examples.some(example => example.category === value));

    useEffect(() => {
        if (selected && selected.id !== selectedId) setSelectedId(selected.id);
    }, [selected, selectedId]);

    useEffect(() => {
        if (!open) return;
        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const margin = 12;
            const width = Math.max(280, Math.min(880, window.innerWidth - margin * 2));
            const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
            const preferredTop = rect.bottom + 7;
            const top = Math.min(preferredTop, Math.max(margin, window.innerHeight - 260));
            setPosition({ top, left, width, maxHeight: Math.max(220, Math.min(600, window.innerHeight - top - margin)) });
        };
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
        };
        updatePosition();
        window.requestAnimationFrame(() => searchRef.current?.focus());
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const show = () => {
        setSearch('');
        setCategory('all');
        setSelectedId(examples[0]?.id ?? '');
        setOpen(true);
    };

    return <div className="sql-examples-menu" ref={rootRef}>
        <button ref={triggerRef} type="button" className="new-tab-button sql-examples-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls="sql-examples-panel" title={copy.examples} onClick={() => open ? setOpen(false) : show()}>
            <Icon name="examples"/><span>{copy.examples}</span>
        </button>
        {open && <OverlayPortal><section ref={panelRef} id="sql-examples-panel" className="sql-examples-panel" role="dialog" aria-modal="false" aria-labelledby="sql-examples-title" style={position ? { top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight } : undefined}>
            <header className="sql-examples-header">
                <div><span className="eyebrow">{sourceLabel}</span><h2 id="sql-examples-title">{copy.sqlExamples}</h2><p>{copy.examplesHint}</p></div>
                <button type="button" className="sql-examples-close" aria-label={copy.closeExamples} title={copy.closeExamples} onClick={() => { setOpen(false); triggerRef.current?.focus(); }}><Icon name="close"/></button>
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
                        <span className="sql-example-option-title">{example.name}</span>
                        <span className="sql-example-option-description">{example.description}</span>
                        <span className="sql-example-option-category">{categoryLabel(example.category, copy)}</span>
                    </button>)}
                </div>
                {selected && <article className="sql-example-preview">
                    <div className="sql-example-preview-heading"><div><span className="eyebrow">{categoryLabel(selected.category, copy)}</span><h3>{selected.name}.sql</h3></div><span className="sql-example-readonly">SQL</span></div>
                    <p>{selected.description}</p>
                    <pre><code>{selected.sql}</code></pre>
                    <Button variant="primary" className="sql-example-open" onClick={() => { if (onOpenExample(selected)) { setOpen(false); triggerRef.current?.focus(); } }}><Icon name="plus"/>{copy.openInNewSql}</Button>
                </article>}
            </div>}
        </section></OverlayPortal>}
    </div>;
}
