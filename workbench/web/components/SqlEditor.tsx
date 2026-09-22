import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { sql, SQLDialect } from '@codemirror/lang-sql';
import { bracketMatching, defaultHighlightStyle, foldGutter, foldKeymap, syntaxHighlighting } from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, Compartment } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers, rectangularSelection } from '@codemirror/view';
import type { Schema } from '../../shared/types';

const clickhouse = SQLDialect.define({
    keywords: 'SELECT WITH FROM WHERE PREWHERE GROUP BY HAVING ORDER LIMIT OFFSET AS AND OR NOT NULL JOIN LEFT RIGHT INNER FULL CROSS ARRAY JOIN UNION ALL DISTINCT EXPLAIN SETTINGS SAMPLE FINAL FORMAT INTO CASE WHEN THEN ELSE END ON USING ASC DESC',
    types: 'String UInt8 UInt16 UInt32 UInt64 UInt128 UInt256 Int8 Int16 Int32 Int64 Int128 Int256 Float32 Float64 Date Date32 DateTime DateTime64 Nullable Array Tuple Map Decimal LowCardinality UUID JSON',
    builtin: 'count sum avg min max uniq uniqExact quantile median toDate toDateTime toStartOfDay toStartOfHour now today numbers arrayJoin arrayMap arrayFilter multiIf ifNull coalesce',
    doubleQuotedStrings: false,
    hashComments: true,
});

export interface SqlEditorHandle {
    focus: () => void;
    insert: (value: string) => void;
}

interface Props {
    value: string;
    schema?: Schema;
    onChange: (value: string) => void;
    onRun: () => void;
}

function schemaCompletions(schema?: Schema): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const table of schema?.tables ?? []) {
        result[`${table.database}.${table.name}`] = (schema?.columns ?? [])
            .filter(column => column.database === table.database && column.table === table.name)
            .map(column => column.name);
    }
    return result;
}

const theme = EditorView.theme({
    '&': {
        height: '100%',
        backgroundColor: '#111318',
        color: '#e5e7eb',
        fontSize: '13px',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        lineHeight: '1.65',
    },
    '.cm-gutters': {
        backgroundColor: '#0d0f14',
        color: '#525866',
        border: 'none',
        borderRight: '1px solid #20242d',
    },
    '.cm-activeLineGutter': { backgroundColor: '#171a22', color: '#a78bfa' },
    '.cm-activeLine': { backgroundColor: 'rgb(167 139 250 / 0.04)' },
    '.cm-content': { minHeight: '100%', padding: '16px 0' },
    '.cm-line': { padding: '0 16px' },
    '.cm-cursor': { borderLeftColor: '#c4b5fd' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#3d2d63' },
    '.cm-tooltip': {
        border: '1px solid #343945',
        backgroundColor: '#171a22',
        color: '#e5e7eb',
    },
}, { dark: true });

export const SqlEditor = forwardRef<SqlEditorHandle, Props>(function SqlEditor({ value, schema, onChange, onRun }, ref) {
    const element = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | undefined>(undefined);
    const current = useRef({ value, onChange, onRun });
    const language = useRef(new Compartment());
    const completions = useMemo(() => schemaCompletions(schema), [schema]);
    current.current = { value, onChange, onRun };

    useEffect(() => {
        if (!element.current)
            return;
        const editor = new EditorView({
            parent: element.current,
            state: EditorState.create({
                doc: value,
                extensions: [
                    lineNumbers(),
                    history(),
                    drawSelection(),
                    highlightActiveLine(),
                    rectangularSelection(),
                    bracketMatching(),
                    foldGutter(),
                    highlightSelectionMatches(),
                    syntaxHighlighting(defaultHighlightStyle),
                    autocompletion(),
                    language.current.of(sql({ dialect: clickhouse, schema: completions })),
                    theme,
                    EditorView.lineWrapping,
                    EditorView.contentAttributes.of({ 'aria-label': 'SQL editor', spellcheck: 'false' }),
                    keymap.of([
                        { key: 'Mod-Enter', run: () => { current.current.onRun(); return true; } },
                        ...defaultKeymap,
                        ...historyKeymap,
                        ...searchKeymap,
                        ...foldKeymap,
                        indentWithTab,
                    ]),
                    EditorView.updateListener.of(update => {
                        if (update.docChanged)
                            current.current.onChange(update.state.doc.toString());
                    }),
                ],
            }),
        });
        view.current = editor;
        return () => {
            editor.destroy();
            view.current = undefined;
        };
    }, []);

    useEffect(() => {
        const editor = view.current;
        if (editor && editor.state.doc.toString() !== value)
            editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }, [value]);

    useEffect(() => {
        view.current?.dispatch({ effects: language.current.reconfigure(sql({ dialect: clickhouse, schema: completions })) });
    }, [completions]);

    useImperativeHandle(ref, () => ({
        focus: () => view.current?.focus(),
        insert: valueToInsert => {
            const editor = view.current;
            if (!editor)
                return;
            editor.dispatch(editor.state.replaceSelection(valueToInsert));
            editor.focus();
        },
    }), []);

    return <div ref={element} className="h-full min-h-80 w-full overflow-hidden" />;
});
