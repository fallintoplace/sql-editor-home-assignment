import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, rectangularSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, indentSelection } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { autocompletion } from '@codemirror/autocomplete';
import { sql, SQLDialect } from '@codemirror/lang-sql';
import { setDiagnostics } from '@codemirror/lint';
import type { ApiError, Schema } from '../../shared/types';
const clickhouse = SQLDialect.define({ keywords: 'SELECT WITH FROM WHERE PREWHERE GROUP BY HAVING ORDER LIMIT OFFSET AS AND OR NOT NULL JOIN LEFT RIGHT INNER FULL CROSS ARRAY JOIN UNION ALL DISTINCT EXPLAIN SETTINGS SAMPLE FINAL FORMAT INTO CASE WHEN THEN ELSE END ON USING ASC DESC', types: 'String UInt8 UInt16 UInt32 UInt64 UInt128 UInt256 Int8 Int16 Int32 Int64 Int128 Int256 Float32 Float64 Date Date32 DateTime DateTime64 Nullable Array Tuple Map Decimal LowCardinality UUID JSON', builtin: 'count sum avg min max uniq uniqExact quantile median toDate toDateTime toStartOfDay toStartOfHour now today numbers arrayJoin arrayMap arrayFilter multiIf ifNull coalesce', doubleQuotedStrings: false, hashComments: true });
export interface EditorHandle {
    insert: (text: string) => void;
    focus: () => void;
    indent: () => void;
    selection: () => {
        from: number;
        to: number;
    };
}
interface Props {
    value: string;
    from: number;
    to: number;
    schema?: Schema;
    dark: boolean;
    error?: ApiError;
    onChange: (value: string) => void;
    onSelection: (from: number, to: number) => void;
    onRun: (script: boolean) => void;
}
export const SqlEditor = forwardRef<EditorHandle, Props>(function SqlEditor(props, ref) {
    const element = useRef<HTMLDivElement>(null), view = useRef<EditorView | undefined>(undefined), current = useRef(props), language = useRef(new Compartment()), theme = useRef(new Compartment());
    current.current = props;
    const languageExtension = () => sql({ dialect: clickhouse, schema: Object.fromEntries((current.current.schema?.tables ?? []).map(t => [`${t.database}.${t.name}`, current.current.schema?.columns.filter(c => c.database === t.database && c.table === t.name).map(c => c.name) ?? []])) });
    const themeExtension = () => EditorView.theme({ '&': { height: '100%', backgroundColor: 'var(--panel)', color: 'var(--text)' }, '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '13px' }, '.cm-gutters': { backgroundColor: 'var(--panel)', color: 'var(--muted)', border: 'none' }, '.cm-content': { minHeight: '220px' }, '.cm-cursor': { borderLeftColor: 'var(--text)' }, '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: current.current.dark ? '#39464e' : '#e1e7eb' } }, { dark: current.current.dark });
    useEffect(() => { if (!element.current)
        return; const p = current.current; const editor = new EditorView({ parent: element.current, state: EditorState.create({ doc: p.value, selection: { anchor: Math.min(p.from, p.value.length), head: Math.min(p.to, p.value.length) }, extensions: [lineNumbers(), history(), drawSelection(), highlightActiveLine(), rectangularSelection(), bracketMatching(), foldGutter(), highlightSelectionMatches(), syntaxHighlighting(defaultHighlightStyle), autocompletion(), language.current.of(languageExtension()), theme.current.of(themeExtension()), EditorState.allowMultipleSelections.of(true), EditorView.contentAttributes.of({ 'aria-label': 'SQL editor', 'spellcheck': 'false' }), keymap.of([{ key: 'Mod-Enter', run: () => { current.current.onRun(false); return true; } }, { key: 'Mod-Shift-Enter', run: () => { current.current.onRun(true); return true; } }, ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap, indentWithTab]), EditorView.updateListener.of(update => { if (update.docChanged)
                    current.current.onChange(update.state.doc.toString()); if (update.selectionSet) {
                    const s = update.state.selection.main;
                    current.current.onSelection(s.from, s.to);
                } })] }) }); view.current = editor; return () => { editor.destroy(); view.current = undefined; }; }, []);
    useEffect(() => { const v = view.current; if (v && v.state.doc.toString() !== props.value)
        v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: props.value }, selection: { anchor: Math.min(props.from, props.value.length), head: Math.min(props.to, props.value.length) } }); }, [props.value]);
    useEffect(() => { const v = view.current; if (!v)
        return; const from = Math.min(props.from, v.state.doc.length), to = Math.min(props.to, v.state.doc.length); if (v.state.selection.main.from !== from || v.state.selection.main.to !== to)
        v.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true }); }, [props.from, props.to]);
    useEffect(() => { view.current?.dispatch({ effects: language.current.reconfigure(languageExtension()) }); }, [props.schema]);
    useEffect(() => { view.current?.dispatch({ effects: theme.current.reconfigure(themeExtension()) }); }, [props.dark]);
    useEffect(() => { const v = view.current; if (!v)
        return; const position = props.error?.position; v.dispatch(setDiagnostics(v.state, position === undefined ? [] : [{ from: Math.min(position, v.state.doc.length), to: Math.min(position + 1, v.state.doc.length), severity: 'error', message: props.error!.message }])); }, [props.error]);
    useImperativeHandle(ref, () => ({ insert: text => { const v = view.current; if (v) {
            v.dispatch(v.state.replaceSelection(text));
            v.focus();
        } }, focus: () => view.current?.focus(), indent: () => { if (view.current)
            indentSelection(view.current); }, selection: () => { const s = view.current?.state.selection.main; return { from: s?.from ?? 0, to: s?.to ?? 0 }; } }), []);
    return <div className="sql-editor" ref={element}/>;
});
