import { StateField, Transaction, type Extension } from '@codemirror/state';
import { EditorView, keymap, showPanel, type Panel } from '@codemirror/view';
import { isolateHistory } from '@codemirror/commands';
import { snippet, snippetCompletion } from '@codemirror/autocomplete';
import { activeStatementIndex, appendQuerySeparator, CLICKHOUSE_SNIPPETS, statementOutline, type StatementOutline } from '../../shared/editor-tools';

// Cursor movement reuses the outline; only document edits invoke the boundary lexer.
export const sqlStatementOutline = StateField.define<StatementOutline>({
    create: state => statementOutline(state.doc.toString()),
    update: (outline, transaction) => transaction.docChanged ? statementOutline(transaction.newDoc.toString()) : outline,
});

export const clickhouseSnippetCompletions = CLICKHOUSE_SNIPPETS.map(item => snippetCompletion(item.template, {
    label: item.id,
    displayLabel: item.label,
    type: 'text',
    detail: 'ClickHouse snippet',
    info: `${item.detail} Edit the example table and columns with Tab. Inserting a snippet never runs SQL.`,
}));

function navigateStatement(view: EditorView, direction: -1 | 1): boolean {
    const statements = view.state.field(sqlStatementOutline).statements;
    const index = activeStatementIndex(statements, view.state.selection.main.from);
    const target = index < 0 ? undefined : statements[index + direction];
    if (!target) return false;
    view.dispatch({ selection: { anchor: target.from }, scrollIntoView: true });
    view.focus();
    return true;
}

function selectStatement(view: EditorView): boolean {
    const statements = view.state.field(sqlStatementOutline).statements;
    const target = statements[activeStatementIndex(statements, view.state.selection.main.from)];
    if (!target) return false;
    view.dispatch({ selection: { anchor: target.from, head: target.to }, scrollIntoView: true });
    view.focus();
    return true;
}

function editorToolsPanel(view: EditorView): Panel {
    const doc = view.dom.ownerDocument;
    const dom = doc.createElement('div');
    dom.className = 'cm-sql-tools';
    dom.setAttribute('role', 'group');
    dom.setAttribute('aria-label', 'SQL editing tools');
    const button = (text: string, label: string, action: () => void) => {
        const element = doc.createElement('button');
        element.type = 'button';
        element.textContent = text;
        element.setAttribute('aria-label', label);
        element.title = label;
        element.addEventListener('click', action);
        return element;
    };
    const previous = button('←', 'Previous SQL statement', () => { navigateStatement(view, -1); });
    const next = button('→', 'Next SQL statement', () => { navigateStatement(view, 1); });
    const select = button('Select query', 'Select current SQL statement', () => { selectStatement(view); });
    const picker = doc.createElement('select');
    picker.className = 'cm-sql-statement-picker';
    picker.setAttribute('aria-label', 'Jump to SQL statement');
    picker.addEventListener('change', () => {
        const target = view.state.field(sqlStatementOutline).statements[Number(picker.value)];
        if (!target) return;
        view.dispatch({ selection: { anchor: target.from }, scrollIntoView: true });
        view.focus();
    });

    const snippets = doc.createElement('select');
    snippets.setAttribute('aria-label', 'ClickHouse snippet');
    snippets.title = 'Choose a template, then add it as a new query. Existing SQL is preserved.';
    const placeholder = doc.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'ClickHouse snippets…';
    snippets.append(placeholder);
    for (const item of CLICKHOUSE_SNIPPETS) {
        const option = doc.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        snippets.append(option);
    }
    const insert = button('Add query', 'Add snippet as a new query', () => {
        const chosen = CLICKHOUSE_SNIPPETS.find(item => item.id === snippets.value);
        if (!chosen || view.state.readOnly || view.state.field(sqlStatementOutline).error) return;
        const text = view.state.doc.toString();
        // One normal CodeMirror snippet edit: undoable, with linked fields and Tab navigation.
        snippet(appendQuerySeparator(text) + chosen.template)({
            state: view.state,
            dispatch: transaction => view.dispatch(view.state.update({
                changes: transaction.changes,
                selection: transaction.selection,
                effects: transaction.effects,
                scrollIntoView: transaction.scrollIntoView,
                annotations: [isolateHistory.of('full'), Transaction.userEvent.of('input.complete')],
            })),
        }, null, text.length, text.length);
        view.focus();
    });
    const note = doc.createElement('span');
    note.className = 'cm-sql-tools-note';
    note.setAttribute('role', 'status');
    dom.append(previous, picker, next, select, snippets, insert, note);
    dom.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            view.focus();
        }
    });

    const refresh = (rebuild: boolean) => {
        const outline = view.state.field(sqlStatementOutline);
        const index = activeStatementIndex(outline.statements, view.state.selection.main.from);
        if (rebuild) {
            const options = doc.createDocumentFragment();
            if (!outline.statements.length) {
                const option = doc.createElement('option');
                option.value = '-1';
                option.textContent = outline.error ? 'Incomplete SQL' : 'No SQL statements';
                options.append(option);
            }
            outline.statements.forEach((statement, position) => {
                const option = doc.createElement('option');
                option.value = String(position);
                option.textContent = `${position + 1} / ${outline.statements.length} · ${statement.label}`;
                options.append(option);
            });
            picker.replaceChildren(options);
        }
        picker.value = String(index);
        picker.disabled = index < 0;
        previous.disabled = index <= 0;
        next.disabled = index < 0 || index >= outline.statements.length - 1;
        select.disabled = index < 0;
        insert.disabled = !snippets.value || Boolean(outline.error) || view.state.readOnly;
        const chosen = CLICKHOUSE_SNIPPETS.find(item => item.id === snippets.value);
        const text = outline.error
            ? `${outline.error}. Finish the quote or comment to use query tools.`
            : chosen ? `${chosen.detail} Tab edits placeholders. SQL is not run automatically.` : '';
        if (note.textContent !== text) note.textContent = text;
        note.hidden = !text;
    };
    snippets.addEventListener('change', () => refresh(false));
    refresh(true);
    return {
        dom,
        update: update => { refresh(update.docChanged); },
    };
}

export function sqlEditorTools(): Extension {
    return [
        sqlStatementOutline,
        showPanel.of(editorToolsPanel),
        keymap.of([
            { key: 'Alt-PageUp', run: view => navigateStatement(view, -1) },
            { key: 'Alt-PageDown', run: view => navigateStatement(view, 1) },
        ]),
        EditorView.baseTheme({
            '.cm-panels-bottom': { backgroundColor: 'var(--panel)', color: 'var(--text)', borderTop: '1px solid var(--line)' },
            '.cm-sql-tools': { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', padding: '6px 10px', font: '11px var(--font-sans, sans-serif)' },
            '.cm-sql-tools button, .cm-sql-tools select': { font: 'inherit', color: 'var(--text-soft)', backgroundColor: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '5px', padding: '4px 7px', minHeight: '28px', maxWidth: '100%' },
            '.cm-sql-tools button': { cursor: 'pointer' },
            '.cm-sql-tools button:hover:not(:disabled)': { backgroundColor: 'var(--panel-hover)' },
            '.cm-sql-tools button:disabled, .cm-sql-tools select:disabled': { opacity: '0.5', cursor: 'default' },
            '.cm-sql-tools button:focus-visible, .cm-sql-tools select:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
            '.cm-sql-statement-picker': { flex: '1 1 140px', minWidth: '0', maxWidth: '360px', textOverflow: 'ellipsis' },
            '.cm-sql-tools-note': { flexBasis: '100%', color: 'var(--muted)', lineHeight: '1.5' },
        }),
    ];
}
