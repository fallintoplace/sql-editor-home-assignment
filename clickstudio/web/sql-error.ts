import type { ApiError } from '../shared/types.js';
import { lexSql } from '../shared/sql.js';

export type SqlErrorRange = { from: number; to: number };

function unknownFunctionName(message: string) {
    const named = /Function with name [`'\"]([^`'\"]+)[`'\"] does not exist/i.exec(message);
    if (named?.[1]) return named[1];
    const legacy = /Unknown function [`'\"]?([A-Za-z_][A-Za-z0-9_$]*)/i.exec(message);
    return legacy?.[1];
}

function identifier(token: ReturnType<typeof lexSql>[number]) {
    if (token.kind === 'word') return token.text;
    if (token.kind === 'quoted' && (token.text.startsWith('`') || token.text.startsWith('"'))) {
        const quote = token.text[0]!;
        return token.text.slice(1, -1).replaceAll(quote + quote, quote);
    }
    return undefined;
}

function unknownFunctionRange(sql: string, name: string): SqlErrorRange | undefined {
    try {
        const tokens = lexSql(sql), matches: SqlErrorRange[] = [];
        for (let index = 0; index < tokens.length - 1; index++) {
            const token = tokens[index]!;
            const tokenName = identifier(token);
            if (tokenName?.toLowerCase() === name.toLowerCase() && tokens[index + 1]!.text === '(')
                matches.push({ from: token.from, to: token.to });
        }
        return matches.length === 1 ? matches[0] : undefined;
    } catch {
        return undefined;
    }
}

/** Locate only a unique unknown-function call, or use an explicit server position. */
export function sqlErrorRange(sql: string, error: ApiError): SqlErrorRange | undefined {
    const name = unknownFunctionName(error.message);
    if (name) {
        const range = unknownFunctionRange(sql, name);
        if (range) return range;
    }
    if (error.position !== undefined && error.position >= 0 && error.position < sql.length)
        return { from: error.position, to: error.position + 1 };
    return undefined;
}

/** Translate an error span from the submitted statement into the editor document. */
export function sqlErrorRangeInDraft(draft: string, statement: string, sourceFrom: number, error: ApiError): SqlErrorRange | undefined {
    let offset = sourceFrom;
    if (draft.slice(offset, offset + statement.length) !== statement) {
        const first = draft.indexOf(statement);
        if (first < 0 || draft.indexOf(statement, first + 1) >= 0) return undefined;
        offset = first;
    }
    const range = sqlErrorRange(statement, error);
    if (!range) return undefined;
    const from = offset + range.from, to = offset + range.to;
    return from >= 0 && to <= draft.length ? { from, to } : undefined;
}
